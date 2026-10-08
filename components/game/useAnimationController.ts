"use client";

import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { LoopOnce, LoopRepeat, type AnimationAction, type AnimationMixer } from "three";
import { isLoopingAnimation, isOneShotAnimation } from "@/lib/game/animations";
import { characters, type CharacterId } from "@/lib/game/characters";
import { attackForAnimation, landingPoseTime } from "@/lib/game/combat/attacks";
import { attachHitstopMixer } from "@/lib/game/combat/hitstop";
import { getAttackRuntime, publishClipClock } from "@/lib/game/combat/runtime";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { playAnimation, registerAnimations } from "@/store/slices/gameSlice";

const FADE_SECONDS = 0.2;

function startClip(
  action: AnimationAction,
  previous: AnimationAction | null,
  looping: boolean,
  snap: boolean,
) {
  action.enabled = true;
  action.setEffectiveTimeScale(1);
  action.setLoop(looping ? LoopRepeat : LoopOnce, looping ? Infinity : 1);
  action.clampWhenFinished = !looping;

  const cut =
    snap ||
    Boolean(previous && previous !== action && previous.getMixer() !== action.getMixer());
  if (previous && previous !== action) {
    if (cut) {
      previous.stop();
      previous.setEffectiveWeight(0);
    } else {
      previous.fadeOut(FADE_SECONDS);
    }
  }

  action.reset();
  if (previous && previous !== action && !cut) {
    action.fadeIn(FADE_SECONDS);
  } else {
    action.setEffectiveWeight(1);
  }
  action.play();
}

export type AnimationLibrary = {
  actions: {
    [name: string]: AnimationAction | null | undefined;
  };
  mixer: AnimationMixer;
  names: string[];
};

type AnimationControllerInput = {
  libraries: readonly AnimationLibrary[];
  characterId: CharacterId;
  fighterId: string;
  /** Computer fighters play clips from this ref instead of the shared HUD animation. */
  clipCommandRef?: RefObject<{ name: string; epoch: number }>;
  onOneShotFinished?: (clipName: string) => string | null;
};

function cutsIn(name: string): boolean {
  const attack = attackForAnimation(name);
  return Boolean(attack?.pose || attack?.cutIn);
}

function findAction(
  libraries: readonly AnimationLibrary[],
  name: string,
): AnimationAction | null {
  for (const library of libraries) {
    const action = library.actions[name];
    if (action) {
      return action;
    }
  }
  return null;
}

export function useAnimationController({
  libraries,
  characterId,
  fighterId,
  clipCommandRef,
  onOneShotFinished,
}: AnimationControllerInput) {
  const dispatch = useAppDispatch();
  const clips = characters[characterId].clips;
  const defaultAnimation = characters[characterId].defaultAnimation;
  const currentAnimation = useAppSelector((state) => state.game.currentAnimation);
  const animationEpoch = useAppSelector((state) => state.game.animationEpoch);
  const librariesRef = useRef(libraries);
  const activeActionRef = useRef<AnimationAction | null>(null);
  const appliedEpochRef = useRef(-1);
  const onOneShotFinishedRef = useRef(onOneShotFinished);
  const local = clipCommandRef !== undefined;

  useEffect(() => {
    librariesRef.current = libraries;
  });

  useEffect(() => {
    onOneShotFinishedRef.current = onOneShotFinished;
  }, [onOneShotFinished]);

  useEffect(() => {
    const detach = libraries.map((library) => attachHitstopMixer(library.mixer));
    return () => {
      for (const undo of detach) {
        undo();
      }
    };
  }, [libraries]);

  const playLocal = useCallback(
    (name: string, epoch: number) => {
      if (epoch === appliedEpochRef.current) {
        return;
      }
      const action = findAction(librariesRef.current, name);
      if (!action) {
        return;
      }
      appliedEpochRef.current = epoch;
      const previous = activeActionRef.current;
      const snap = cutsIn(name);
      startClip(action, previous, isLoopingAnimation(clips, name), snap);
      activeActionRef.current = action;
    },
    [clips],
  );

  useFrame(() => {
    const command = clipCommandRef?.current;
    if (command) {
      playLocal(command.name, command.epoch);
    }

    const action = activeActionRef.current;
    if (!action) {
      return;
    }
    const clip = action.getClip();
    const attack = attackForAnimation(clip.name);
    const attackRuntime = getAttackRuntime(fighterId);
    if (!attack?.pose || !attackRuntime.live || attackRuntime.attackId !== attack.id) {
      return;
    }
    const time = landingPoseTime(attack, attackRuntime.phase, attackRuntime.elapsedFrame);
    if (time === null) {
      return;
    }
    // Pose follows the physics phase. Time scale stays at 0 so the mixer
    // cannot advance the clip into a landing on its own.
    action.enabled = true;
    action.paused = false;
    action.setEffectiveWeight(1);
    action.setEffectiveTimeScale(0);
    action.time = time;
  }, -1);

  useFrame(() => {
    const action = activeActionRef.current;
    if (!action) {
      publishClipClock(fighterId, "", 0);
      return;
    }
    const clip = action.getClip();
    publishClipClock(fighterId, clip.name, action.time);
  });

  useEffect(() => {
    return () => {
      publishClipClock(fighterId, "", 0);
    };
  }, [fighterId]);

  const registeredNames = useMemo(() => {
    const combined: string[] = [];
    for (const library of libraries) {
      for (const name of library.names) {
        if (!combined.includes(name)) {
          combined.push(name);
        }
      }
    }
    return combined;
  }, [libraries]);

  useEffect(() => {
    if (local) {
      return;
    }
    dispatch(registerAnimations(registeredNames));
  }, [dispatch, local, registeredNames]);

  useEffect(() => {
    if (local) {
      return;
    }
    const action = findAction(librariesRef.current, currentAnimation);
    if (!action) {
      return;
    }

    const previous = activeActionRef.current;
    const snap = cutsIn(currentAnimation);
    startClip(action, previous, isLoopingAnimation(clips, currentAnimation), snap);
    activeActionRef.current = action;
  }, [animationEpoch, clips, currentAnimation, libraries, local]);

  const onFinished = useCallback(
    (event: { action: AnimationAction }) => {
      const clipName = event.action.getClip().name;
      if (!isOneShotAnimation(clips, clipName)) {
        return;
      }
      if (activeActionRef.current !== event.action) {
        return;
      }

      const resolveNext = onOneShotFinishedRef.current;
      const play = (name: string) => {
        if (clipCommandRef?.current) {
          clipCommandRef.current = {
            name,
            epoch: clipCommandRef.current.epoch + 1,
          };
          return;
        }
        dispatch(playAnimation(name));
      };

      if (!resolveNext) {
        play(defaultAnimation);
        return;
      }

      const next = resolveNext(clipName);
      if (next) {
        play(next);
      }
    },
    [clipCommandRef, clips, defaultAnimation, dispatch],
  );

  useEffect(() => {
    const mixers = libraries.map((library) => library.mixer);
    for (const mixer of mixers) {
      mixer.addEventListener("finished", onFinished);
    }
    return () => {
      for (const mixer of mixers) {
        mixer.removeEventListener("finished", onFinished);
      }
    };
  }, [libraries, onFinished]);
}

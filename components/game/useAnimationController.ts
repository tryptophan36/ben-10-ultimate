"use client";

import { useCallback, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { LoopOnce, LoopRepeat, type AnimationAction, type AnimationMixer } from "three";
import { bindHitstopMixer } from "@/lib/game/combat/hitstop";
import { publishClipClock } from "@/lib/game/combat/runtime";
import {
  DEFAULT_ANIMATION,
  isLoopingAnimation,
  isOneShotAnimation,
} from "@/lib/game/animations";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { playAnimation, registerAnimations } from "@/store/slices/gameSlice";

const FADE_SECONDS = 0.2;

function startClip(
  action: AnimationAction,
  previous: AnimationAction | null,
  looping: boolean,
) {
  action.enabled = true;
  action.setEffectiveTimeScale(1);
  action.setLoop(looping ? LoopRepeat : LoopOnce, looping ? Infinity : 1);
  action.clampWhenFinished = !looping;

  const switchingMixer = Boolean(
    previous && previous !== action && previous.getMixer() !== action.getMixer(),
  );
  if (previous && previous !== action) {
    if (switchingMixer) {
      previous.stop();
      previous.setEffectiveWeight(0);
    } else {
      previous.fadeOut(FADE_SECONDS);
    }
  }

  action.reset();
  if (previous && previous !== action && !switchingMixer) {
    action.fadeIn(FADE_SECONDS);
  } else {
    action.setEffectiveWeight(1);
  }
  action.play();
}

type AnimationLibrary = {
  actions: {
    [name: string]: AnimationAction | null | undefined;
  };
  mixer: AnimationMixer;
  names: string[];
};

type AnimationControllerInput = AnimationLibrary & {
  onOneShotFinished?: (clipName: string) => string | null;
  /** Clips that live on a second model, such as Cannonbolt's ball. */
  secondary?: AnimationLibrary;
};

export function useAnimationController({
  actions,
  mixer,
  names,
  onOneShotFinished,
  secondary,
}: AnimationControllerInput) {
  const dispatch = useAppDispatch();
  const currentAnimation = useAppSelector((state) => state.game.currentAnimation);
  const animationEpoch = useAppSelector((state) => state.game.animationEpoch);
  const actionsRef = useRef(actions);
  const secondaryActionsRef = useRef(secondary?.actions);
  const activeActionRef = useRef<AnimationAction | null>(null);
  const onOneShotFinishedRef = useRef(onOneShotFinished);
  const secondaryNames = secondary?.names;
  const secondaryMixer = secondary?.mixer;

  useEffect(() => {
    actionsRef.current = actions;
    secondaryActionsRef.current = secondary?.actions;
  });

  useEffect(() => {
    onOneShotFinishedRef.current = onOneShotFinished;
  }, [onOneShotFinished]);

  useEffect(() => {
    bindHitstopMixer(mixer);
    return () => {
      bindHitstopMixer(null);
    };
  }, [mixer]);

  useFrame(() => {
    const action = activeActionRef.current;
    if (!action) {
      publishClipClock("", 0);
      return;
    }
    const clip = action.getClip();
    publishClipClock(clip.name, action.time);
  });

  useEffect(() => {
    return () => {
      publishClipClock("", 0);
    };
  }, []);

  useEffect(() => {
    if (!secondaryNames || secondaryNames.length === 0) {
      dispatch(registerAnimations(names));
      return;
    }

    const combined = [...names];
    for (const name of secondaryNames) {
      if (!combined.includes(name)) {
        combined.push(name);
      }
    }
    dispatch(registerAnimations(combined));
  }, [dispatch, names, secondaryNames]);

  useEffect(() => {
    const action =
      actionsRef.current[currentAnimation] ??
      secondaryActionsRef.current?.[currentAnimation];
    if (!action) {
      return;
    }

    const previous = activeActionRef.current;
    startClip(action, previous, isLoopingAnimation(currentAnimation));
    activeActionRef.current = action;
    bindHitstopMixer(action.getMixer());
  }, [actions, animationEpoch, currentAnimation]);

  const onFinished = useCallback(
    (event: { action: AnimationAction }) => {
      const clipName = event.action.getClip().name;
      if (!isOneShotAnimation(clipName)) {
        return;
      }
      if (activeActionRef.current !== event.action) {
        return;
      }

      const resolveNext = onOneShotFinishedRef.current;
      if (!resolveNext) {
        dispatch(playAnimation(DEFAULT_ANIMATION));
        return;
      }

      const next = resolveNext(clipName);
      if (next) {
        dispatch(playAnimation(next));
      }
    },
    [dispatch],
  );

  useEffect(() => {
    mixer.addEventListener("finished", onFinished);
    return () => {
      mixer.removeEventListener("finished", onFinished);
    };
  }, [mixer, onFinished]);

  useEffect(() => {
    if (!secondaryMixer || secondaryMixer === mixer) {
      return;
    }
    secondaryMixer.addEventListener("finished", onFinished);
    return () => {
      secondaryMixer.removeEventListener("finished", onFinished);
    };
  }, [mixer, onFinished, secondaryMixer]);
}

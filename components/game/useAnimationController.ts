"use client";

import { useEffect, useRef } from "react";
import { LoopOnce, LoopRepeat, type AnimationAction, type AnimationMixer } from "three";
import {
  DEFAULT_ANIMATION,
  isLoopingAnimation,
  isOneShotAnimation,
} from "@/lib/game/animations";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { playAnimation, registerAnimations } from "@/store/slices/gameSlice";

const FADE_SECONDS = 0.2;

type AnimationControllerInput = {
  actions: {
    [name: string]: AnimationAction | null | undefined;
  };
  mixer: AnimationMixer;
  names: string[];
  onOneShotFinished?: (clipName: string) => string | null;
};

export function useAnimationController({
  actions,
  mixer,
  names,
  onOneShotFinished,
}: AnimationControllerInput) {
  const dispatch = useAppDispatch();
  const currentAnimation = useAppSelector((state) => state.game.currentAnimation);
  const animationEpoch = useAppSelector((state) => state.game.animationEpoch);
  const actionsRef = useRef(actions);
  const activeActionRef = useRef<AnimationAction | null>(null);
  const onOneShotFinishedRef = useRef(onOneShotFinished);

  useEffect(() => {
    actionsRef.current = actions;
  });

  useEffect(() => {
    onOneShotFinishedRef.current = onOneShotFinished;
  }, [onOneShotFinished]);

  useEffect(() => {
    dispatch(registerAnimations(names));
  }, [dispatch, names]);

  useEffect(() => {
    const action = actionsRef.current[currentAnimation];
    if (!action) {
      return;
    }

    const looping = isLoopingAnimation(currentAnimation);
    action.enabled = true;
    action.setEffectiveTimeScale(1);
    action.setLoop(looping ? LoopRepeat : LoopOnce, looping ? Infinity : 1);
    action.clampWhenFinished = !looping;

    const previous = activeActionRef.current;
    if (previous && previous !== action) {
      previous.fadeOut(FADE_SECONDS);
    }

    action.reset();
    if (previous && previous !== action) {
      action.fadeIn(FADE_SECONDS);
    } else {
      action.setEffectiveWeight(1);
    }
    action.play();
    activeActionRef.current = action;
  }, [actions, animationEpoch, currentAnimation]);

  useEffect(() => {
    const onFinished = (event: { action: AnimationAction }) => {
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
    };

    mixer.addEventListener("finished", onFinished);
    return () => {
      mixer.removeEventListener("finished", onFinished);
    };
  }, [dispatch, mixer]);
}

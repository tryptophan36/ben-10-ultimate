"use client";

import { useEffect } from "react";
import { ANIMATION_HOTKEYS } from "@/lib/game/animations";
import { useAppDispatch } from "@/store/hooks";
import { playAnimation } from "@/store/slices/gameSlice";

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable)
  );
}

export function useAnimationHotkeys() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (isTypingTarget(event.target)) {
        return;
      }

      const requested = ANIMATION_HOTKEYS[event.code];
      if (!requested) {
        return;
      }

      event.preventDefault();
      dispatch(playAnimation(requested));
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch]);
}

"use client";

import { useEffect } from "react";
import { characters } from "@/lib/game/characters";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
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
  const selectedCharacter = useAppSelector((state) => state.game.selectedCharacter);
  const clips = characters[selectedCharacter].clips;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (isTypingTarget(event.target)) {
        return;
      }

      const clip = clips.find((entry) => entry.debugKeys?.includes(event.code));
      if (!clip) {
        return;
      }

      event.preventDefault();
      dispatch(playAnimation(clip.name));
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clips, dispatch]);
}

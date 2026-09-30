"use client";

import { useEffect, useRef } from "react";

export type GameInputState = {
  forward: number;
  strafe: number;
  run: boolean;
  jump: boolean;
  light: boolean;
  heavy: boolean;
};

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable)
  );
}

function isGameKey(code: string): boolean {
  return (
    code === "KeyW" ||
    code === "KeyA" ||
    code === "KeyS" ||
    code === "KeyD" ||
    code === "ShiftLeft" ||
    code === "ShiftRight" ||
    code === "Space" ||
    code === "KeyJ" ||
    code === "KeyK"
  );
}

export function useGameInput() {
  const state = useRef<GameInputState>({
    forward: 0,
    strafe: 0,
    run: false,
    jump: false,
    light: false,
    heavy: false,
  });

  useEffect(() => {
    const keys = new Set<string>();

    const syncAxes = () => {
      const current = state.current;
      current.forward = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
      current.strafe = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
      current.run = keys.has("ShiftLeft") || keys.has("ShiftRight");
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (!isGameKey(event.code)) {
        return;
      }

      event.preventDefault();

      if (event.repeat) {
        return;
      }

      if (event.code === "Space") {
        state.current.jump = true;
        return;
      }
      if (event.code === "KeyJ") {
        state.current.light = true;
        return;
      }
      if (event.code === "KeyK") {
        state.current.heavy = true;
        return;
      }

      keys.add(event.code);
      syncAxes();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      keys.delete(event.code);
      syncAxes();
    };

    const clear = () => {
      keys.clear();
      syncAxes();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clear);
    };
  }, []);

  return state;
}

import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  DEFAULT_ANIMATION,
  resolveAnimationName,
} from "@/lib/game/animations";
import { characters, type CharacterId } from "@/lib/game/characters";

export type GameStatus = "idle" | "loading" | "playing";

type GameState = {
  currentAnimation: string;
  selectedCharacter: CharacterId;
  gameStatus: GameStatus;
  availableAnimations: string[];
  animationEpoch: number;
};

const initialState: GameState = {
  currentAnimation: DEFAULT_ANIMATION,
  selectedCharacter: "four-arms",
  gameStatus: "idle",
  availableAnimations: [],
  animationEpoch: 0,
};

function sameNames(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((name, index) => name === right[index])
  );
}

const gameSlice = createSlice({
  name: "game",
  initialState,
  reducers: {
    markSessionActive(state) {
      if (state.gameStatus === "idle") {
        state.gameStatus = "loading";
      }
    },
    endSession(state) {
      state.gameStatus = "idle";
      state.availableAnimations = [];
      state.currentAnimation = characters[state.selectedCharacter].defaultAnimation;
      state.animationEpoch = 0;
    },
    setGameStatus(state, action: PayloadAction<GameStatus>) {
      state.gameStatus = action.payload;
    },
    setSelectedCharacter(state, action: PayloadAction<CharacterId>) {
      state.selectedCharacter = action.payload;
      state.currentAnimation = characters[action.payload].defaultAnimation;
      state.availableAnimations = [];
      state.gameStatus = "loading";
      state.animationEpoch += 1;
    },
    registerAnimations(state, action: PayloadAction<string[]>) {
      if (!sameNames(state.availableAnimations, action.payload)) {
        state.availableAnimations = action.payload;
      }

      const resolved = resolveAnimationName(
        state.currentAnimation,
        action.payload,
      );
      if (state.currentAnimation !== resolved) {
        state.currentAnimation = resolved;
      }

      if (state.gameStatus !== "playing") {
        state.gameStatus = "playing";
      }
    },
    playAnimation(state, action: PayloadAction<string>) {
      state.currentAnimation = resolveAnimationName(
        action.payload,
        state.availableAnimations,
      );
      state.animationEpoch += 1;
    },
  },
});

export const {
  markSessionActive,
  endSession,
  setGameStatus,
  setSelectedCharacter,
  registerAnimations,
  playAnimation,
} = gameSlice.actions;

export default gameSlice.reducer;

import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  freshFighterHealth,
  OPPONENT_FIGHTER_ID,
  PLAYER_FIGHTER_ID,
} from "@/lib/game/combat/fighters";
import { ATTACK_PHASE, type AttackPhase } from "@/lib/game/combat/types";

export const TRAINING_DUMMY_ID = "training-dummy";
export const TRAINING_DUMMY_B_ID = "training-dummy-b";
export const TRAINING_DUMMY_C_ID = "training-dummy-c";

function freshTarget(): TargetCombatState {
  return { hp: 1000, maxHp: 1000, hitstun: false };
}

export type TargetCombatState = {
  hp: number;
  maxHp: number;
  hitstun: boolean;
};

type LastDamage = {
  targetId: string;
  amount: number;
  serial: number;
};

type CombatState = {
  attackId: string | null;
  attackPhase: AttackPhase;
  showHitboxes: boolean;
  lastActiveFrames: number;
  lastDamage: LastDamage | null;
  targets: Record<string, TargetCombatState>;
};

const initialState: CombatState = {
  attackId: null,
  attackPhase: ATTACK_PHASE.idle,
  showHitboxes: true,
  lastActiveFrames: 0,
  lastDamage: null,
  targets: {
    [PLAYER_FIGHTER_ID]: freshFighterHealth(),
    [OPPONENT_FIGHTER_ID]: freshFighterHealth(),
    [TRAINING_DUMMY_ID]: freshTarget(),
    [TRAINING_DUMMY_B_ID]: freshTarget(),
    [TRAINING_DUMMY_C_ID]: freshTarget(),
  },
};

const combatSlice = createSlice({
  name: "combat",
  initialState,
  reducers: {
    setAttackState(
      state,
      action: PayloadAction<{
        attackId: string | null;
        phase: AttackPhase;
        activeFrames: number | null;
      }>,
    ) {
      state.attackId = action.payload.attackId;
      state.attackPhase = action.payload.phase;
      if (action.payload.activeFrames !== null) {
        state.lastActiveFrames = action.payload.activeFrames;
      }
    },
    toggleShowHitboxes(state) {
      state.showHitboxes = !state.showHitboxes;
    },
    applyDamage(
      state,
      action: PayloadAction<{ targetId: string; amount: number; serial: number }>,
    ) {
      const target = state.targets[action.payload.targetId];
      if (!target) {
        return;
      }
      if (
        state.lastDamage?.serial === action.payload.serial &&
        state.lastDamage.targetId === action.payload.targetId
      ) {
        return;
      }
      target.hp = Math.max(0, target.hp - action.payload.amount);
      state.lastDamage = {
        targetId: action.payload.targetId,
        amount: action.payload.amount,
        serial: action.payload.serial,
      };
    },
    setTargetHitstun(
      state,
      action: PayloadAction<{ targetId: string; hitstun: boolean }>,
    ) {
      const target = state.targets[action.payload.targetId];
      if (!target) {
        return;
      }
      target.hitstun = action.payload.hitstun;
    },
    resetCombat() {
      return {
        attackId: null,
        attackPhase: ATTACK_PHASE.idle,
        showHitboxes: true,
        lastActiveFrames: 0,
        lastDamage: null,
        targets: {
          [PLAYER_FIGHTER_ID]: freshFighterHealth(),
          [OPPONENT_FIGHTER_ID]: freshFighterHealth(),
          [TRAINING_DUMMY_ID]: freshTarget(),
          [TRAINING_DUMMY_B_ID]: freshTarget(),
          [TRAINING_DUMMY_C_ID]: freshTarget(),
        },
      };
    },
  },
});

export const {
  setAttackState,
  toggleShowHitboxes,
  applyDamage,
  setTargetHitstun,
  resetCombat,
} = combatSlice.actions;

export default combatSlice.reducer;

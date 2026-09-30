import type { AnimationAction, Object3D } from "three";
import type { AttackDefinition, AttackPhase } from "@/lib/game/combat/types";
import type { LocomotionConfig } from "@/lib/game/locomotion";

export const characterIds = ["four-arms", "cannonbolt"] as const;

export type CharacterId = (typeof characterIds)[number];

export type ClipDef = {
  name: string;
  loop: boolean;
  /** Keyboard codes that preview this clip. Digit and numpad can both be listed. */
  debugKeys?: readonly string[];
};

export type ModelSlot = {
  id: string;
  url: string;
};

/** Per-frame presentation. Owned by the fighter, not a module global. */
export type FighterView = {
  form: string;
  speed: number;
};

export type LocomotionSample = {
  grounded: boolean;
  hasMoveInput: boolean;
  runHeld: boolean;
  speed: number;
  form: string;
};

export type ClipFinish =
  | { kind: "stay" }
  | { kind: "goto"; form: string; animation: string };

/**
 * How this alien walks when it is not performing a move.
 * Biped uses the shared idle/walk/run/jump selector. Cannonbolt's curl
 * machine implements the same hooks, so the physics step never branches on id.
 */
export type LocomotionDriver = {
  initialForm: string;
  holdPlanar(sample: LocomotionSample): boolean;
  /** Advance the walk cycle. Skip this while a move owns presentation. */
  step(sample: LocomotionSample): {
    form: string;
    animation: string;
    movementState: string;
  };
  /** Debug label for the current form. Does not advance the walk cycle. */
  label(sample: LocomotionSample): string;
  /**
   * undefined: this clip belongs to combat or to nobody.
   * stay: keep playing it.
   * goto: the transition clip finished.
   */
  onClipFinished(clipName: string, sample: LocomotionSample): ClipFinish | undefined;
};

export type AttackHudInput = {
  attackId: string | null;
  phase: AttackPhase;
  showHitboxes: boolean;
};

export type AttackHudRows = {
  phaseTitle: string;
  phaseLabel: string;
  attackTitle: string;
  hitboxTitle: string;
  hitboxLabel: string;
};

export type CharacterHud = {
  movementLabel: string;
  formatMovement: (state: string) => string;
  formatGrounded: (grounded: boolean) => string;
  showTargetsHit: boolean;
  attackHud: (input: AttackHudInput) => AttackHudRows;
};

export type CharacterInputPolicy = {
  /** Pressing one attack button clears the other. Cannonbolt does this. */
  exclusiveSlots: boolean;
  /** A press during a move waits until the move ends. Four Arms buffers punches. */
  bufferSlotsDuringAttack: boolean;
  /** When a locomotion clip ends, a queued attack can start. */
  bufferOnClipEnd: boolean;
};

export type PlaybackSync = {
  form: string;
  speed: number;
  actions: (
    slotId: string,
  ) => { [name: string]: AnimationAction | null | undefined } | undefined;
};

/** Mesh swap, materials, and playback rates. Omitted aliens use the default shade. */
export type CharacterVisual = {
  prepareModel?: (model: Object3D, slotId: string) => void;
  syncPlayback?: (input: PlaybackSync) => void;
};

export type CharacterDefinition = {
  id: CharacterId;
  name: string;
  defaultAnimation: string;
  models: readonly ModelSlot[];
  /** Which model slot is visible for this locomotion form. */
  visibleModel: (form: string) => string;
  clips: readonly ClipDef[];
  locomotion: LocomotionConfig;
  driver: LocomotionDriver;
  input: CharacterInputPolicy;
  moves: readonly AttackDefinition[];
  hud: CharacterHud;
};

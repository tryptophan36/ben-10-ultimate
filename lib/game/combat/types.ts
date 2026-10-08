import type { CameraShakeSpec } from "@/lib/game/camera/cameraShake";

export const ATTACK_PHASE = {
  idle: "IDLE",
  startup: "ATTACK_STARTUP",
  /** In the air, waiting for a real landing. Hitboxes stay off. */
  airborne: "AIRBORNE",
  active: "ATTACK_ACTIVE",
  recovery: "ATTACK_RECOVERY",
} as const;

export type AttackPhase = (typeof ATTACK_PHASE)[keyof typeof ATTACK_PHASE];

export type MoveSlot = "light" | "heavy";

export type MoveStartContext = {
  grounded: boolean;
  form: string;
  jumpPressed: boolean;
};

/**
 * What the shared physics step does with the body during this move.
 * rooted keeps the current velocities. dash is Fast Roll. launch is Body Slam.
 * A new kind of motion is one driver here, then every alien can reuse it.
 */
export type MoveMotion =
  | { kind: "rooted" }
  | {
      kind: "dash";
      acceleration: number;
      /** Speed cap once the active window opens. Startup only changes acceleration. */
      activeSpeed: number;
      /** With no stick input, dash along the facing yaw. */
      steer: boolean;
    }
  | {
      kind: "launch";
      lockPlanar: boolean;
      lockJump: boolean;
    };

/** Visible clip and locomotion form while the move is in progress. */
export type MovePresentation = {
  clip?: string;
  form?: string | ((phase: AttackPhase) => string);
};

export type Knockback = {
  /** Speed away from the attacker along their facing, in meters per second. */
  horizontal: number;
  /** Upward speed applied with the shove, in meters per second. */
  vertical: number;
};

export type MeleeHitbox = {
  bone: string;
  radius: number;
  /** Bone-local meters. Shifts the sphere from the joint onto the fist. */
  offset?: readonly [number, number, number];
};

export type BoneAxis = "x" | "y" | "z";

/**
 * A straight projectile fired from a bone. Position and direction are read
 * from that bone when `time` is reached. The shard is not a melee hitbox.
 */
export type ProjectileLaunch = {
  bone: string;
  axis: BoneAxis;
  /** Seconds into the attack clip. */
  time: number;
  /** Meters along the bone axis, so the shard clears the hand. */
  advance: number;
  speed: number;
  radius: number;
  /** Seconds in the air if it hits nothing. */
  lifetime: number;
};

/** Clip seconds. Visual only — never used to detect a landing. */
export type PoseWindow = {
  start: number;
  end: number;
};

/**
 * How a landing attack shows its clip. Airborne advances in real time and
 * holds at `end` until Rapier reports ground. The other windows scrub across
 * that phase's physics frames.
 */
export type AttackPose = {
  startup: PoseWindow;
  airborne: PoseWindow;
  active: PoseWindow;
  recovery: PoseWindow;
};

/**
 * Data for one attack. Frame counts are physics steps (60 Hz).
 * Later moves (projectiles, grabs, blocks) can sit beside this type
 * without changing how damage or phases are applied.
 */
export type AttackDefinition = {
  id: string;
  characterId: string;
  kind: "melee" | "projectile";
  /** Which button starts this move. Several light moves alternate. */
  slot: MoveSlot;
  /** Debug HUD label for that button. The first move in the slot is shown. */
  slotLabel: string;
  animation: string;
  damage: number;
  startup: number;
  active: number;
  recovery: number;
  knockback: Knockback;
  /** Gameplay freeze on a clean hit, in milliseconds. */
  hitstopMs: number;
  cameraShake: CameraShakeSpec;
  /** Size of the impact burst. 1 is a standard punch. */
  impactScale: number;
  /** How long the target stays in hitstun, in seconds. */
  hitstun: number;
  /** Source clip length in seconds. Recovery fills whatever frames remain. */
  clipDuration: number;
  interruptible: boolean;
  multiHit: boolean;
  hitboxes: MeleeHitbox[];
  /** Present for projectile moves. Melee moves omit it. */
  projectile?: ProjectileLaunch;
  /** Cut onto this clip instead of crossfading, so the frame windows stay put. */
  cutIn?: boolean;
  /**
   * clip follows the attack animation from frame 0.
   * elapsed counts physics frames from the moment the attack starts, so a
   * move can reuse a looping locomotion clip.
   * landing stays airborne until Rapier reports ground, then opens the active window.
   * Omitted attacks follow the clip.
   */
  clock?: "clip" | "elapsed" | "landing";
  /** facing shoves along the attacker's yaw. radial shoves away from their position. */
  knockbackStyle?: "facing" | "radial";
  /** Present only when the clip is a pose layered on the physics phase. */
  pose?: AttackPose;
  /** Omitted moves are rooted and do not change velocity. */
  motion?: MoveMotion;
  /** Omitted means the move can start from any pose. */
  canStart?: (ctx: MoveStartContext) => boolean;
  /**
   * Step the combat clock on the same physics frame the move starts.
   * Launch and dash moves need this so the shove happens before integration.
   * Punches omit it and arm on the following frame.
   */
  stepOnStart?: boolean;
  /** Locomotion form applied before integration on the start frame. */
  enterForm?: string;
  /** Rising off the ground ends the move. Fast Roll uses this. */
  cancelOnRise?: boolean;
  /** Mixer finished events are ignored while this move is the active one. */
  ignoreClipFinish?: boolean;
  /** When set, this move chooses the visible clip and form until it ends. */
  presentation?: MovePresentation;
};

export type DamageRequest = {
  amount: number;
  knockback: Knockback;
  hitstun: number;
  attacker: string;
  attackId: string;
  attackSerial: number;
  facingYaw: number;
  attackerX: number;
  attackerZ: number;
  hitX: number;
  hitY: number;
  hitZ: number;
  hitstopMs: number;
  cameraShake: CameraShakeSpec;
  impactScale: number;
  knockbackStyle?: "facing" | "radial";
};

export type Damageable = {
  id: string;
  takeDamage: (request: DamageRequest) => boolean;
};

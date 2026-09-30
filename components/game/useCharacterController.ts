"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useThree } from "@react-three/fiber";
import {
  useBeforePhysicsStep,
  useRapier,
  type RapierCollider,
  type RapierRigidBody,
} from "@react-three/rapier";
import { Vector3, type Group } from "three";
import { sameAnimationName } from "@/lib/game/animations";
import type { CharacterDefinition, FighterView, LocomotionSample } from "@/lib/game/characters";
import { attacksForCharacter, attackById } from "@/lib/game/combat/attacks";
import { isHitstopActive } from "@/lib/game/combat/hitstop";
import {
  influenceForMove,
  movesForSlot,
  presentationClip,
  presentationForm,
} from "@/lib/game/combat/motion";
import {
  attackRuntime,
  endAttackInstance,
  stepAttackClock,
  type AttackClock,
} from "@/lib/game/combat/runtime";
import {
  ATTACK_PHASE,
  type AttackDefinition,
  type AttackPhase,
  type MoveSlot,
} from "@/lib/game/combat/types";
import {
  capsuleHalfExtent,
  stepYaw,
  yawForDirection,
} from "@/lib/game/locomotion";
import { PHYSICS_TIMESTEP } from "@/lib/game/physics";
import { playerFocus, publishControllerDebug } from "@/lib/game/runtime";
import { useAppDispatch } from "@/store/hooks";
import { setAttackState } from "@/store/slices/combatSlice";
import { playAnimation } from "@/store/slices/gameSlice";
import { useGameInput, type GameInputState } from "@/components/game/useGameInput";

const WORLD_UP = new Vector3(0, 1, 0);
const SLOT_ORDER: readonly MoveSlot[] = ["light", "heavy"];

type Motion = {
  vx: number;
  vz: number;
  vy: number;
  yaw: number;
  grounded: boolean;
  canJump: boolean;
  coyote: number;
  attackId: string | null;
  attackStartedAt: number;
  slotCursor: Partial<Record<MoveSlot, number>>;
  lastAnimation: string;
  form: string;
  hasMoveInput: boolean;
  runHeld: boolean;
  speed: number;
};

type CharacterControllerOptions = {
  bodyRef: RefObject<RapierRigidBody | null>;
  colliderRef: RefObject<RapierCollider | null>;
  visualRef: RefObject<Group | null>;
  viewRef: RefObject<FighterView>;
  character: CharacterDefinition;
};

function sampleOf(motion: Motion): LocomotionSample {
  return {
    grounded: motion.grounded,
    hasMoveInput: motion.hasMoveInput,
    runHeld: motion.runHeld,
    speed: motion.speed,
    form: motion.form,
  };
}

function consumeSlot(input: GameInputState, slot: MoveSlot, exclusive: boolean): boolean {
  const pressed = slot === "light" ? input.light : input.heavy;
  if (!pressed) {
    return false;
  }
  if (exclusive) {
    input.light = false;
    input.heavy = false;
  } else if (slot === "light") {
    input.light = false;
  } else {
    input.heavy = false;
  }
  return true;
}

/** Arms the move for this slot. The caller decides whether to step the clock now. */
function startMove(
  character: CharacterDefinition,
  motion: Motion,
  input: GameInputState,
  now: number,
): AttackDefinition | null {
  if (motion.attackId) {
    const current = attackById(motion.attackId);
    if (!current?.interruptible) {
      return null;
    }
  }

  for (const slot of SLOT_ORDER) {
    if (!consumeSlot(input, slot, character.input.exclusiveSlots)) {
      continue;
    }
    const options = movesForSlot(character.moves, slot);
    const move = options[(motion.slotCursor[slot] ?? 0) % options.length];
    if (!move) {
      return null;
    }
    if (
      move.canStart &&
      !move.canStart({
        grounded: motion.grounded,
        form: motion.form,
        jumpPressed: input.jump,
      })
    ) {
      return null;
    }
    motion.slotCursor[slot] = (motion.slotCursor[slot] ?? 0) + 1;
    motion.attackId = move.id;
    motion.attackStartedAt = now;
    if (move.enterForm) {
      motion.form = move.enterForm;
    }
    return move;
  }
  return null;
}

function tickAttack(
  character: CharacterDefinition,
  motion: Motion,
  now: number,
  grounded: boolean,
): AttackClock {
  const attack = motion.attackId ? attackById(motion.attackId) : undefined;
  const clock = stepAttackClock({
    animationName: attack?.animation ?? null,
    attackerId: character.id,
    now,
    startedAt: motion.attackStartedAt,
    lockSeconds: character.locomotion.attackLockSeconds,
    grounded,
  });
  if (clock.ended) {
    motion.attackId = null;
  }
  return clock;
}

function clipIsAttack(character: CharacterDefinition, clipName: string): AttackDefinition | undefined {
  return attacksForCharacter(character.id).find(
    (attack) =>
      sameAnimationName(attack.animation, clipName) ||
      (attack.presentation?.clip !== undefined &&
        sameAnimationName(attack.presentation.clip, clipName)),
  );
}

export function useCharacterController({
  bodyRef,
  colliderRef,
  visualRef,
  viewRef,
  character,
}: CharacterControllerOptions) {
  const dispatch = useAppDispatch();
  const { world, rapier } = useRapier();
  const { camera } = useThree();
  const inputRef = useGameInput();
  const config = character.locomotion;
  const controllerRef = useRef<ReturnType<typeof world.createCharacterController> | null>(null);
  const motionRef = useRef<Motion>({
    vx: 0,
    vz: 0,
    vy: 0,
    yaw: 0,
    grounded: true,
    canJump: true,
    coyote: config.coyoteTime,
    attackId: null,
    attackStartedAt: 0,
    slotCursor: {},
    lastAnimation: character.defaultAnimation,
    form: character.driver.initialForm,
    hasMoveInput: false,
    runHeld: false,
    speed: 0,
  });
  const forward = useRef(new Vector3());
  const right = useRef(new Vector3());
  const wish = useRef(new Vector3());
  const publishedCombat = useRef<{ attackId: string | null; phase: AttackPhase }>({
    attackId: null,
    phase: ATTACK_PHASE.idle,
  });

  useEffect(() => {
    const controller = world.createCharacterController(config.colliderOffset);
    controller.setUp({ x: 0, y: 1, z: 0 });
    controller.setSlideEnabled(true);
    controller.enableSnapToGround(config.snapToGround);
    controller.enableAutostep(config.autostepMaxHeight, config.autostepMinWidth, true);
    controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    controller.setMinSlopeSlideAngle((55 * Math.PI) / 180);
    controller.setApplyImpulsesToDynamicBodies(true);
    controller.setCharacterMass(config.mass);
    controllerRef.current = controller;

    return () => {
      controller.free();
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    };
  }, [config, world]);

  const publishCombat = useCallback(
    (attackId: string | null, phase: AttackPhase, activeFrames: number | null) => {
      const published = publishedCombat.current;
      if (published.attackId === attackId && published.phase === phase && activeFrames === null) {
        return;
      }
      published.attackId = attackId;
      published.phase = phase;
      dispatch(setAttackState({ attackId, phase, activeFrames }));
    },
    [dispatch],
  );

  const requestAnimation = useCallback(
    (name: string) => {
      const motion = motionRef.current;
      if (sameAnimationName(motion.lastAnimation, name)) {
        return;
      }
      motion.lastAnimation = name;
      dispatch(playAnimation(name));
    },
    [dispatch],
  );

  const releaseToLocomotion = useCallback(
    (motion: Motion): string | null => {
      if (character.input.bufferOnClipEnd) {
        const started = startMove(character, motion, inputRef.current, performance.now());
        if (started) {
          const clip = presentationClip(started);
          motion.lastAnimation = clip;
          viewRef.current.form = motion.form;
          return clip;
        }
      }
      const stepped = character.driver.step(sampleOf(motion));
      motion.form = stepped.form;
      viewRef.current.form = stepped.form;
      if (sameAnimationName(motion.lastAnimation, stepped.animation)) {
        return null;
      }
      motion.lastAnimation = stepped.animation;
      return stepped.animation;
    },
    [character, inputRef, viewRef],
  );

  const onOneShotFinished = useCallback(
    (clipName: string) => {
      const motion = motionRef.current;
      const active = motion.attackId ? attackById(motion.attackId) : undefined;
      if (active?.ignoreClipFinish) {
        return null;
      }

      const matched = clipIsAttack(character, clipName);
      if (matched?.ignoreClipFinish) {
        return null;
      }
      if (matched) {
        if (
          attackRuntime.phase === ATTACK_PHASE.startup ||
          attackRuntime.phase === ATTACK_PHASE.active
        ) {
          return null;
        }
        if (attackRuntime.live) {
          motion.attackId = null;
          endAttackInstance();
        }
        return releaseToLocomotion(motion);
      }

      const result = character.driver.onClipFinished(clipName, sampleOf(motion));
      if (!result) {
        if (!character.input.bufferOnClipEnd) {
          return null;
        }
        return releaseToLocomotion(motion);
      }
      if (result.kind === "stay") {
        return null;
      }

      motion.form = result.form;
      viewRef.current.form = result.form;
      if (character.input.bufferOnClipEnd) {
        const started = startMove(character, motion, inputRef.current, performance.now());
        if (started) {
          const clip = presentationClip(started);
          motion.lastAnimation = clip;
          viewRef.current.form = motion.form;
          return clip;
        }
      }
      if (sameAnimationName(motion.lastAnimation, result.animation)) {
        return null;
      }
      motion.lastAnimation = result.animation;
      return result.animation;
    },
    [character, inputRef, releaseToLocomotion, viewRef],
  );

  const step = useCallback(() => {
    const controller = controllerRef.current;
    const body = bodyRef.current;
    const collider = colliderRef.current;
    if (!controller || !body || !collider) {
      return;
    }

    if (isHitstopActive()) {
      const position = body.translation();
      body.setNextKinematicTranslation({
        x: position.x,
        y: position.y,
        z: position.z,
      });
      return;
    }

    const dt = PHYSICS_TIMESTEP;
    const input = inputRef.current;
    const motion = motionRef.current;
    const now = performance.now();

    camera.getWorldDirection(forward.current);
    forward.current.y = 0;
    if (forward.current.lengthSq() < 1e-8) {
      forward.current.set(0, 0, 1);
    } else {
      forward.current.normalize();
    }
    right.current.crossVectors(forward.current, WORLD_UP).normalize();

    wish.current.set(0, 0, 0);
    if (input.forward !== 0 || input.strafe !== 0) {
      wish.current.addScaledVector(forward.current, input.forward);
      wish.current.addScaledVector(right.current, input.strafe);
      if (wish.current.lengthSq() > 1) {
        wish.current.normalize();
      }
    }

    const hasMoveInput = wish.current.lengthSq() > 0.0001;
    if (motion.attackId && !character.input.bufferSlotsDuringAttack) {
      input.light = false;
      input.heavy = false;
    }

    let phase: AttackPhase = ATTACK_PHASE.idle;
    let launch = false;
    const acceptClock = (clock: AttackClock) => {
      phase = clock.phase;
      launch = clock.launch === true;
      publishCombat(clock.attackId, clock.phase, clock.activeFrames);
    };

    if (motion.attackId) {
      acceptClock(tickAttack(character, motion, now, motion.grounded));
    }
    if (!motion.attackId) {
      const started = startMove(character, motion, input, now);
      if (started?.stepOnStart) {
        acceptClock(tickAttack(character, motion, now, motion.grounded));
      }
    }

    const attack = motion.attackId ? attackById(motion.attackId) : undefined;
    const influence = influenceForMove(attack, phase, config.acceleration);
    if (influence.steerAlongYaw && !hasMoveInput) {
      wish.current.set(Math.sin(motion.yaw), 0, Math.cos(motion.yaw));
    }

    const propel = wish.current.lengthSq() > 0.0001;
    const holdPlanar = character.driver.holdPlanar({
      grounded: motion.grounded,
      hasMoveInput,
      runHeld: input.run,
      speed: motion.speed,
      form: motion.form,
    });
    const targetSpeed = influence.speedCap ?? (input.run ? config.runSpeed : config.walkSpeed);
    const targetX = !holdPlanar && propel ? wish.current.x * targetSpeed : 0;
    const targetZ = !holdPlanar && propel ? wish.current.z * targetSpeed : 0;
    if (influence.lockPlanar || holdPlanar) {
      motion.vx = 0;
      motion.vz = 0;
    } else {
      const rate = propel ? influence.acceleration : config.deceleration;
      const maxDelta = rate * dt;
      const deltaX = targetX - motion.vx;
      const deltaZ = targetZ - motion.vz;
      const deltaLength = Math.hypot(deltaX, deltaZ);
      if (deltaLength <= maxDelta || deltaLength === 0) {
        motion.vx = targetX;
        motion.vz = targetZ;
      } else {
        motion.vx += (deltaX / deltaLength) * maxDelta;
        motion.vz += (deltaZ / deltaLength) * maxDelta;
      }
    }

    const jumpPressed = input.jump;
    input.jump = false;
    if (launch) {
      motion.vy = config.jumpVelocity;
      motion.canJump = false;
      motion.grounded = false;
      motion.coyote = 0;
    } else if (
      jumpPressed &&
      !influence.lockJump &&
      motion.canJump &&
      (motion.grounded || motion.coyote > 0)
    ) {
      motion.vy = config.jumpVelocity;
      motion.canJump = false;
      motion.grounded = false;
      motion.coyote = 0;
    }

    if (!motion.grounded) {
      motion.vy = Math.max(config.maxFallSpeed, motion.vy + config.gravity * dt);
    }

    if (motion.vy > 0) {
      controller.disableSnapToGround();
    } else {
      controller.enableSnapToGround(config.snapToGround);
    }

    const moveY = motion.grounded ? -config.groundProbeSpeed * dt : motion.vy * dt;
    controller.computeColliderMovement(
      collider,
      { x: motion.vx * dt, y: moveY, z: motion.vz * dt },
      rapier.QueryFilterFlags.EXCLUDE_SENSORS,
    );

    const corrected = controller.computedMovement();
    const moveX = corrected.x;
    const correctedY = corrected.y;
    const moveZ = corrected.z;
    const position = body.translation();
    const nextX = position.x + moveX;
    const nextY = position.y + correctedY;
    const nextZ = position.z + moveZ;
    body.setNextKinematicTranslation({ x: nextX, y: nextY, z: nextZ });

    const rising = motion.vy > 0.05;
    const supported = controller.computedGrounded() && !rising;
    if (supported) {
      motion.grounded = true;
      motion.canJump = true;
      motion.coyote = config.coyoteTime;
      motion.vy = 0;
    } else {
      motion.grounded = false;
      motion.coyote = Math.max(0, motion.coyote - dt);
      if (rising && correctedY <= 0) {
        motion.vy = 0;
      }
    }

    const faceX = hasMoveInput ? wish.current.x : motion.vx;
    const faceZ = hasMoveInput ? wish.current.z : motion.vz;
    if (Math.hypot(faceX, faceZ) > 0.05) {
      motion.yaw = stepYaw(
        motion.yaw,
        yawForDirection(faceX, faceZ, config.modelYawOffset),
        config.turnSpeed,
        dt,
      );
    }
    if (visualRef.current) {
      visualRef.current.rotation.y = motion.yaw;
    }

    if (attack?.cancelOnRise && motion.attackId === attack.id && !motion.grounded && motion.vy > 0.05) {
      const activeFrames =
        attackRuntime.phase === ATTACK_PHASE.active ? attackRuntime.activeFrames : null;
      motion.attackId = null;
      endAttackInstance();
      publishCombat(null, ATTACK_PHASE.idle, activeFrames);
    }

    const actualSpeed = Math.hypot(moveX, moveZ) / dt;
    motion.speed = actualSpeed;
    motion.hasMoveInput = hasMoveInput;
    motion.runHeld = input.run;

    const playing = motion.attackId ? attackById(motion.attackId) : undefined;
    let movementState: string;
    if (playing) {
      if (playing.presentation) {
        motion.form = presentationForm(playing, phase, motion.form);
      }
      requestAnimation(presentationClip(playing));
      movementState = character.driver.label(sampleOf(motion));
    } else {
      const stepped = character.driver.step(sampleOf(motion));
      motion.form = stepped.form;
      requestAnimation(stepped.animation);
      movementState = stepped.movementState;
    }
    viewRef.current.form = motion.form;
    viewRef.current.speed = actualSpeed;

    const halfExtent = capsuleHalfExtent(config);
    playerFocus.feet.set(nextX, nextY - halfExtent - config.colliderOffset, nextZ);
    playerFocus.yaw = motion.yaw;
    playerFocus.attack = playing?.animation ?? null;

    publishControllerDebug(
      {
        movementState,
        grounded: motion.grounded,
        speed: actualSpeed,
      },
      now,
    );
  }, [
    bodyRef,
    camera,
    character,
    colliderRef,
    config,
    inputRef,
    publishCombat,
    rapier,
    requestAnimation,
    viewRef,
    visualRef,
  ]);

  useEffect(() => {
    return () => {
      endAttackInstance();
    };
  }, []);

  useBeforePhysicsStep(step);

  return { onOneShotFinished };
}

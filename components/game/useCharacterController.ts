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
import { attackForAnimation } from "@/lib/game/combat/attacks";
import { isHitstopActive } from "@/lib/game/combat/hitstop";
import {
  attackRuntime,
  endAttackInstance,
  stepAttackClock,
} from "@/lib/game/combat/runtime";
import { ATTACK_PHASE, type AttackPhase } from "@/lib/game/combat/types";
import {
  animationForMovement,
  capsuleHalfExtent,
  isAttackAnimation,
  selectMovementState,
  stepYaw,
  yawForDirection,
  type LocomotionConfig,
  type MovementState,
} from "@/lib/game/locomotion";
import { PHYSICS_TIMESTEP } from "@/lib/game/physics";
import { playerFocus, publishControllerDebug } from "@/lib/game/runtime";
import { useAppDispatch } from "@/store/hooks";
import { setAttackState } from "@/store/slices/combatSlice";
import { playAnimation } from "@/store/slices/gameSlice";
import { useGameInput, type GameInputState } from "@/components/game/useGameInput";

const WORLD_UP = new Vector3(0, 1, 0);

type Motion = {
  vx: number;
  vz: number;
  vy: number;
  yaw: number;
  grounded: boolean;
  canJump: boolean;
  coyote: number;
  attack: string | null;
  attackStartedAt: number;
  lastAnimation: string;
  hasMoveInput: boolean;
  runHeld: boolean;
  speed: number;
};

type CharacterControllerOptions = {
  bodyRef: RefObject<RapierRigidBody | null>;
  colliderRef: RefObject<RapierCollider | null>;
  visualRef: RefObject<Group | null>;
  config: LocomotionConfig;
  attackerId: string;
};

function consumeAttack(
  input: GameInputState,
  config: LocomotionConfig,
  motion: Motion,
  now: number,
): string | null {
  if (motion.attack) {
    const current = attackForAnimation(motion.attack);
    if (!current?.interruptible) {
      return null;
    }
  }

  const name = input.punch
    ? config.animations.punch
    : input.heavyPunch
      ? config.animations.heavyPunch
      : null;
  if (!name) {
    return null;
  }

  if (name === config.animations.punch) {
    input.punch = false;
  } else {
    input.heavyPunch = false;
  }

  motion.attack = name;
  motion.attackStartedAt = now;
  return name;
}

export function useCharacterController({
  bodyRef,
  colliderRef,
  visualRef,
  config,
  attackerId,
}: CharacterControllerOptions) {
  const dispatch = useAppDispatch();
  const { world, rapier } = useRapier();
  const { camera } = useThree();
  const inputRef = useGameInput();
  const controllerRef = useRef<ReturnType<
    typeof world.createCharacterController
  > | null>(null);
  const motionRef = useRef<Motion>({
    vx: 0,
    vz: 0,
    vy: 0,
    yaw: 0,
    grounded: true,
    canJump: true,
    coyote: config.coyoteTime,
    attack: null,
    attackStartedAt: 0,
    lastAnimation: config.animations.idle,
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
    controller.enableAutostep(
      config.autostepMaxHeight,
      config.autostepMinWidth,
      true,
    );
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
      if (
        published.attackId === attackId &&
        published.phase === phase &&
        activeFrames === null
      ) {
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

  const movementSnapshot = useCallback(() => {
    const motion = motionRef.current;
    return selectMovementState(config, {
      grounded: motion.grounded,
      speed: motion.speed,
      runHeld: motion.runHeld,
      hasMoveInput: motion.hasMoveInput,
    });
  }, [config]);

  const onOneShotFinished = useCallback(
    (clipName: string) => {
      const motion = motionRef.current;
      if (isAttackAnimation(config, clipName)) {
        if (
          attackRuntime.phase === ATTACK_PHASE.startup ||
          attackRuntime.phase === ATTACK_PHASE.active
        ) {
          return null;
        }
        if (attackRuntime.live) {
          motion.attack = null;
          endAttackInstance();
        }
      }

      if (motion.attack) {
        motion.lastAnimation = motion.attack;
        return motion.attack;
      }

      if (
        sameAnimationName(clipName, config.animations.jump) &&
        !motion.grounded
      ) {
        return null;
      }

      const now = performance.now();
      const buffered = consumeAttack(inputRef.current, config, motion, now);
      if (buffered) {
        motion.lastAnimation = buffered;
        return buffered;
      }

      const next = animationForMovement(config, movementSnapshot());
      if (sameAnimationName(motion.lastAnimation, next)) {
        return null;
      }
      motion.lastAnimation = next;
      return next;
    },
    [config, inputRef, movementSnapshot],
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
    const targetSpeed = input.run ? config.runSpeed : config.walkSpeed;
    const targetX = hasMoveInput ? wish.current.x * targetSpeed : 0;
    const targetZ = hasMoveInput ? wish.current.z * targetSpeed : 0;
    const rate = hasMoveInput ? config.acceleration : config.deceleration;
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

    const jumpPressed = input.jump;
    input.jump = false;
    if (
      jumpPressed &&
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

    const moveY = motion.grounded
      ? -config.groundProbeSpeed * dt
      : motion.vy * dt;

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

    const actualSpeed = Math.hypot(moveX, moveZ) / dt;
    motion.speed = actualSpeed;
    motion.hasMoveInput = hasMoveInput;
    motion.runHeld = input.run;

    const clock = stepAttackClock({
      animationName: motion.attack,
      attackerId,
      now,
      startedAt: motion.attackStartedAt,
      lockSeconds: config.attackLockSeconds,
    });
    if (clock.ended) {
      motion.attack = null;
    }
    publishCombat(clock.attackId, clock.phase, clock.activeFrames);

    let movementState: MovementState;
    if (!motion.attack) {
      const buffered = consumeAttack(input, config, motion, now);
      if (buffered) {
        requestAnimation(buffered);
        movementState = movementSnapshot();
      } else {
        movementState = movementSnapshot();
        requestAnimation(animationForMovement(config, movementState));
      }
    } else {
      movementState = movementSnapshot();
    }

    const halfExtent = capsuleHalfExtent(config);
    playerFocus.feet.set(
      nextX,
      nextY - halfExtent - config.colliderOffset,
      nextZ,
    );
    playerFocus.yaw = motion.yaw;
    playerFocus.attack = motion.attack;

    publishControllerDebug(
      {
        movementState,
        grounded: motion.grounded,
        speed: actualSpeed,
      },
      now,
    );
  }, [
    attackerId,
    bodyRef,
    camera,
    colliderRef,
    config,
    inputRef,
    movementSnapshot,
    publishCombat,
    rapier,
    requestAnimation,
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

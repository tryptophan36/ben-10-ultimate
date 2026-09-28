"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  CapsuleCollider,
  interactionGroups,
  RigidBody,
  useAfterPhysicsStep,
  type RapierRigidBody,
} from "@react-three/rapier";
import { Mesh, MeshStandardMaterial } from "three";
import { publishLiveKnockback } from "@/lib/game/combat/feelDebug";
import { emitHitFeedback } from "@/lib/game/combat/hitFeedback";
import { holdForHitstop, isHitstopActive } from "@/lib/game/combat/hitstop";
import { visibleContactPoint } from "@/lib/game/combat/impactVfx";
import { knockbackVelocity } from "@/lib/game/combat/knockback";
import { registerHurtbox } from "@/lib/game/combat/runtime";
import type { DamageRequest } from "@/lib/game/combat/types";
import { physicsGroups } from "@/lib/game/physics";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  applyDamage,
  setTargetHitstun,
  TRAINING_DUMMY_ID,
} from "@/store/slices/combatSlice";

const DUMMY_RADIUS = 0.32;
const DUMMY_HALF_HEIGHT = 0.62;
const DUMMY_SPAWN: [number, number, number] = [
  -0.45,
  DUMMY_HALF_HEIGHT + DUMMY_RADIUS,
  1.05,
];
const DUMMY_CAPSULE_ARGS: [number, number] = [DUMMY_HALF_HEIGHT, DUMMY_RADIUS];
const LOCKED_ROTATIONS: [boolean, boolean, boolean] = [false, false, false];
const HIT_FLASH_MS = 90;
const CONTACT_SURFACE = DUMMY_RADIUS + 0.08;
const DUMMY_GROUPS = interactionGroups(
  [physicsGroups.fighter, physicsGroups.hurtbox],
  [physicsGroups.stage, physicsGroups.fighter, physicsGroups.hitbox],
);

type Floater = {
  id: number;
  amount: number;
};

function FloatingDamage({
  amount,
  id,
  onDone,
}: {
  amount: number;
  id: number;
  onDone: (id: number) => void;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const started = useRef(0);

  useEffect(() => {
    started.current = performance.now();
    const timer = window.setTimeout(() => onDone(id), 720);
    return () => window.clearTimeout(timer);
  }, [id, onDone]);

  useFrame(() => {
    const node = nodeRef.current;
    if (!node) {
      return;
    }
    const t = Math.min(1, (performance.now() - started.current) / 700);
    node.style.transform = `translateY(${-40 * t}px)`;
    node.style.opacity = String(1 - t);
  });

  return (
    <Html position={[0.4, 0.85, 0]} center style={{ pointerEvents: "none" }}>
      <div
        ref={nodeRef}
        className={
          amount >= 20
            ? "font-mono text-2xl font-bold text-orange-200"
            : "font-mono text-xl font-bold text-amber-300"
        }
      >
        {amount}
      </div>
    </Html>
  );
}

function stopBody(body: RapierRigidBody): void {
  body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  body.setGravityScale(0, true);
}

function queueKnockback(body: RapierRigidBody, request: DamageRequest): void {
  if (!body.isValid()) {
    return;
  }
  const position = body.translation();
  const velocity = knockbackVelocity(
    request.facingYaw,
    request.knockback,
    position.x,
    position.z,
    request.attackerX,
    request.attackerZ,
    request.knockbackStyle ?? "facing",
  );
  const gravity = body.gravityScale();
  stopBody(body);
  holdForHitstop({
    pin: () => {
      if (!body.isValid()) {
        return;
      }
      stopBody(body);
    },
    release: () => {
      if (!body.isValid()) {
        return;
      }
      body.setGravityScale(gravity, true);
      body.setLinvel(velocity, true);
    },
  });
}

type TrainingDummyProps = {
  id?: string;
  position?: [number, number, number];
  label?: string;
};

export function trainingDummyHeight(): number {
  return DUMMY_HALF_HEIGHT + DUMMY_RADIUS;
}

export function TrainingDummy({
  id = TRAINING_DUMMY_ID,
  position = DUMMY_SPAWN,
  label = "Training Dummy",
}: TrainingDummyProps = {}) {
  const spawn = position;
  const dispatch = useAppDispatch();
  const target = useAppSelector((state) => state.combat.targets[id]);
  const showHitboxes = useAppSelector((state) => state.combat.showHitboxes);
  const bodyRef = useRef<RapierRigidBody>(null);
  const meshRef = useRef<Mesh>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const lastSerial = useRef(-1);
  const hpRef = useRef(target?.hp ?? 0);
  const hitstunLeft = useRef(0);
  const stunPublished = useRef(false);
  const flashUntil = useRef(0);
  const showDebugRef = useRef(showHitboxes);
  const knockbackPublish = useRef(0);
  const detachRef = useRef<(() => void) | null>(null);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const capsuleLength = DUMMY_HALF_HEIGHT * 2;
  const capsuleGeometry = useMemo(
    () => [DUMMY_RADIUS, capsuleLength, 8, 16] as [number, number, number, number],
    [capsuleLength],
  );

  useEffect(() => {
    hpRef.current = target?.hp ?? 0;
  }, [target?.hp]);

  useEffect(() => {
    showDebugRef.current = showHitboxes;
  }, [showHitboxes]);

  const dismissFloater = useCallback((id: number) => {
    setFloaters((current) => current.filter((floater) => floater.id !== id));
  }, []);

  const takeDamage = useCallback(
    (request: DamageRequest) => {
      if (hpRef.current <= 0) {
        return false;
      }
      if (lastSerial.current === request.attackSerial) {
        return false;
      }
      lastSerial.current = request.attackSerial;
      hpRef.current = Math.max(0, hpRef.current - request.amount);

      dispatch(
        applyDamage({
          targetId: id,
          amount: request.amount,
          serial: request.attackSerial,
        }),
      );
      setFloaters((current) => [
        ...current,
        { id: request.attackSerial, amount: request.amount },
      ]);

      const body = bodyRef.current;
      let feedback = request;
      if (body) {
        const center = body.translation();
        const contact = visibleContactPoint(
          { x: request.hitX, y: request.hitY, z: request.hitZ },
          { x: center.x, y: center.y, z: center.z },
          CONTACT_SURFACE,
        );
        feedback = {
          ...request,
          hitX: contact.x,
          hitY: contact.y,
          hitZ: contact.z,
        };
      }

      emitHitFeedback(feedback);
      if (body) {
        queueKnockback(body, feedback);
      }

      hitstunLeft.current = request.hitstun;
      flashUntil.current = performance.now() + HIT_FLASH_MS;
      if (!stunPublished.current) {
        stunPublished.current = true;
        dispatch(setTargetHitstun({ targetId: id, hitstun: true }));
      }

      return true;
    },
    [dispatch, id],
  );

  const takeDamageRef = useRef(takeDamage);
  useEffect(() => {
    takeDamageRef.current = takeDamage;
  }, [takeDamage]);

  useAfterPhysicsStep(() => {
    if (detachRef.current) {
      return;
    }
    const body = bodyRef.current;
    if (!body) {
      return;
    }
    detachRef.current = registerHurtbox(body.handle, {
      id,
      takeDamage: (request) => takeDamageRef.current(request),
    });
  });

  useEffect(() => {
    return () => {
      detachRef.current?.();
      detachRef.current = null;
    };
  }, []);

  useFrame((_, delta) => {
    if (hitstunLeft.current > 0 && !isHitstopActive()) {
      hitstunLeft.current = Math.max(0, hitstunLeft.current - Math.min(delta, 0.05));
      if (hitstunLeft.current === 0 && stunPublished.current) {
        stunPublished.current = false;
        dispatch(setTargetHitstun({ targetId: id, hitstun: false }));
      }
    }

    const mesh = meshRef.current;
    const material = mesh?.material;
    const flashing = performance.now() < flashUntil.current;
    const stunned = hitstunLeft.current > 0;
    if (material instanceof MeshStandardMaterial) {
      material.color.setHex(flashing ? 0xfff6ef : stunned ? 0xf0a8a4 : 0xd9d3cb);
      material.emissive.setHex(flashing ? 0xffffff : stunned ? 0xff2a2a : 0x000000);
      material.emissiveIntensity = flashing ? 1.6 : stunned ? 0.7 : 0;
    }
    if (mesh) {
      mesh.position.z = stunned ? -Math.min(hitstunLeft.current / 0.18, 1) * 0.08 : 0;
    }

    const label = labelRef.current;
    const body = bodyRef.current;
    if (!label || !body) {
      return;
    }
    const position = body.translation();
    label.dataset.x = position.x.toFixed(2);
    label.dataset.z = position.z.toFixed(2);
    if (showDebugRef.current && performance.now() - knockbackPublish.current > 100) {
      knockbackPublish.current = performance.now();
      const velocity = body.linvel();
      publishLiveKnockback(Math.hypot(velocity.x, velocity.z));
    }
    if (position.y < -2) {
      body.setTranslation(
        { x: spawn[0], y: spawn[1], z: spawn[2] },
        true,
      );
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setGravityScale(1, true);
    }
  });

  const hp = target?.hp ?? 0;
  const maxHp = target?.maxHp ?? 100;

  return (
    <RigidBody
      ref={bodyRef}
      name={id}
      colliders={false}
      position={spawn}
      enabledRotations={LOCKED_ROTATIONS}
      linearDamping={0.6}
      angularDamping={1}
      friction={0.9}
      restitution={0}
      canSleep={false}
      ccd
    >
      <CapsuleCollider
        args={DUMMY_CAPSULE_ARGS}
        collisionGroups={DUMMY_GROUPS}
        friction={0.9}
        restitution={0}
      />
      <mesh ref={meshRef} castShadow receiveShadow>
        <capsuleGeometry args={capsuleGeometry} />
        <meshStandardMaterial color="#d9d3cb" roughness={0.7} metalness={0} />
      </mesh>
      <Html position={[0, 1.35, 0]} center style={{ pointerEvents: "none" }}>
        <div
          ref={labelRef}
          data-dummy-root="true"
          data-dummy-hp={hp}
          className="whitespace-nowrap rounded bg-black/75 px-2 py-1 text-center font-mono text-white"
        >
          <div className="text-[10px] tracking-wider text-zinc-400 uppercase">
            {label}
          </div>
          <div className={target?.hitstun ? "text-red-300" : "text-white"}>
            {hp} / {maxHp}
            {target?.hitstun ? "  stun" : ""}
          </div>
        </div>
      </Html>
      {floaters.map((floater) => (
        <FloatingDamage
          key={floater.id}
          id={floater.id}
          amount={floater.amount}
          onDone={dismissFloater}
        />
      ))}
    </RigidBody>
  );
}

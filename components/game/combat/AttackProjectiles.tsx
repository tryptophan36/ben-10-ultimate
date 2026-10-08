"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BallCollider,
  interactionGroups,
  RigidBody,
  useAfterPhysicsStep,
  useBeforePhysicsStep,
  useRapier,
  type RapierCollider,
  type RapierRigidBody,
} from "@react-three/rapier";
import { Quaternion, Vector3, type Object3D } from "three";
import { sameAnimationName } from "@/lib/game/animations";
import { attacksForCharacter } from "@/lib/game/combat/attacks";
import { isHitstopActive } from "@/lib/game/combat/hitstop";
import {
  getAttackRuntime,
  readClipClock,
  rigidBodyFighter,
  subscribeCombatReset,
  tryProjectileHit,
  type ProjectileStrike,
} from "@/lib/game/combat/runtime";
import type { AttackDefinition, BoneAxis, ProjectileLaunch } from "@/lib/game/combat/types";
import { HIT_COLLISION_TYPES, PHYSICS_TIMESTEP, physicsGroups } from "@/lib/game/physics";
import { useAppSelector } from "@/store/hooks";

const HITBOX_GROUPS = interactionGroups([physicsGroups.hitbox], [physicsGroups.hurtbox]);
const AXIS: Record<BoneAxis, Vector3> = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1),
};
const UP = new Vector3(0, 1, 0);
const scratchPosition = new Vector3();
const scratchDirection = new Vector3();
const scratchQuaternion = new Quaternion();

type Shot = {
  id: number;
  fighterId: string;
  radius: number;
  speed: number;
  lifetime: number;
  position: [number, number, number];
  direction: [number, number, number];
  quaternion: [number, number, number, number];
  strike: ProjectileStrike;
};

type AttackProjectilesProps = {
  characterId: string;
  fighterId: string;
  model: Object3D;
  visualRef: RefObject<Object3D | null>;
};

let nextShotId = 1;

function findNamed(model: Object3D, name: string): Object3D | null {
  let found: Object3D | null = null;
  model.traverse((object) => {
    if (!found && object.name === name) {
      found = object;
    }
  });
  return found;
}

function projectileMoves(characterId: string): AttackDefinition[] {
  return attacksForCharacter(characterId).filter((attack) => attack.projectile);
}

function aimFromBone(
  bone: Object3D,
  launch: ProjectileLaunch,
): { position: Vector3; direction: Vector3; quaternion: Quaternion } | null {
  bone.updateWorldMatrix(true, false);
  bone.getWorldPosition(scratchPosition);
  bone.getWorldQuaternion(scratchQuaternion);
  scratchDirection.copy(AXIS[launch.axis]).applyQuaternion(scratchQuaternion);
  if (scratchDirection.lengthSq() < 1e-6) {
    return null;
  }
  scratchDirection.normalize();
  scratchPosition.addScaledVector(scratchDirection, launch.advance);
  const quaternion = new Quaternion().setFromUnitVectors(UP, scratchDirection);
  return {
    position: scratchPosition.clone(),
    direction: scratchDirection.clone(),
    quaternion,
  };
}

function Shard({
  shot,
  onDone,
}: {
  shot: Shot;
  onDone: (id: number) => void;
}) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const colliderRef = useRef<RapierCollider>(null);
  const { world, rapier } = useRapier();
  const showHitboxes = useAppSelector((state) => state.combat.showHitboxes);
  const doneRef = useRef(false);
  const ageRef = useRef(0);
  const originRef = useRef({
    x: shot.position[0],
    y: shot.position[1],
    z: shot.position[2],
  });
  const ray = useMemo(
    () => new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }),
    [rapier],
  );
  const ballArgs = useMemo<[number]>(() => [shot.radius], [shot.radius]);

  const finish = useCallback(() => {
    if (doneRef.current) {
      return;
    }
    doneRef.current = true;
    const collider = colliderRef.current;
    if (collider) {
      collider.setEnabled(false);
    }
    onDone(shot.id);
  }, [onDone, shot.id]);

  const step = useCallback(() => {
    const body = bodyRef.current;
    if (!body || doneRef.current) {
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

    ageRef.current += PHYSICS_TIMESTEP;
    const distance = shot.speed * PHYSICS_TIMESTEP;
    const current = body.translation();
    originRef.current = { x: current.x, y: current.y, z: current.z };
    const next = {
      x: current.x + shot.direction[0] * distance,
      y: current.y + shot.direction[1] * distance,
      z: current.z + shot.direction[2] * distance,
    };
    if (ageRef.current >= shot.lifetime || next.y < 0.05) {
      finish();
      return;
    }
    body.setTranslation(next, true);
    body.setNextKinematicTranslation(next);
  }, [finish, shot.direction, shot.lifetime, shot.speed]);

  const collect = useCallback(() => {
    const body = bodyRef.current;
    const collider = colliderRef.current;
    if (!body || !collider || doneRef.current || isHitstopActive()) {
      return;
    }
    if (!world.getCollider(collider.handle) || !collider.isEnabled()) {
      return;
    }

    const position = body.translation();
    let connected = false;
    world.intersectionPairsWith(collider, (other) => {
      if (connected) {
        return;
      }
      const parent = other.parent();
      if (!parent) {
        return;
      }
      connected = tryProjectileHit(shot.fighterId, parent.handle, {
        x: position.x,
        y: position.y,
        z: position.z,
      }, shot.strike);
    });
    if (connected) {
      finish();
      return;
    }

    const origin = originRef.current;
    const distance = shot.speed * PHYSICS_TIMESTEP + shot.radius;
    ray.origin.x = origin.x;
    ray.origin.y = origin.y;
    ray.origin.z = origin.z;
    ray.dir.x = shot.direction[0];
    ray.dir.y = shot.direction[1];
    ray.dir.z = shot.direction[2];
    const hit = world.castRay(
      ray,
      distance,
      true,
      rapier.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      undefined,
      undefined,
      (other) => {
        const parent = other.parent();
        if (!parent) {
          return false;
        }
        return rigidBodyFighter(parent.handle) !== shot.fighterId;
      },
    );
    if (!hit) {
      return;
    }

    const parent = hit.collider.parent();
    const owner = parent ? rigidBodyFighter(parent.handle) : null;
    if (owner && parent) {
      tryProjectileHit(
        shot.fighterId,
        parent.handle,
        {
          x: origin.x + shot.direction[0] * hit.timeOfImpact,
          y: origin.y + shot.direction[1] * hit.timeOfImpact,
          z: origin.z + shot.direction[2] * hit.timeOfImpact,
        },
        shot.strike,
      );
    }
    finish();
  }, [finish, rapier, ray, shot.direction, shot.fighterId, shot.radius, shot.speed, shot.strike, world]);

  useBeforePhysicsStep(step);
  useAfterPhysicsStep(collect);

  return (
    <RigidBody
      ref={bodyRef}
      name={`shard-${shot.id}`}
      type="kinematicPosition"
      colliders={false}
      position={shot.position}
      quaternion={shot.quaternion}
      gravityScale={0}
      canSleep={false}
      ccd
    >
      <BallCollider
        ref={colliderRef}
        args={ballArgs}
        sensor
        collisionGroups={HITBOX_GROUPS}
        activeCollisionTypes={HIT_COLLISION_TYPES}
      />
      <mesh castShadow frustumCulled={false}>
        <coneGeometry args={[0.13, 0.42, 5]} />
        <meshPhysicalMaterial
          color="#b8ffe8"
          roughness={0.12}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.05}
          emissive="#1ed6a0"
          emissiveIntensity={0.2}
          flatShading
        />
      </mesh>
      <mesh position={[0, -0.16, 0]} rotation={[Math.PI, 0, 0]} castShadow frustumCulled={false}>
        <coneGeometry args={[0.11, 0.28, 5]} />
        <meshPhysicalMaterial
          color="#5dffe0"
          roughness={0.12}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.05}
          emissive="#14956e"
          emissiveIntensity={0.16}
          flatShading
        />
      </mesh>
      {showHitboxes ? (
        <mesh frustumCulled={false}>
          <sphereGeometry args={[shot.radius, 12, 8]} />
          <meshBasicMaterial color="#ff2430" wireframe toneMapped={false} />
        </mesh>
      ) : null}
    </RigidBody>
  );
}

export function AttackProjectiles({
  characterId,
  fighterId,
  model,
  visualRef,
}: AttackProjectilesProps) {
  const moves = useMemo(() => projectileMoves(characterId), [characterId]);
  const bones = useMemo(() => {
    const found = new Map<string, Object3D>();
    for (const move of moves) {
      const name = move.projectile?.bone;
      if (!name || found.has(name)) {
        continue;
      }
      const bone = findNamed(model, name);
      if (bone) {
        found.set(name, bone);
      }
    }
    return found;
  }, [model, moves]);
  const spawned = useRef(new Set<string>());
  const previousTime = useRef(0);
  const warned = useRef(false);
  const [shots, setShots] = useState<Shot[]>([]);

  useEffect(() => {
    return subscribeCombatReset(() => {
      spawned.current.clear();
      previousTime.current = 0;
      setShots([]);
    });
  }, []);

  const dismiss = useCallback((id: number) => {
    setShots((current) => current.filter((shot) => shot.id !== id));
  }, []);

  useFrame(() => {
    if (moves.length === 0) {
      return;
    }
    const state = getAttackRuntime(fighterId);
    const clock = readClipClock(fighterId);
    const move = moves.find(
      (attack) => state.live && state.attackId === attack.id && attack.projectile,
    );
    if (!move?.projectile || !sameAnimationName(clock.name, move.animation)) {
      previousTime.current = 0;
      return;
    }

    const launch = move.projectile;
    const key = `${move.id}:${state.serial}`;
    const crossed = previousTime.current < launch.time && clock.time >= launch.time;
    const late =
      clock.time >= launch.time &&
      clock.time < launch.time + 0.05 &&
      !spawned.current.has(key);
    previousTime.current = clock.time;
    if ((!crossed && !late) || spawned.current.has(key)) {
      return;
    }

    const bone = bones.get(launch.bone);
    if (!bone) {
      if (!warned.current) {
        warned.current = true;
        console.warn(`Missing projectile bone ${launch.bone}`);
      }
      return;
    }

    visualRef.current?.updateMatrixWorld(true);
    const aim = aimFromBone(bone, launch);
    if (!aim) {
      return;
    }
    spawned.current.add(key);
    const pose = getAttackRuntime(fighterId);
    const shot: Shot = {
      id: nextShotId,
      fighterId,
      radius: launch.radius,
      speed: launch.speed,
      lifetime: launch.lifetime,
      position: [aim.position.x, aim.position.y, aim.position.z],
      direction: [aim.direction.x, aim.direction.y, aim.direction.z],
      quaternion: [aim.quaternion.x, aim.quaternion.y, aim.quaternion.z, aim.quaternion.w],
      strike: {
        attackId: move.id,
        serial: pose.serial,
        damage: move.damage,
        knockback: move.knockback,
        hitstun: move.hitstun,
        hitstopMs: move.hitstopMs,
        cameraShake: move.cameraShake,
        impactScale: move.impactScale,
        facingYaw: Math.atan2(aim.direction.x, aim.direction.z),
        attackerX: pose.feetX,
        attackerZ: pose.feetZ,
      },
    };
    nextShotId += 1;
    setShots((current) => [...current, shot]);
  }, -1);

  return shots.map((shot) => <Shard key={shot.id} shot={shot} onDone={dismiss} />);
}

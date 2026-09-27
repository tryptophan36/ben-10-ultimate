"use client";

import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
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
import { Bone, Group, Mesh, Vector3, type Object3D } from "three";
import { meleeHitboxes } from "@/lib/game/combat/attacks";
import { isHitstopActive } from "@/lib/game/combat/hitstop";
import { isHitboxLive, tryHit } from "@/lib/game/combat/runtime";
import { physicsGroups } from "@/lib/game/physics";
import { useAppSelector } from "@/store/hooks";

const HITBOX_GROUPS = interactionGroups(
  [physicsGroups.hitbox],
  [physicsGroups.hurtbox],
);
const PARKED_POSITION: [number, number, number] = [0, -8, 0];
const scratch = new Vector3();

type AttackHitboxesProps = {
  characterId: string;
  model: Object3D;
  visualRef: RefObject<Group | null>;
};

function boneByName(bones: Map<string, Bone>, name: string): Bone | undefined {
  return (
    bones.get(name) ??
    bones.get(name.replaceAll("_", " ")) ??
    bones.get(name.replaceAll(" ", "_"))
  );
}

/** Bones first, so Four Arms stays on its joints. A named mesh covers the ball. */
function anchorByName(model: Object3D, name: string): Object3D | undefined {
  const bones = new Map<string, Bone>();
  model.traverse((object) => {
    if (object instanceof Bone) {
      bones.set(object.name, object);
    }
  });
  const bone = boneByName(bones, name);
  if (bone) {
    return bone;
  }

  const folded = name.toLowerCase();
  let found: Object3D | undefined;
  model.traverse((object) => {
    if (!found && object.name.toLowerCase() === folded) {
      found = object;
    }
  });
  return found;
}

function bonePosition(
  bone: Object3D,
  visualRef: RefObject<Group | null>,
  offset?: readonly [number, number, number],
): Vector3 | null {
  const visual = visualRef.current;
  if (!visual) {
    return null;
  }
  visual.updateMatrixWorld(true);
  if (!offset) {
    bone.getWorldPosition(scratch);
    return scratch;
  }
  scratch.set(offset[0], offset[1], offset[2]);
  bone.localToWorld(scratch);
  return scratch;
}

function BoneHitbox({
  bone,
  radius,
  offset,
  attackIds,
  visualRef,
}: {
  bone: Object3D;
  radius: number;
  offset?: readonly [number, number, number];
  attackIds: string[];
  visualRef: RefObject<Group | null>;
}) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const colliderRef = useRef<RapierCollider>(null);
  const meshRef = useRef<Mesh>(null);
  const { world } = useRapier();
  const showHitboxes = useAppSelector((state) => state.combat.showHitboxes);
  const showRef = useRef(showHitboxes);
  const ballArgs = useMemo<[number]>(() => [radius], [radius]);

  useEffect(() => {
    showRef.current = showHitboxes;
  }, [showHitboxes]);

  const moveHitbox = useCallback(() => {
    const body = bodyRef.current;
    const collider = colliderRef.current;
    if (!body || !collider || !world.getCollider(collider.handle)) {
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

    if (!isHitboxLive(attackIds)) {
      collider.setEnabled(false);
      return;
    }

    const position = bonePosition(bone, visualRef, offset);
    if (!position) {
      collider.setEnabled(false);
      return;
    }

    const next = { x: position.x, y: position.y, z: position.z };
    body.setTranslation(next, true);
    body.setNextKinematicTranslation(next);
    collider.setEnabled(true);
  }, [attackIds, bone, offset, visualRef, world]);

  const collectHits = useCallback(() => {
    const collider = colliderRef.current;
    if (!collider || !world.getCollider(collider.handle) || !collider.isEnabled()) {
      return;
    }

    if (isHitstopActive()) {
      return;
    }

    const hitbox = collider.parent();
    const hit = hitbox?.translation();
    if (!hit) {
      return;
    }
    const hitX = hit.x;
    const hitY = hit.y;
    const hitZ = hit.z;

    world.intersectionPairsWith(collider, (other) => {
      const parent = other.parent();
      if (!parent) {
        return;
      }
      tryHit(parent.handle, { x: hitX, y: hitY, z: hitZ });
    });
  }, [world]);

  useBeforePhysicsStep(moveHitbox);
  useAfterPhysicsStep(collectHits);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }
    const live = showRef.current && isHitboxLive(attackIds);
    mesh.visible = live;
    if (!live) {
      return;
    }
    const position = bonePosition(bone, visualRef, offset);
    if (position) {
      mesh.position.copy(position);
    }
  });

  return (
    <>
      <RigidBody
        ref={bodyRef}
        name={`hitbox-${bone.name}`}
        type="kinematicPosition"
        colliders={false}
        position={PARKED_POSITION}
        gravityScale={0}
        canSleep={false}
      >
        <BallCollider
          ref={colliderRef}
          args={ballArgs}
          sensor
          collisionGroups={HITBOX_GROUPS}
        />
      </RigidBody>
      <mesh ref={meshRef} visible={false} frustumCulled={false}>
        <sphereGeometry args={[radius, 18, 12]} />
        <meshBasicMaterial
          color="#ff2430"
          transparent
          opacity={0.5}
          depthWrite={false}
          toneMapped={false}
        />
        <mesh>
          <sphereGeometry args={[radius * 1.02, 10, 8]} />
          <meshBasicMaterial color="#ffe14a" wireframe toneMapped={false} />
        </mesh>
      </mesh>
    </>
  );
}

export function AttackHitboxes({ characterId, model, visualRef }: AttackHitboxesProps) {
  const hitboxes = useMemo(() => meleeHitboxes(characterId), [characterId]);
  const anchors = useMemo(() => {
    const found = new Map<string, Object3D>();
    for (const hitbox of meleeHitboxes(characterId)) {
      const anchor = anchorByName(model, hitbox.bone);
      if (anchor) {
        found.set(hitbox.bone, anchor);
      }
    }
    return found;
  }, [characterId, model]);

  return hitboxes.map((hitbox) => {
    const bone = anchors.get(hitbox.bone);
    if (!bone) {
      return null;
    }
    return (
      <BoneHitbox
        key={hitbox.bone}
        bone={bone}
        radius={hitbox.radius}
        offset={hitbox.offset}
        attackIds={hitbox.attackIds}
        visualRef={visualRef}
      />
    );
  });
}

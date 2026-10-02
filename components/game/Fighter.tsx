"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import {
  CapsuleCollider,
  interactionGroups,
  RigidBody,
  useAfterPhysicsStep,
  type RapierCollider,
  type RapierRigidBody,
} from "@react-three/rapier";
import { Group, Mesh, type AnimationClip, type Object3D } from "three";
import { clone as cloneSkinnedScene } from "three/addons/utils/SkeletonUtils.js";
import { AttackHitboxes } from "@/components/game/combat/AttackHitboxes";
import {
  useAnimationController,
  type AnimationLibrary,
} from "@/components/game/useAnimationController";
import {
  useCharacterController,
  type FighterControl,
  type IncomingHit,
} from "@/components/game/useCharacterController";
import type { ArenaSpawnPoint } from "@/lib/game/arena/desert";
import { characters, type CharacterId, type FighterView } from "@/lib/game/characters";
import { characterVisuals } from "@/lib/game/characters/visuals";
import {
  FIGHTER_MAX_HP,
  OPPONENT_FIGHTER_ID,
  PLAYER_FIGHTER_ID,
} from "@/lib/game/combat/fighters";
import { visibleContactPoint } from "@/lib/game/combat/impactVfx";
import { knockbackVelocity } from "@/lib/game/combat/knockback";
import { emitHitFeedback } from "@/lib/game/combat/hitFeedback";
import { registerHurtbox } from "@/lib/game/combat/runtime";
import { ATTACK_PHASE, type DamageRequest } from "@/lib/game/combat/types";
import { matchFlags } from "@/lib/game/cpu";
import { spawnHeight, visualDrop } from "@/lib/game/locomotion";
import { HIT_COLLISION_TYPES, physicsGroups } from "@/lib/game/physics";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { applyDamage, setAttackState } from "@/store/slices/combatSlice";

const gltfLoaderOptions = [false, false] as const;
const LOCKED_ROTATIONS: [boolean, boolean, boolean] = [false, false, false];
const FIGHTER_COLLISION_GROUPS = interactionGroups(
  [physicsGroups.fighter],
  [physicsGroups.stage, physicsGroups.fighter],
);
const HURTBOX_GROUPS = interactionGroups(
  [physicsGroups.hurtbox],
  [physicsGroups.hitbox],
);

type LoadedModel = {
  scene: Object3D;
  animations: AnimationClip[];
};

const EMPTY_CLIPS: AnimationClip[] = [];

function shadeModel(model: Object3D) {
  model.traverse((object) => {
    if (object instanceof Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
      object.frustumCulled = false;
    }
  });
}

export function Fighter({
  characterId,
  fighterId,
  control,
  spawn,
}: {
  characterId: CharacterId;
  fighterId: string;
  control: FighterControl;
  spawn: ArenaSpawnPoint;
}) {
  const dispatch = useAppDispatch();
  const character = characters[characterId];
  const visual = characterVisuals[characterId];
  const locomotion = character.locomotion;
  const urls = useMemo(() => character.models.map((model) => model.url), [character]);
  const loaded = useGLTF(urls, ...gltfLoaderOptions) as LoadedModel | LoadedModel[];
  const gltfs = Array.isArray(loaded) ? loaded : [loaded];
  const primarySource = gltfs[0]?.scene;
  const secondarySource = gltfs[1]?.scene;
  const scenes = useMemo(() => {
    const clones = [cloneSkinnedScene(primarySource)];
    if (secondarySource) {
      clones.push(cloneSkinnedScene(secondarySource));
    }
    return clones;
  }, [primarySource, secondarySource]);
  const emptyRoot = useMemo(() => new Group(), []);
  const primaryClips = gltfs[0]?.animations ?? EMPTY_CLIPS;
  const secondaryClips = gltfs[1]?.animations ?? EMPTY_CLIPS;
  const primaryAnim = useAnimations(primaryClips, scenes[0] ?? emptyRoot);
  const secondaryAnim = useAnimations(secondaryClips, scenes[1] ?? emptyRoot);
  const modelCount = character.models.length;
  const libraries = useMemo(() => {
    const next: AnimationLibrary[] = [
      {
        actions: primaryAnim.actions,
        mixer: primaryAnim.mixer,
        names: primaryAnim.names,
      },
    ];
    if (modelCount > 1) {
      next.push({
        actions: secondaryAnim.actions,
        mixer: secondaryAnim.mixer,
        names: secondaryAnim.names,
      });
    }
    return next;
  }, [
    modelCount,
    primaryAnim.actions,
    primaryAnim.mixer,
    primaryAnim.names,
    secondaryAnim.actions,
    secondaryAnim.mixer,
    secondaryAnim.names,
  ]);
  const bodyRef = useRef<RapierRigidBody>(null);
  const colliderRef = useRef<RapierCollider>(null);
  const visualRef = useRef<Group>(null);
  const incomingHitRef = useRef<IncomingHit | null>(null);
  const defeatedRef = useRef(false);
  const hpRef = useRef(FIGHTER_MAX_HP);
  const lastHitKey = useRef("");
  const hurtDetachRef = useRef<(() => void) | null>(null);
  const clipCommandRef = useRef({ name: character.defaultAnimation, epoch: 0 });
  const health = useAppSelector((state) => state.combat.targets[fighterId]);
  const viewRef = useRef<FighterView>({
    form: character.driver.initialForm,
    speed: 0,
  });
  const spawnPosition = useMemo<[number, number, number]>(
    () => [
      spawn.position[0],
      spawn.position[1] + spawnHeight(locomotion),
      spawn.position[2],
    ],
    [locomotion, spawn],
  );
  const visualPosition = useMemo<[number, number, number]>(
    () => [0, visualDrop(locomotion), 0],
    [locomotion],
  );
  const capsuleArgs = useMemo<[number, number]>(
    () => [locomotion.capsuleHalfHeight, locomotion.capsuleRadius],
    [locomotion],
  );

  const { onOneShotFinished } = useCharacterController({
    bodyRef,
    colliderRef,
    visualRef,
    viewRef,
    character,
    fighterId,
    control,
    incomingHitRef,
    defeatedRef,
    clipCommandRef: control === "cpu" ? clipCommandRef : null,
    initialYaw: spawn.yaw,
  });

  useEffect(() => {
    const hp = health?.hp ?? 0;
    hpRef.current = hp;
    defeatedRef.current = hp <= 0;
    if (fighterId === PLAYER_FIGHTER_ID) {
      matchFlags.playerDown = defeatedRef.current;
    } else if (fighterId === OPPONENT_FIGHTER_ID) {
      matchFlags.opponentDown = defeatedRef.current;
    }
  }, [fighterId, health?.hp]);

  const takeDamage = useCallback(
    (request: DamageRequest) => {
      if (request.attacker === fighterId || hpRef.current <= 0) {
        return false;
      }
      const hitKey = `${request.attacker}:${request.attackSerial}`;
      if (lastHitKey.current === hitKey) {
        return false;
      }
      lastHitKey.current = hitKey;
      hpRef.current = Math.max(0, hpRef.current - request.amount);
      defeatedRef.current = hpRef.current <= 0;
      if (fighterId === PLAYER_FIGHTER_ID) {
        matchFlags.playerDown = defeatedRef.current;
      } else if (fighterId === OPPONENT_FIGHTER_ID) {
        matchFlags.opponentDown = defeatedRef.current;
      }

      dispatch(
        applyDamage({
          targetId: fighterId,
          amount: request.amount,
          serial: request.attackSerial,
        }),
      );

      const body = bodyRef.current;
      let feedback = request;
      if (body) {
        const center = body.translation();
        const contact = visibleContactPoint(
          { x: request.hitX, y: request.hitY, z: request.hitZ },
          { x: center.x, y: center.y, z: center.z },
          locomotion.capsuleRadius + 0.08,
        );
        feedback = {
          ...request,
          hitX: contact.x,
          hitY: contact.y,
          hitZ: contact.z,
        };
        const velocity = knockbackVelocity(
          request.facingYaw,
          request.knockback,
          center.x,
          center.z,
          request.attackerX,
          request.attackerZ,
          request.knockbackStyle ?? "facing",
        );
        incomingHitRef.current = {
          vx: velocity.x,
          vy: velocity.y,
          vz: velocity.z,
          hitstun: request.hitstun,
        };
      }
      emitHitFeedback(feedback);
      return true;
    },
    [dispatch, fighterId, locomotion.capsuleRadius],
  );

  const takeDamageRef = useRef(takeDamage);
  useEffect(() => {
    takeDamageRef.current = takeDamage;
  }, [takeDamage]);

  useAfterPhysicsStep(() => {
    if (hurtDetachRef.current) {
      return;
    }
    const body = bodyRef.current;
    if (!body) {
      return;
    }
    hurtDetachRef.current = registerHurtbox(body.handle, {
      id: fighterId,
      takeDamage: (request) => takeDamageRef.current(request),
    });
  });

  useEffect(() => {
    return () => {
      hurtDetachRef.current?.();
      hurtDetachRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (visualRef.current) {
      visualRef.current.rotation.y = spawn.yaw;
    }
  }, [spawn.yaw, visualRef]);

  useLayoutEffect(() => {
    const visibleId = character.visibleModel(character.driver.initialForm);
    scenes.forEach((scene, index) => {
      shadeModel(scene);
      const slotId = character.models[index]?.id ?? "";
      visual?.prepareModel?.(scene, slotId);
      scene.visible = slotId === visibleId;
    });
  }, [character, scenes, visual]);

  useAnimationController({
    libraries,
    characterId,
    fighterId,
    clipCommandRef: control === "cpu" ? clipCommandRef : undefined,
    onOneShotFinished,
  });

  useEffect(() => {
    if (control !== "player") {
      return;
    }
    dispatch(
      setAttackState({
        attackId: null,
        phase: ATTACK_PHASE.idle,
        activeFrames: 0,
      }),
    );
  }, [character, control, dispatch]);

  useFrame(() => {
    const view = viewRef.current;
    const visibleId = character.visibleModel(view.form);
    scenes.forEach((scene, index) => {
      scene.visible = character.models[index]?.id === visibleId;
    });
    visual?.syncPlayback?.({
      form: view.form,
      speed: view.speed,
      actions: (slotId) => {
        const index = character.models.findIndex((model) => model.id === slotId);
        return index === 1 ? secondaryAnim.actions : primaryAnim.actions;
      },
    });
  }, -1);

  return (
    <>
      <RigidBody
        ref={bodyRef}
        name={character.id}
        type="kinematicPosition"
        colliders={false}
        position={spawnPosition}
        enabledRotations={LOCKED_ROTATIONS}
        canSleep={false}
        ccd
        gravityScale={0}
      >
        <CapsuleCollider
          ref={colliderRef}
          args={capsuleArgs}
          collisionGroups={FIGHTER_COLLISION_GROUPS}
          friction={0}
          restitution={0}
        />
        <CapsuleCollider
          args={capsuleArgs}
          collisionGroups={HURTBOX_GROUPS}
          activeCollisionTypes={HIT_COLLISION_TYPES}
          sensor
        />
        <group ref={visualRef} name="character-visual" position={visualPosition}>
          {scenes.map((scene, index) => (
            <primitive
              key={character.models[index]?.id ?? index}
              object={scene}
              dispose={null}
            />
          ))}
        </group>
      </RigidBody>
      {scenes.map((scene, index) => (
          <AttackHitboxes
          key={character.models[index]?.id ?? index}
          characterId={character.id}
          fighterId={fighterId}
          model={scene}
          visualRef={visualRef}
        />
      ))}
    </>
  );
}

if (typeof window !== "undefined") {
  for (const character of Object.values(characters)) {
    for (const model of character.models) {
      useGLTF.preload(model.url, ...gltfLoaderOptions);
    }
  }
}

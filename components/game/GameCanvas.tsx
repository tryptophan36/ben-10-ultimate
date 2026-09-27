"use client";

import { Suspense, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { CuboidCollider, Physics, RigidBody, interactionGroups } from "@react-three/rapier";
import { NeutralToneMapping } from "three";
import { Camera } from "@/components/game/Camera";
import { HitLocationMarker } from "@/components/game/combat/HitLocationMarker";
import { HitstopClock } from "@/components/game/combat/HitstopClock";
import { HitstopSim } from "@/components/game/combat/HitstopSim";
import { ImpactBursts } from "@/components/game/combat/ImpactBursts";
import { TrainingDummy } from "@/components/game/combat/TrainingDummy";
import { Cannonbolt } from "@/components/game/characters/Cannonbolt";
import { DebugHud } from "@/components/game/DebugHud";
import { Player } from "@/components/game/Player";
import { resetCameraShake } from "@/lib/game/camera/cameraShake";
import { resetFeelDebug } from "@/lib/game/combat/feelDebug";
import { resetHitstop } from "@/lib/game/combat/hitstop";
import { clearImpacts } from "@/lib/game/combat/impactVfx";
import { GRAVITY, PHYSICS_TIMESTEP, physicsGroups } from "@/lib/game/physics";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { resetCombat } from "@/store/slices/combatSlice";
import { endSession, markSessionActive } from "@/store/slices/gameSlice";

function Lighting() {
  return (
    <>
      <hemisphereLight args={["#e8eeff", "#8d7362", 0.9]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[5, 8, 4]}
        intensity={2.6}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />
      <directionalLight position={[-4, 3.5, -2]} intensity={0.75} />
    </>
  );
}

const WORLD_GRAVITY: [number, number, number] = [0, GRAVITY, 0];
const GROUND_SIZE = 24;
const GROUND_COLLIDER_ARGS: [number, number, number] = [GROUND_SIZE / 2, 0.25, GROUND_SIZE / 2];
const GROUND_COLLIDER_POSITION: [number, number, number] = [0, -0.25, 0];
const STAGE_COLLISION_GROUPS = interactionGroups(
  [physicsGroups.stage],
  [physicsGroups.fighter],
);

function Ground() {
  return (
    <RigidBody type="fixed" colliders={false}>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <meshStandardMaterial color="#323846" roughness={1} metalness={0} />
      </mesh>
      <CuboidCollider
        args={GROUND_COLLIDER_ARGS}
        position={GROUND_COLLIDER_POSITION}
        collisionGroups={STAGE_COLLISION_GROUPS}
        friction={1}
        restitution={0}
      />
    </RigidBody>
  );
}

export function GameCanvas() {
  const dispatch = useAppDispatch();
  const selectedCharacter = useAppSelector((state) => state.game.selectedCharacter);

  useEffect(() => {
    resetHitstop();
    resetCameraShake();
    clearImpacts();
    resetFeelDebug();
    dispatch(markSessionActive());
    dispatch(resetCombat());
    return () => {
      resetHitstop();
      resetCameraShake();
      clearImpacts();
      resetFeelDebug();
      dispatch(endSession());
      dispatch(resetCombat());
    };
  }, [dispatch]);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#101218]">
      <DebugHud />
      <Canvas
        className="h-full w-full"
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: NeutralToneMapping }}
        onCreated={({ gl }) => {
          gl.toneMapping = NeutralToneMapping;
          gl.toneMappingExposure = 1;
        }}
      >
        <color attach="background" args={["#101218"]} />
        <HitstopClock />
        <Camera />
        <Lighting />
        <ImpactBursts />
        <HitLocationMarker />
        <Suspense fallback={null}>
          <Physics
            gravity={WORLD_GRAVITY}
            timeStep={PHYSICS_TIMESTEP}
            colliders={false}
          >
            <HitstopSim />
            <Ground />
            {selectedCharacter === "cannonbolt" ? (
              <Cannonbolt key="cannonbolt" />
            ) : (
              <Player key={selectedCharacter} />
            )}
            <TrainingDummy />
          </Physics>
        </Suspense>
      </Canvas>
    </div>
  );
}

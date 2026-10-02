"use client";

import { Suspense, useEffect, useLayoutEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { NeutralToneMapping } from "three";
import { Camera } from "@/components/game/Camera";
import { HitLocationMarker } from "@/components/game/combat/HitLocationMarker";
import { HitstopClock } from "@/components/game/combat/HitstopClock";
import { HitstopSim } from "@/components/game/combat/HitstopSim";
import { ImpactBursts } from "@/components/game/combat/ImpactBursts";
import { DebugHud } from "@/components/game/DebugHud";
import { DesertArena, useDesertArena } from "@/components/game/DesertArena";
import { Fighter } from "@/components/game/Fighter";
import { MatchHud } from "@/components/game/MatchHud";
import { resetCameraShake } from "@/lib/game/camera/cameraShake";
import { characterIds, type CharacterId } from "@/lib/game/characters";
import { OPPONENT_FIGHTER_ID, PLAYER_FIGHTER_ID } from "@/lib/game/combat/fighters";
import { resetFeelDebug } from "@/lib/game/combat/feelDebug";
import { resetHitstop } from "@/lib/game/combat/hitstop";
import { clearImpacts } from "@/lib/game/combat/impactVfx";
import { resetCombatRuntime } from "@/lib/game/combat/runtime";
import { resetMatchFlags } from "@/lib/game/cpu";
import { GRAVITY, PHYSICS_TIMESTEP } from "@/lib/game/physics";
import { playerFocus } from "@/lib/game/runtime";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { resetCombat } from "@/store/slices/combatSlice";
import { endSession, markSessionActive } from "@/store/slices/gameSlice";

function opponentCharacter(id: CharacterId): CharacterId {
  const index = characterIds.indexOf(id);
  return characterIds[(index + 1) % characterIds.length] ?? id;
}

function Lighting() {
  return (
    <>
      <hemisphereLight args={["#f3f6ff", "#c4a06a", 0.85]} />
      <ambientLight intensity={0.28} />
      <directionalLight
        position={[12, 18, 8]}
        intensity={2.8}
        color="#fff4e0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0004}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
      />
      <directionalLight position={[-8, 6, -4]} intensity={0.45} color="#d6e4ff" />
    </>
  );
}

const WORLD_GRAVITY: [number, number, number] = [0, GRAVITY, 0];

function ArenaSession({ characterId }: { characterId: CharacterId }) {
  const arena = useDesertArena();
  const playerSpawn = arena.spawns.player1;
  const opponentSpawn = arena.spawns.player2;
  const opponentId = opponentCharacter(characterId);
  useLayoutEffect(() => {
    playerFocus.feet.set(
      playerSpawn.position[0],
      playerSpawn.position[1],
      playerSpawn.position[2],
    );
    playerFocus.yaw = playerSpawn.yaw;
  }, [playerSpawn]);

  return (
    <Physics gravity={WORLD_GRAVITY} timeStep={PHYSICS_TIMESTEP} colliders={false}>
      <HitstopSim />
      <Camera
        initialYaw={playerSpawn.yaw + 0.55}
        initialFocus={playerSpawn.position}
      />
      <DesertArena arena={arena} />
      <Fighter
        key={characterId}
        characterId={characterId}
        fighterId={PLAYER_FIGHTER_ID}
        control="player"
        spawn={playerSpawn}
      />
      <Fighter
        key={`cpu-${opponentId}`}
        characterId={opponentId}
        fighterId={OPPONENT_FIGHTER_ID}
        control="cpu"
        spawn={opponentSpawn}
      />
    </Physics>
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
    resetCombatRuntime();
    resetMatchFlags();
    dispatch(markSessionActive());
    dispatch(resetCombat());
    return () => {
      resetHitstop();
      resetCameraShake();
      clearImpacts();
      resetFeelDebug();
      resetCombatRuntime();
      resetMatchFlags();
      dispatch(endSession());
      dispatch(resetCombat());
    };
  }, [dispatch]);

  useEffect(() => {
    resetMatchFlags();
    dispatch(resetCombat());
  }, [dispatch, selectedCharacter]);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#8eb4d4]">
      <MatchHud />
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
        <color attach="background" args={["#8eb4d4"]} />
        <fog attach="fog" args={["#c6b396", 28, 55]} />
        <HitstopClock />
        <Lighting />
        <ImpactBursts />
        <HitLocationMarker />
        <Suspense fallback={null}>
          <ArenaSession characterId={selectedCharacter} />
        </Suspense>
      </Canvas>
    </div>
  );
}

"use client";

import { Suspense, useEffect, useLayoutEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { NeutralToneMapping } from "three";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Camera } from "@/components/game/Camera";
import { HitLocationMarker } from "@/components/game/combat/HitLocationMarker";
import { HitstopClock } from "@/components/game/combat/HitstopClock";
import { HitstopSim } from "@/components/game/combat/HitstopSim";
import { ImpactBursts } from "@/components/game/combat/ImpactBursts";
import { TrainingDummy, trainingDummyHeight } from "@/components/game/combat/TrainingDummy";
import { DebugHud } from "@/components/game/DebugHud";
import { ArenaStage, useArena } from "@/components/game/DesertArena";
import { Fighter } from "@/components/game/Fighter";
import { MatchHud } from "@/components/game/MatchHud";
import { resetCameraShake } from "@/lib/game/camera/cameraShake";
import { isCharacterId, opponentOf, type CharacterId } from "@/lib/game/characters";
import { OPPONENT_FIGHTER_ID, PLAYER_FIGHTER_ID } from "@/lib/game/combat/fighters";
import { resetFeelDebug } from "@/lib/game/combat/feelDebug";
import { resetHitstop } from "@/lib/game/combat/hitstop";
import { clearImpacts } from "@/lib/game/combat/impactVfx";
import { resetCombatRuntime } from "@/lib/game/combat/runtime";
import { resetMatchFlags } from "@/lib/game/cpu";
import { GRAVITY, PHYSICS_TIMESTEP } from "@/lib/game/physics";
import { playerFocus } from "@/lib/game/runtime";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  resetCombat,
  toggleShowHitboxes,
  TRAINING_DUMMY_B_ID,
  TRAINING_DUMMY_C_ID,
  TRAINING_DUMMY_ID,
} from "@/store/slices/combatSlice";
import {
  endSession,
  markSessionActive,
  setMatchMode,
  setSelectedArena,
  setSelectedCharacter,
  toggleDebugHud,
} from "@/store/slices/gameSlice";
import type { ArenaSpawnPoint } from "@/lib/game/arena/desert";
import {
  arenaById,
  parseArenaId,
  parseMatchMode,
  type MatchMode,
} from "@/lib/game/matchSetup";

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

function dummyPosition(
  spawn: ArenaSpawnPoint,
  offsetX: number,
  offsetZ: number,
): [number, number, number] {
  return [
    spawn.position[0] + offsetX,
    spawn.position[1] + trainingDummyHeight(),
    spawn.position[2] + offsetZ,
  ];
}

function ArenaSession({
  characterId,
  mode,
  modelPath,
  arenaName,
}: {
  characterId: CharacterId;
  mode: MatchMode;
  modelPath: string;
  arenaName: string;
}) {
  const arena = useArena(modelPath);
  const playerSpawn = arena.spawns.player1;
  const opponentSpawn = arena.spawns.player2;
  const opponentId = opponentOf(characterId);
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
      <ArenaStage arena={arena} name={arenaName} />
      <Fighter
        key={characterId}
        characterId={characterId}
        fighterId={PLAYER_FIGHTER_ID}
        control="player"
        spawn={playerSpawn}
      />
      {mode === "cpu" ? (
        <Fighter
          key={`cpu-${opponentId}`}
          characterId={opponentId}
          fighterId={OPPONENT_FIGHTER_ID}
          control="cpu"
          spawn={opponentSpawn}
        />
      ) : (
        <>
          <TrainingDummy
            id={TRAINING_DUMMY_ID}
            label="Dummy"
            position={dummyPosition(opponentSpawn, 0, 0)}
          />
          <TrainingDummy
            id={TRAINING_DUMMY_B_ID}
            label="Dummy 2"
            position={dummyPosition(opponentSpawn, 1.45, 0.35)}
          />
          <TrainingDummy
            id={TRAINING_DUMMY_C_ID}
            label="Dummy 3"
            position={dummyPosition(opponentSpawn, -1.35, -0.25)}
          />
        </>
      )}
    </Physics>
  );
}

function useSyncedMatchSetup(): boolean {
  const params = useSearchParams();
  const dispatch = useAppDispatch();
  const selectedCharacter = useAppSelector((state) => state.game.selectedCharacter);
  const matchMode = useAppSelector((state) => state.game.matchMode);
  const arenaId = useAppSelector((state) => state.game.arenaId);
  const requestedAlien = params.get("alien");
  const alien = isCharacterId(requestedAlien) ? requestedAlien : selectedCharacter;
  const mode = parseMatchMode(params.get("mode")) ?? matchMode;
  const arena = parseArenaId(params.get("arena")) ?? arenaId;
  const synced = alien === selectedCharacter && mode === matchMode && arena === arenaId;

  useLayoutEffect(() => {
    if (alien !== selectedCharacter) {
      dispatch(setSelectedCharacter(alien));
    }
  }, [alien, dispatch, selectedCharacter]);

  useLayoutEffect(() => {
    if (mode !== matchMode) {
      dispatch(setMatchMode(mode));
    }
  }, [dispatch, matchMode, mode]);

  useLayoutEffect(() => {
    if (arena !== arenaId) {
      dispatch(setSelectedArena(arena));
    }
  }, [arena, arenaId, dispatch]);

  return synced;
}

export function GameCanvas() {
  const ready = useSyncedMatchSetup();
  const dispatch = useAppDispatch();
  const selectedCharacter = useAppSelector((state) => state.game.selectedCharacter);
  const matchMode = useAppSelector((state) => state.game.matchMode);
  const arenaId = useAppSelector((state) => state.game.arenaId);
  const showDebugHud = useAppSelector((state) => state.game.showDebugHud);
  const selectedArena = arenaById(arenaId);

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
  }, [arenaId, dispatch, selectedCharacter]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.code === "Backquote") {
        dispatch(toggleDebugHud());
      }
      if (event.code === "KeyH") {
        dispatch(toggleShowHitboxes());
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch]);

  if (!ready) {
    return <div className="h-dvh w-full bg-[#8eb4d4]" />;
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#8eb4d4]">
      <Link
        href="/"
        className="absolute top-3 left-3 z-10 rounded-full border border-white/15 bg-black/55 px-3 py-1.5 font-mono text-[11px] tracking-[0.18em] text-white uppercase"
      >
        Menu
      </Link>
      <MatchHud />
      {showDebugHud ? <DebugHud /> : null}
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
          <ArenaSession
            key={selectedArena.id}
            characterId={selectedCharacter}
            mode={matchMode}
            modelPath={selectedArena.modelPath}
            arenaName={selectedArena.id}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

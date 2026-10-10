import { DESERT_ARENA_URL, HAVANA_ARENA_URL } from "@/lib/game/arena/desert";
import type { CharacterId } from "@/lib/game/characters/types";

export const matchModes = [
  {
    id: "training",
    name: "Solo with dummies",
    summary: "Three training dummies. Work the moves with nothing hitting back.",
  },
  {
    id: "cpu",
    name: "Versus computer",
    summary: "A computer-controlled alien takes the other side of the arena.",
  },
] as const;

export type MatchMode = (typeof matchModes)[number]["id"];

export const arenas = [
  {
    id: "desert",
    name: "Desert Arena",
    summary: "Open sand under a hard sun. Two spawns across the dune.",
    modelPath: DESERT_ARENA_URL,
  },
  {
    id: "havana",
    name: "Havana Street",
    summary: "A closed city block. Buildings and walls around the street.",
    modelPath: HAVANA_ARENA_URL,
  },
] as const;

export type ArenaId = (typeof arenas)[number]["id"];

export function arenaById(id: ArenaId) {
  const arena = arenas.find((entry) => entry.id === id);
  return arena ?? arenas[0];
}

export function parseMatchMode(value: string | null): MatchMode | null {
  return matchModes.some((mode) => mode.id === value) ? (value as MatchMode) : null;
}

export function parseArenaId(value: string | null): ArenaId | null {
  return arenas.some((arena) => arena.id === value) ? (value as ArenaId) : null;
}

export function matchHref(input: {
  alien: CharacterId;
  mode: MatchMode;
  arena: ArenaId;
}): string {
  const params = new URLSearchParams({
    alien: input.alien,
    mode: input.mode,
    arena: input.arena,
  });
  return `/game?${params.toString()}`;
}

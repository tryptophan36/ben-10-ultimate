import type { CharacterId } from "@/lib/game/characters/types";

export const rosterCopy: Record<
  CharacterId,
  { species: string; summary: string; accent: string }
> = {
  "four-arms": {
    species: "Tetramand",
    summary: "Four-armed brawler. Close in and hit heavy.",
    accent: "#ff5a3c",
  },
  cannonbolt: {
    species: "Arburian Pelarota",
    summary: "Curls into a ball and rolls through the fight.",
    accent: "#f5c542",
  },
  diamondhead: {
    species: "Petrosapien",
    summary: "Grows crystal over his fist, then fires a shard downrange.",
    accent: "#7dffe0",
  },
};

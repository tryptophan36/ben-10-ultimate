import { fourArmsLocomotion, type LocomotionConfig } from "@/lib/game/locomotion";

export const characterIds = ["four-arms"] as const;

export type CharacterId = (typeof characterIds)[number];

export type CharacterDefinition = {
  id: CharacterId;
  name: string;
  modelUrl: string;
  defaultAnimation: string;
  locomotion: LocomotionConfig;
};

export const characters: Record<CharacterId, CharacterDefinition> = {
  "four-arms": {
    id: "four-arms",
    name: "Four Arms",
    // The asset in this repo is public/models/fourarms_game.glb.
    modelUrl: "/models/fourarms_game.glb",
    defaultAnimation: "FA_Idle",
    locomotion: fourArmsLocomotion,
  },
};

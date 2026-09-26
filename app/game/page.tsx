import type { Metadata } from "next";
import { GameCanvas } from "@/components/game/GameCanvas";

export const metadata: Metadata = {
  title: "Four Arms — Ben 10 Ultimate",
  description: "Four Arms character controller",
};

export default function GamePage() {
  return <GameCanvas />;
}

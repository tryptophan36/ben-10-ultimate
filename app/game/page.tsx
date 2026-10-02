import type { Metadata } from "next";
import { GameCanvas } from "@/components/game/GameCanvas";

export const metadata: Metadata = {
  title: "Desert Arena — Ben 10 Ultimate",
  description: "Fight a computer opponent in the desert arena",
};

export default function GamePage() {
  return <GameCanvas />;
}

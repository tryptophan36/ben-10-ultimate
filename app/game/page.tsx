import { Suspense } from "react";
import type { Metadata } from "next";
import { GameCanvas } from "@/components/game/GameCanvas";

export const metadata: Metadata = {
  title: "Fight — Ben 10 Ultimate",
  description: "Fight in the arena",
};

export default function GamePage() {
  return (
    <Suspense fallback={<div className="h-dvh w-full bg-[#8eb4d4]" />}>
      <GameCanvas />
    </Suspense>
  );
}

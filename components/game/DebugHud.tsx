"use client";

import { useSyncExternalStore } from "react";
import { characters } from "@/lib/game/characters";
import { getControllerDebug, subscribeControllerDebug } from "@/lib/game/runtime";
import { useAppSelector } from "@/store/hooks";

function DebugRow({
  label,
  value,
  valueClassName = "text-zinc-100",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-zinc-400">{label}</dt>
      <dd className={valueClassName}>{value}</dd>
    </div>
  );
}

export function DebugHud() {
  const currentAnimation = useAppSelector((state) => state.game.currentAnimation);
  const selectedCharacter = useAppSelector((state) => state.game.selectedCharacter);
  const character = characters[selectedCharacter];
  const debug = useSyncExternalStore(
    subscribeControllerDebug,
    getControllerDebug,
    getControllerDebug,
  );

  return (
    <aside className="pointer-events-none absolute top-3 left-3 z-10 w-56 rounded-lg border border-white/10 bg-black/70 p-3 font-mono text-xs text-zinc-100 shadow-lg backdrop-blur-sm">
      <p className="text-sm font-semibold tracking-wide text-white">{character.name}</p>
      <dl className="mt-2 space-y-1">
        <DebugRow
          label="Animation"
          value={currentAnimation}
          valueClassName="text-emerald-300"
        />
        <DebugRow label="Movement" value={debug.movementState} />
        <DebugRow label="Grounded" value={debug.grounded ? "yes" : "no"} />
        <DebugRow label="Speed" value={debug.speed.toFixed(2)} />
      </dl>
      <p className="mt-3 text-[10px] tracking-wider text-zinc-500 uppercase">Controls</p>
      <ul className="mt-1 space-y-0.5 text-zinc-400">
        <li>
          <span className="text-zinc-200">Mouse</span> look
        </li>
        <li>
          <span className="text-zinc-200">WASD</span> move
        </li>
        <li>
          <span className="text-zinc-200">Shift</span> run
        </li>
        <li>
          <span className="text-zinc-200">Space</span> jump
        </li>
        <li>
          <span className="text-zinc-200">J</span> punch{" "}
          <span className="text-zinc-200">K</span> heavy
        </li>
      </ul>
    </aside>
  );
}

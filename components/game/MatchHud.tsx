"use client";

import { characterIds, characters } from "@/lib/game/characters";
import { OPPONENT_FIGHTER_ID, PLAYER_FIGHTER_ID } from "@/lib/game/combat/fighters";
import { useAppSelector } from "@/store/hooks";

function HealthBar({
  label,
  hp,
  maxHp,
  fillClassName,
}: {
  label: string;
  hp: number;
  maxHp: number;
  fillClassName: string;
}) {
  const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  return (
    <div className="w-40" data-fighter-hp={hp} data-fighter-label={label}>
      <div className="mb-1 flex items-baseline justify-between gap-3 font-mono text-[11px] tracking-wide text-white uppercase">
        <span>{label}</span>
        <span className="text-zinc-300">
          {hp} / {maxHp}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-black/50">
        <div
          className={`h-full rounded-full ${fillClassName}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

export function MatchHud() {
  const selectedCharacter = useAppSelector((state) => state.game.selectedCharacter);
  const player = useAppSelector((state) => state.combat.targets[PLAYER_FIGHTER_ID]);
  const opponent = useAppSelector((state) => state.combat.targets[OPPONENT_FIGHTER_ID]);
  const opponentIndex = (characterIds.indexOf(selectedCharacter) + 1) % characterIds.length;
  const opponentId = characterIds[opponentIndex] ?? selectedCharacter;
  const playerName = characters[selectedCharacter].name;
  const opponentName = characters[opponentId].name;
  const playerHp = player?.hp ?? 0;
  const opponentHp = opponent?.hp ?? 0;
  const result =
    playerHp <= 0 && opponentHp <= 0
      ? "Draw"
      : opponentHp <= 0
        ? "You win"
        : playerHp <= 0
          ? "You lose"
          : null;

  return (
    <div className="pointer-events-none absolute top-3 right-3 z-10 flex flex-col items-end gap-3">
      {result ? (
        <p
          data-match-result={result}
          className="rounded-full bg-black/70 px-4 py-1.5 font-mono text-sm tracking-wide text-white"
        >
          {result}
        </p>
      ) : null}
      <div className="flex items-end gap-8 rounded-xl border border-white/10 bg-black/55 px-4 py-3 shadow-lg backdrop-blur-sm">
        <HealthBar
          label={playerName}
          hp={playerHp}
          maxHp={player?.maxHp ?? 1}
          fillClassName="bg-emerald-400"
        />
        <span className="pb-1 font-mono text-[10px] tracking-[0.2em] text-zinc-400">VS</span>
        <HealthBar
          label={opponentName}
          hp={opponentHp}
          maxHp={opponent?.maxHp ?? 1}
          fillClassName="bg-rose-400"
        />
      </div>
    </div>
  );
}

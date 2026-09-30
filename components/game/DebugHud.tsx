"use client";

import { useEffect, useSyncExternalStore } from "react";
import { characterIds, characters, controlHint } from "@/lib/game/characters";
import {
  getFeelDebug,
  getFeelDebugServerSnapshot,
  subscribeFeelDebug,
} from "@/lib/game/combat/feelDebug";
import {
  getHitstopServerSnapshot,
  getHitstopSnapshot,
  subscribeHitstop,
} from "@/lib/game/combat/hitstop";
import {
  getAttackHits,
  getAttackHitsServerSnapshot,
  subscribeAttackHits,
} from "@/lib/game/combat/runtime";
import { getControllerDebug, subscribeControllerDebug } from "@/lib/game/runtime";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { toggleShowHitboxes, TRAINING_DUMMY_ID } from "@/store/slices/combatSlice";
import { setSelectedCharacter } from "@/store/slices/gameSlice";

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
  const dispatch = useAppDispatch();
  const currentAnimation = useAppSelector((state) => state.game.currentAnimation);
  const selectedCharacter = useAppSelector((state) => state.game.selectedCharacter);
  const attackPhase = useAppSelector((state) => state.combat.attackPhase);
  const attackId = useAppSelector((state) => state.combat.attackId);
  const showHitboxes = useAppSelector((state) => state.combat.showHitboxes);
  const lastActiveFrames = useAppSelector((state) => state.combat.lastActiveFrames);
  const lastDamage = useAppSelector((state) => state.combat.lastDamage);
  const dummy = useAppSelector((state) => state.combat.targets[TRAINING_DUMMY_ID]);
  const character = characters[selectedCharacter];
  const debug = useSyncExternalStore(
    subscribeControllerDebug,
    getControllerDebug,
    getControllerDebug,
  );
  const hitstop = useSyncExternalStore(
    subscribeHitstop,
    getHitstopSnapshot,
    getHitstopServerSnapshot,
  );
  const feel = useSyncExternalStore(
    subscribeFeelDebug,
    getFeelDebug,
    getFeelDebugServerSnapshot,
  );
  const targetsHit = useSyncExternalStore(
    subscribeAttackHits,
    getAttackHits,
    getAttackHitsServerSnapshot,
  );

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
      if (event.code === "KeyH") {
        dispatch(toggleShowHitboxes());
      }
      if (event.code === "KeyC") {
        const index = characterIds.indexOf(selectedCharacter);
        const next = characterIds[(index + 1) % characterIds.length] ?? selectedCharacter;
        dispatch(setSelectedCharacter(next));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch, selectedCharacter]);

  const hud = character.hud;
  const attackRows = hud.attackHud({
    attackId,
    phase: attackPhase,
    showHitboxes,
  });
  const controls = controlHint(character);

  const hitLabel =
    feel.hitX === null || feel.hitY === null || feel.hitZ === null
      ? "—"
      : `${feel.hitX.toFixed(2)}, ${feel.hitY.toFixed(2)}, ${feel.hitZ.toFixed(2)}`;
  const impulseLabel =
    feel.knockbackH === null || feel.knockbackV === null
      ? "—"
      : `${feel.knockbackH.toFixed(1)} h · ${feel.knockbackV.toFixed(1)} v`;

  return (
    <aside className="pointer-events-none absolute top-3 left-3 z-10 w-72 rounded-lg border border-white/10 bg-black/70 p-3 font-mono text-xs text-zinc-100 shadow-lg backdrop-blur-sm">
      <p className="text-sm font-semibold tracking-wide text-white">{character.name}</p>
      <dl className="mt-2 space-y-1">
        <DebugRow label="Character" value={character.name} />
        <DebugRow
          label="Animation"
          value={currentAnimation}
          valueClassName="text-emerald-300"
        />
        <DebugRow label={hud.movementLabel} value={hud.formatMovement(debug.movementState)} />
        <DebugRow label="Grounded" value={hud.formatGrounded(debug.grounded)} />
        <DebugRow label="Speed" value={debug.speed.toFixed(2)} />
        <DebugRow
          label={attackRows.phaseTitle}
          value={attackRows.phaseLabel}
          valueClassName="text-amber-200"
        />
        <DebugRow label={attackRows.attackTitle} value={attackId ?? "none"} />
        <DebugRow
          label={attackRows.hitboxTitle}
          value={attackRows.hitboxLabel}
          valueClassName={
            attackRows.hitboxLabel === "LIVE" ||
            attackRows.hitboxLabel === "active" ||
            attackRows.hitboxLabel === "ACTIVE"
              ? "text-red-300"
              : "text-zinc-100"
          }
        />
        <DebugRow label="Active frames" value={String(lastActiveFrames)} />
        {hud.showTargetsHit ? <DebugRow label="Targets hit" value={String(targetsHit)} /> : null}
        <DebugRow label="Dummy HP" value={dummy ? `${dummy.hp}` : "—"} />
        <DebugRow label="Dummy stun" value={dummy?.hitstun ? "yes" : "no"} />
        <DebugRow label="Last hit" value={lastDamage ? String(lastDamage.amount) : "—"} />
        {showHitboxes ? (
          <>
            <DebugRow
              label="Hitstop"
              value={hitstop.active ? "yes" : "no"}
              valueClassName={hitstop.active ? "text-amber-200" : "text-zinc-100"}
            />
            <DebugRow label="Hit" value={hitLabel} />
            <DebugRow label="Knockback" value={impulseLabel} />
            <DebugRow label="Kb speed" value={feel.liveKnockback.toFixed(1)} />
          </>
        ) : null}
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
          <span className="text-zinc-200">J</span> {controls.light}{" "}
          <span className="text-zinc-200">K</span> {controls.heavy}
        </li>
        <li>
          <span className="text-zinc-200">H</span> hitboxes
        </li>
        <li>
          <span className="text-zinc-200">C</span> switch character
        </li>
      </ul>
    </aside>
  );
}

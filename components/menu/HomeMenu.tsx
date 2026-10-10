"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useProgress } from "@react-three/drei";
import { characterIds, characters, type CharacterId } from "@/lib/game/characters";
import { arenas, matchHref, matchModes, type ArenaId, type MatchMode } from "@/lib/game/matchSetup";
import { rosterCopy } from "@/lib/game/roster";
import { OmnitrixStage } from "@/components/menu/OmnitrixStage";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setMatchMode, setSelectedArena, setSelectedCharacter } from "@/store/slices/gameSlice";

const steps = [
  { id: "alien", label: "Alien" },
  { id: "mode", label: "Mode" },
  { id: "arena", label: "Arena" },
] as const;

type MenuStep = (typeof steps)[number]["id"];

const arenaSwatch: Record<ArenaId, string> = {
  desert: "bg-gradient-to-b from-[#f0d7a2] via-[#d3924e] to-[#7a4a28]",
  havana: "bg-gradient-to-b from-[#7eb6d6] via-[#efe6d6] to-[#3e5344]",
};

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
      <path
        d={direction === "left" ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChoiceCard({
  selected,
  kicker,
  title,
  summary,
  onSelect,
  swatch,
}: {
  selected: boolean;
  kicker?: string;
  title: string;
  summary: string;
  onSelect: () => void;
  swatch?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
        selected
          ? "border-[#6dff9a] bg-[#10291c]/90 shadow-[0_0_28px_rgba(109,255,154,0.16)]"
          : "border-white/10 bg-black/40 hover:border-white/30"
      }`}
    >
      {swatch}
      {kicker ? (
        <span className="block text-[10px] tracking-[0.28em] text-[#8dffb0] uppercase">{kicker}</span>
      ) : null}
      <span className="mt-1 block font-[family-name:var(--font-display)] text-lg tracking-wide text-white">
        {title}
      </span>
      <span className="mt-1 block text-sm leading-6 text-[#b7cfc0]">{summary}</span>
    </button>
  );
}

function Charging() {
  const { active, progress } = useProgress();
  if (!active && progress >= 100) {
    return null;
  }
  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-[#03110c]/55">
      <p className="font-[family-name:var(--font-display)] text-xs tracking-[0.42em] text-[#d8ffc8]">
        CHARGING {Math.round(progress)}%
      </p>
    </div>
  );
}

export function HomeMenu() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const storedCharacter = useAppSelector((state) => state.game.selectedCharacter);
  const storedMode = useAppSelector((state) => state.game.matchMode);
  const storedArena = useAppSelector((state) => state.game.arenaId);
  const [step, setStep] = useState<MenuStep>("alien");
  const [characterId, setCharacterId] = useState<CharacterId>(storedCharacter);
  const [mode, setMode] = useState<MatchMode>(storedMode);
  const [arenaId, setArenaId] = useState<ArenaId>(storedArena);
  const profile = rosterCopy[characterId];
  const alien = characters[characterId];

  const browse = useCallback((direction: number) => {
    setCharacterId((current) => {
      const index = characterIds.indexOf(current);
      const next = characterIds[(index + direction + characterIds.length) % characterIds.length];
      return next && next !== current ? next : current;
    });
  }, []);

  const enterMatch = useCallback(() => {
    dispatch(setSelectedCharacter(characterId));
    dispatch(setMatchMode(mode));
    dispatch(setSelectedArena(arenaId));
    router.push(matchHref({ alien: characterId, mode, arena: arenaId }));
  }, [arenaId, characterId, dispatch, mode, router]);

  const goNext = useCallback(() => {
    if (step === "alien") {
      setStep("mode");
      return;
    }
    if (step === "mode") {
      setStep("arena");
      return;
    }
    enterMatch();
  }, [enterMatch, step]);

  const goBack = useCallback(() => {
    if (step === "arena") {
      setStep("mode");
      return;
    }
    if (step === "mode") {
      setStep("alien");
    }
  }, [step]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (event.target instanceof HTMLButtonElement) {
        return;
      }
      if (step === "alien" && event.code === "ArrowLeft") {
        event.preventDefault();
        browse(-1);
      }
      if (step === "alien" && event.code === "ArrowRight") {
        event.preventDefault();
        browse(1);
      }
      if (step === "mode" && (event.code === "ArrowLeft" || event.code === "ArrowUp")) {
        event.preventDefault();
        setMode("training");
      }
      if (step === "mode" && (event.code === "ArrowRight" || event.code === "ArrowDown")) {
        event.preventDefault();
        setMode("cpu");
      }
      if (event.code === "Enter") {
        event.preventDefault();
        goNext();
      }
      if (event.code === "Escape" || event.code === "Backspace") {
        event.preventDefault();
        goBack();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [browse, goBack, goNext, step]);

  return (
    <main className="relative h-dvh overflow-hidden bg-[#03110c] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,#145232_0%,#03110c_58%,#010806_100%)]" />
      <div className="absolute inset-0">
        <OmnitrixStage characterId={characterId} compact={step !== "alien"} />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.45)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-[#03110c] via-[#03110c]/88 to-transparent" />
      <Charging />

      <div className="pointer-events-none relative z-10 flex h-full flex-col">
        <header className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-8 sm:pt-7">
          <div>
            <p className="font-[family-name:var(--font-display)] text-[11px] tracking-[0.55em] text-[#8dffb0]">
              BEN 10
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-[0.16em] text-white sm:text-4xl">
              ULTIMATE
            </h1>
          </div>
          <ol className="pointer-events-auto flex gap-1 sm:gap-2">
            {steps.map((item, index) => {
              const active = item.id === step;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setStep(item.id)}
                    aria-current={active ? "step" : undefined}
                    className={`rounded-full px-3 py-2 text-left transition ${
                      active ? "bg-[#143222] text-white" : "text-white/45 hover:text-white/80"
                    }`}
                  >
                    <span className="block font-[family-name:var(--font-display)] text-[9px] tracking-[0.22em] text-[#8dffb0]">
                      0{index + 1}
                    </span>
                    <span className="font-[family-name:var(--font-display)] text-xs tracking-[0.16em] uppercase">
                      {item.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </header>

        <div className="flex-1" />

        <section className="pointer-events-auto mx-auto w-full max-w-xl px-5 pb-6 sm:pb-8">
          {step === "alien" ? (
            <div className="flex items-center gap-3 sm:gap-5">
              <button
                type="button"
                onClick={() => browse(-1)}
                aria-label="Previous alien"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[#6dff9a]/40 bg-black/45 text-[#d8ffc8] transition hover:bg-[#6dff9a]/15"
              >
                <Chevron direction="left" />
              </button>
              <div className="min-w-0 flex-1 text-center">
                <p className="text-[11px] tracking-[0.32em] text-[#8dffb0] uppercase">{profile.species}</p>
                <h2
                  className="truncate font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-wide sm:text-4xl"
                  style={{ color: profile.accent }}
                >
                  {alien.name}
                </h2>
                <p className="mt-1 text-sm leading-6 text-[#d5e7db]">{profile.summary}</p>
                <p className="mt-2 text-[11px] tracking-wide text-white/45">
                  {characterIds.indexOf(characterId) + 1} / {characterIds.length}
                  <span className="mx-2 text-white/25">·</span>
                  Dial locks once the match starts
                </p>
              </div>
              <button
                type="button"
                onClick={() => browse(1)}
                aria-label="Next alien"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[#6dff9a]/40 bg-black/45 text-[#d8ffc8] transition hover:bg-[#6dff9a]/15"
              >
                <Chevron direction="right" />
              </button>
            </div>
          ) : null}

          {step === "mode" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {matchModes.map((option) => (
                <ChoiceCard
                  key={option.id}
                  selected={mode === option.id}
                  title={option.name}
                  summary={option.summary}
                  onSelect={() => setMode(option.id)}
                />
              ))}
            </div>
          ) : null}

          {step === "arena" ? (
            <div className="grid gap-3">
              {arenas.map((arena) => (
                <ChoiceCard
                  key={arena.id}
                  selected={arenaId === arena.id}
                  kicker="Ready now"
                  title={arena.name}
                  summary={arena.summary}
                  onSelect={() => setArenaId(arena.id)}
                  swatch={
                    <div
                      className={`mb-3 h-16 overflow-hidden rounded-xl ${arenaSwatch[arena.id]}`}
                    >
                      {arena.id === "desert" ? (
                        <div className="h-full w-full bg-[radial-gradient(ellipse_at_bottom,#c9843f_0%,transparent_70%)]" />
                      ) : null}
                    </div>
                  }
                />
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex items-center justify-between gap-3">
            {step === "alien" ? (
              <p className="text-[11px] tracking-wide text-white/40">Arrows browse the dial</p>
            ) : (
              <button
                type="button"
                onClick={goBack}
                className="rounded-full px-4 py-2 text-xs tracking-[0.18em] text-white/70 uppercase hover:text-white"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              className="rounded-full bg-[#6dff9a] px-6 py-3 font-[family-name:var(--font-display)] text-xs font-bold tracking-[0.2em] text-[#042014] uppercase transition hover:bg-[#b6ffcf]"
            >
              {step === "arena" ? "Enter arena" : "Continue"}
            </button>
          </div>
          <p className="mt-4 text-center text-[10px] tracking-wide text-white/35">
            Omnitrix model by{" "}
            <a
              className="underline decoration-white/30 underline-offset-2 hover:text-white/60"
              href="https://sketchfab.com/3d-models/omnitrix-omniverse-f19e27a3fb7d4e70aba4144d009eb235"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ryu.Ichi
            </a>
            , CC BY 4.0
          </p>
        </section>
      </div>
    </main>
  );
}

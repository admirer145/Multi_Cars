import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import Phaser from "phaser";
import {
  ArrowLeft,
  Gauge,
  Headphones,
  Lock,
  Medal,
  Play,
  RotateCcw,
  Settings,
  Shield,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";
import { createGameConfig } from "./gameConfig";
import {
  MENU_REQUEST_EVENT,
  RUN_ENDED_EVENT,
  type AppScreen,
  type GameBootConfig,
  type PlayMode,
  type RunEndedDetail,
} from "./gameBridge";
import {
  AUTHORED_TRACKS,
  getAuthoredTracksByCategory,
  type AuthoredTrack,
} from "../core/patterns/authoredTracks";
import { createInitialChallengeProgress } from "../core/modes/challengeMode";
import { loadChallengeProgress, loadClassicHighScore } from "../persistence/storage";

type ChallengeCategory = AuthoredTrack["category"];

const categoryLabels: Record<ChallengeCategory, string> = {
  focus: "Focus",
  coordination: "Coordination",
  recognition: "Recognition",
  reaction: "Reaction",
  endurance: "Endurance",
};

const categoryOrder = Object.keys(categoryLabels) as ChallengeCategory[];

export function App(): ReactElement {
  const [screen, setScreen] = useState<AppScreen>("home");
  const [activeRun, setActiveRun] = useState<GameBootConfig | null>(null);
  const [summary, setSummary] = useState<RunEndedDetail | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ChallengeCategory>("focus");

  useEffect(() => {
    const handleRunEnded = (event: WindowEventMap[typeof RUN_ENDED_EVENT]) => {
      setSummary(event.detail);
      setScreen("summary");
    };
    const handleMenuRequested = () => {
      setActiveRun(null);
      setSummary(null);
      setScreen("home");
    };

    window.addEventListener(RUN_ENDED_EVENT, handleRunEnded);
    window.addEventListener(MENU_REQUEST_EVENT, handleMenuRequested);
    return () => {
      window.removeEventListener(RUN_ENDED_EVENT, handleRunEnded);
      window.removeEventListener(MENU_REQUEST_EVENT, handleMenuRequested);
    };
  }, []);

  useEffect(() => {
    document.body.dataset.screen = screen === "home" ? "menu" : screen;
    document.body.dataset.gameStatus = screen === "home" ? "menu" : screen;
    document.body.dataset.mode = activeRun?.mode ?? summary?.mode ?? "";
  }, [activeRun?.mode, screen, summary?.mode]);

  useLayoutEffect(() => {
    if (screen !== "gameplay" && screen !== "summary") {
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [screen]);

  const startRun = (mode: PlayMode, options: Partial<GameBootConfig> = {}) => {
    const run = { mode, ...options };
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    setSummary(null);
    setActiveRun(run);
    setScreen("gameplay");
  };

  const showGameCanvas = screen === "gameplay" || screen === "summary";

  return (
    <main className="relative min-h-screen bg-ink text-slate-50">
      <Atmosphere />
      {showGameCanvas && activeRun ? (
        <GameCanvas key={getRunKey(activeRun)} bootConfig={activeRun} dimmed={screen === "summary"} />
      ) : null}

      {screen === "home" ? (
        <HomeScreen
          onClassic={() => startRun("classic", { runIndex: 0 })}
          onChallenge={() => setScreen("challenge-select")}
          onSettings={() => setScreen("settings")}
        />
      ) : null}

      {screen === "challenge-select" ? (
        <ChallengeScreen
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onBack={() => setScreen("home")}
          onStart={(trackId) => startRun("challenge", { trackId })}
        />
      ) : null}

      {screen === "settings" ? <SettingsScreen onBack={() => setScreen("home")} /> : null}

      {screen === "summary" && summary ? (
        <SummaryOverlay
          detail={summary}
          onMenu={() => {
            setActiveRun(null);
            setSummary(null);
            setScreen("home");
          }}
          onReplay={() =>
            startRun(summary.mode, {
              runIndex: summary.nextRunIndex,
              trackId: summary.trackId,
            })
          }
        />
      ) : null}
    </main>
  );
}

function GameCanvas({
  bootConfig,
  dimmed,
}: {
  bootConfig: GameBootConfig;
  dimmed: boolean;
}): ReactElement {
  return (
    <div className={`fixed inset-0 transition-opacity duration-500 ${dimmed ? "opacity-45 blur-[1px]" : ""}`}>
      <PhaserMount bootConfig={bootConfig} />
    </div>
  );
}

function PhaserMount({ bootConfig }: { bootConfig: GameBootConfig }): ReactElement {
  const [host, setHost] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!host) {
      return undefined;
    }

    window.__MULTI_CARS_BOOT__ = bootConfig;
    const game = new Phaser.Game(createGameConfig(host));
    return () => {
      game.destroy(true);
    };
  }, [bootConfig, host]);

  return <div ref={setHost} className="h-screen w-screen" aria-label="Multi Cars gameplay canvas" />;
}

function HomeScreen({
  onClassic,
  onChallenge,
  onSettings,
}: {
  onClassic: () => void;
  onChallenge: () => void;
  onSettings: () => void;
}): ReactElement {
  const bestScore = loadClassicHighScore();

  return (
    <ScreenShell>
      <section className="grid min-h-screen grid-rows-[auto_1fr] gap-6 px-5 py-7 sm:px-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.28em] text-cyanline">Reflex Lab</p>
            <h1 className="mt-2 text-5xl font-black leading-none sm:text-7xl">Multi Cars</h1>
            <p className="mt-3 max-w-sm text-base font-semibold text-slate-300">
              Split attention. Read the lanes. Keep both hands honest.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-right shadow-gold backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Best</p>
            <p className="text-3xl font-black text-goldline">{bestScore}</p>
          </div>
        </header>

        <div className="grid items-end gap-5 lg:grid-cols-[1fr_0.9fr]">
          <div className="space-y-4">
            <ModeButton
              icon={<Play />}
              title="Classic Run"
              detail="Endless road pressure with deterministic skill patterns."
              accent="cyan"
              onClick={onClassic}
            />
            <ModeButton
              icon={<Trophy />}
              title="Challenge Roads"
              detail="Skill categories, locked levels, themed roads, and mastery stars."
              accent="gold"
              onClick={onChallenge}
            />
            <ModeButton
              icon={<Settings />}
              title="Control Room"
              detail="Gameplay, comfort, sound, visual, and local data options."
              accent="slate"
              onClick={onSettings}
            />
          </div>
          <RoadShowcase />
        </div>
      </section>
    </ScreenShell>
  );
}

function ChallengeScreen({
  selectedCategory,
  onSelectCategory,
  onBack,
  onStart,
}: {
  selectedCategory: ChallengeCategory;
  onSelectCategory: (category: ChallengeCategory) => void;
  onBack: () => void;
  onStart: (trackId: string) => void;
}): ReactElement {
  const tracks = getAuthoredTracksByCategory(selectedCategory);

  return (
    <ScreenShell>
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 px-5 py-7 sm:px-8">
        <TopBar title="Challenge Roads" detail="Pick a skill category. Clear roads to open higher levels." onBack={onBack} />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {categoryOrder.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => onSelectCategory(category)}
              className={`rounded-2xl border px-3 py-3 text-sm font-black transition ${
                selectedCategory === category
                  ? "border-cyanline bg-cyanline text-ink shadow-glow"
                  : "border-white/10 bg-white/8 text-slate-200 hover:border-white/25"
              }`}
            >
              {categoryLabels[category]}
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {tracks.length ? (
            tracks.map((track) => (
              <ChallengeCard key={track.id} track={track} locked={isTrackLocked(track)} onStart={onStart} />
            ))
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/8 p-8 text-slate-300">
              Roads for this category are being tuned.
            </div>
          )}
        </div>
      </section>
    </ScreenShell>
  );
}

function SettingsScreen({ onBack }: { onBack: () => void }): ReactElement {
  return (
    <ScreenShell>
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-5 px-5 py-7 sm:px-8">
        <TopBar title="Control Room" detail="A scalable settings surface for gameplay, comfort, visuals, audio, and data." onBack={onBack} />
        <div className="grid gap-4 md:grid-cols-2">
          <SettingsPanel icon={<Gauge />} title="Gameplay" rows={["Input: tap sides / keyboard", "Start speed: normal", "Road density: adaptive"]} />
          <SettingsPanel icon={<Shield />} title="Comfort" rows={["Reduced motion: off", "Contrast: high", "Screen shake: low"]} />
          <SettingsPanel icon={<Headphones />} title="Audio" rows={["Sound effects: on", "Music: off", "Haptics: planned"]} />
          <SettingsPanel icon={<Sparkles />} title="Visuals & Data" rows={["Theme: road based", "Save data: local", "Cloud sync: later"]} />
        </div>
      </section>
    </ScreenShell>
  );
}

function SummaryOverlay({
  detail,
  onMenu,
  onReplay,
}: {
  detail: RunEndedDetail;
  onMenu: () => void;
  onReplay: () => void;
}): ReactElement {
  const { summary } = detail;

  useEffect(() => {
    document.body.dataset.screen = "summary";
    document.body.dataset.gameStatus = "summary";
    document.body.dataset.mode = summary.modeId;
  }, [summary.modeId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "r" || event.key === "R" || event.key === "Enter") {
        event.preventDefault();
        onReplay();
      }

      if (event.key === "m" || event.key === "M" || event.key === "Escape") {
        event.preventDefault();
        onMenu();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onMenu, onReplay]);

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-ink/55 px-5 backdrop-blur-sm">
      <section className="w-full max-w-md rounded-[2rem] border border-white/15 bg-panel/92 p-6 text-center shadow-2xl">
        <p className="text-sm font-black uppercase tracking-[0.26em] text-dangerline">
          {summary.result === "completed" ? "Road Cleared" : "Run Ended"}
        </p>
        <h2 className="mt-3 text-4xl font-black">{summary.modeLabel}</h2>
        <p className="mt-2 text-slate-300">
          {formatFailure(summary.failureReason)}
          {summary.failedPatternFamily ? ` - ${summary.failedPatternFamily}` : ""}
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <ScoreTile label={summary.modeId === "challenge" ? "Progress" : "Score"} value={summary.modeId === "challenge" ? `${summary.completedPercent}%` : summary.score} />
          <ScoreTile label="Best" value={summary.modeId === "challenge" ? `${summary.bestScore}%` : summary.bestScore} />
          <ScoreTile label={summary.modeId === "challenge" ? "Stars" : "Speed"} value={summary.modeId === "challenge" ? `${summary.stars ?? 0}/3` : summary.speedLevel} />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={onReplay} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyanline px-4 py-4 font-black text-ink shadow-glow">
            <RotateCcw size={18} /> Again
          </button>
          <button type="button" onClick={onMenu} className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4 font-black text-slate-100">
            Menu
          </button>
        </div>
      </section>
    </div>
  );
}

function ModeButton({
  icon,
  title,
  detail,
  accent,
  onClick,
}: {
  icon: ReactElement;
  title: string;
  detail: string;
  accent: "cyan" | "gold" | "slate";
  onClick: () => void;
}): ReactElement {
  const color =
    accent === "cyan"
      ? "border-cyanline/70 shadow-glow"
      : accent === "gold"
        ? "border-goldline/70 shadow-gold"
        : "border-white/12";
  const iconBg = accent === "cyan" ? "bg-cyanline text-ink" : accent === "gold" ? "bg-goldline text-ink" : "bg-white/10 text-slate-100";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-4 rounded-3xl border bg-panel/82 p-4 text-left backdrop-blur transition hover:-translate-y-0.5 hover:bg-panel ${color}`}
    >
      <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${iconBg}`}>{icon}</span>
      <span>
        <span className="block text-2xl font-black">{title}</span>
        <span className="mt-1 block text-sm font-semibold leading-snug text-slate-300">{detail}</span>
      </span>
    </button>
  );
}

function ChallengeCard({
  track,
  locked,
  onStart,
}: {
  track: AuthoredTrack;
  locked: boolean;
  onStart: (trackId: string) => void;
}): ReactElement {
  const progress = loadChallengeProgress(track.id, createInitialChallengeProgress(track.id));

  return (
    <button
      type="button"
      disabled={locked}
      onClick={() => onStart(track.id)}
      className={`relative overflow-hidden rounded-3xl border p-5 text-left transition ${
        locked
          ? "border-white/8 bg-white/[0.04] text-slate-500"
          : "border-white/12 bg-panel/85 text-slate-50 hover:-translate-y-0.5 hover:border-cyanline/60"
      }`}
    >
      <div className={`absolute right-4 top-4 h-24 w-24 rounded-full blur-2xl ${getThemeGlow(track.roadTheme)}`} />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyanline">
            {categoryLabels[track.category]} / Level {track.level}
          </p>
          <h3 className="mt-2 text-2xl font-black">{track.label}</h3>
          <p className="mt-2 max-w-sm text-sm font-semibold leading-relaxed text-slate-300">{track.description}</p>
        </div>
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/8">
          {locked ? <Lock /> : <Medal className="text-goldline" />}
        </div>
      </div>
      <div className="relative mt-5 flex items-center justify-between text-sm font-black">
        <span>{locked ? "Clear previous road" : `Best ${progress.bestPercent}%`}</span>
        <span className="inline-flex items-center gap-1 text-goldline">
          <Star size={16} fill="currentColor" /> {progress.stars}/3
        </span>
      </div>
    </button>
  );
}

function RoadShowcase(): ReactElement {
  return (
    <div className="relative hidden min-h-[520px] overflow-hidden rounded-[2rem] border border-white/10 bg-white/8 shadow-2xl backdrop-blur lg:block">
      <div className="absolute left-1/2 top-8 h-[620px] w-52 -translate-x-1/2 rounded-[2rem] bg-slate-800 shadow-glow">
        <div className="absolute inset-x-6 inset-y-0 rounded-2xl bg-slate-700/70" />
        <div className="absolute left-1/2 top-0 h-full w-1 -translate-x-1/2 bg-goldline/70 [background:repeating-linear-gradient(to_bottom,#ffd166_0_36px,transparent_36px_78px)]" />
        <div className="absolute left-10 top-72 h-20 w-11 rounded-xl bg-cyanline shadow-glow" />
        <div className="absolute right-10 top-44 h-20 w-11 rounded-xl bg-goldline shadow-gold" />
        <div className="absolute left-10 top-28 h-11 w-11 rounded-full bg-emerald-300" />
        <div className="absolute right-10 top-96 h-12 w-12 rounded-lg bg-dangerline" />
      </div>
    </div>
  );
}

function SettingsPanel({ icon, title, rows }: { icon: ReactElement; title: string; rows: string[] }): ReactElement {
  return (
    <section className="rounded-3xl border border-white/10 bg-panel/84 p-5 shadow-2xl">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cyanline text-ink">{icon}</span>
        <h3 className="text-2xl font-black">{title}</h3>
      </div>
      <div className="mt-5 space-y-3">
        {rows.map((row) => (
          <div key={row} className="rounded-2xl bg-white/6 px-4 py-3 text-sm font-bold text-slate-300">
            {row}
          </div>
        ))}
      </div>
    </section>
  );
}

function TopBar({
  title,
  detail,
  onBack,
}: {
  title: string;
  detail: string;
  onBack: () => void;
}): ReactElement {
  return (
    <header className="flex items-start gap-4">
      <button type="button" onClick={onBack} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/8">
        <ArrowLeft />
      </button>
      <div>
        <h1 className="text-4xl font-black sm:text-5xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-300 sm:text-base">{detail}</p>
      </div>
    </header>
  );
}

function ScoreTile({ label, value }: { label: string; value: string | number }): ReactElement {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/8 px-3 py-4">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-goldline">{value}</p>
    </div>
  );
}

function ScreenShell({ children }: { children: ReactNode }): ReactElement {
  return <div className="relative z-10 min-h-screen">{children}</div>;
}

function Atmosphere(): ReactElement {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#111827_0%,#070b12_68%)]" />
      <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_50%_0%,rgba(61,214,198,0.22),transparent_58%)]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.4)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.4)_1px,transparent_1px)] [background-size:46px_46px]" />
    </div>
  );
}

function isTrackLocked(track: AuthoredTrack): boolean {
  if (track.level <= 1) {
    return false;
  }

  const previous = getAuthoredTracksByCategory(track.category).find((candidate) => candidate.level === track.level - 1);
  if (!previous) {
    return false;
  }

  return !loadChallengeProgress(previous.id, createInitialChallengeProgress(previous.id)).completed;
}

function getRunKey(run: GameBootConfig): string {
  return `${run.mode}-${run.trackId ?? ""}-${run.runIndex ?? 0}`;
}

function getThemeGlow(theme: AuthoredTrack["roadTheme"]): string {
  if (theme === "neon") return "bg-cyanline/30";
  if (theme === "storm") return "bg-dangerline/30";
  if (theme === "canyon") return "bg-goldline/30";
  return "bg-sky-300/25";
}

function formatFailure(reason: string | undefined): string {
  if (reason === "hit-obstacle") return "Obstacle hit";
  if (reason === "missed-collectible") return "Collectible missed";
  return "Clean finish";
}

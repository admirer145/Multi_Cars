import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactElement, ReactNode } from "react";
import Phaser from "phaser";
import {
  Car,
  ArrowLeft,
  Gauge,
  Headphones,
  Keyboard,
  CalendarDays,
  Award,
  Lock,
  Medal,
  Palette,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Shield,
  Sparkles,
  Star,
  Target,
  Trophy,
} from "lucide-react";
import { createGameConfig, GAME_HEIGHT, GAME_WIDTH } from "./gameConfig";
import {
  playUiClick,
  playUiToggle,
  unlockAudio,
} from "./audio";
import {
  MENU_REQUEST_EVENT,
  RUN_ENDED_EVENT,
  emitControlRoomUpdated,
  type AppScreen,
  type GameBootConfig,
  type PlayMode,
  type RunEndedDetail,
} from "./gameBridge";
import {
  ACHIEVEMENTS,
  CAR_SKINS,
  getAchievement,
  isCarSkinUnlocked,
  updateAchievementsForSummary,
  type AchievementState,
  type CarSkinId,
} from "../core/engagement/achievements";
import { COLLECTION_Y, getActiveRoadSides } from "../core/constants";
import type { SupportedClassicCarCount } from "../core/constants";
import {
  AUTHORED_TRACKS,
  getAuthoredTracksByCategory,
  type AuthoredTrack,
} from "../core/patterns/authoredTracks";
import { createInitialChallengeProgress } from "../core/modes/challengeMode";
import {
  CLASSIC_CAR_OPTIONS,
  MAX_CLASSIC_SPEED_LEVEL,
  MIN_CLASSIC_SPEED_LEVEL,
  formatClassicModeLabel,
  type ClassicSpeedSettings,
} from "../core/modes/classicMode";
import { createDailyRun, createInitialDailyProgress } from "../core/modes/dailyMode";
import { createInitialPracticeProgress, PRACTICE_DRILLS, type PracticeDrill } from "../core/modes/practiceMode";
import {
  OBSTACLE_VARIETY_OPTIONS,
  POWER_UP_OPTIONS,
  type GameplayModifierMeta,
  type GameplayModifierSettings,
  type ObstacleVarietyId,
  type PowerUpId,
} from "../core/modifiers/gameplayModifiers";
import type { ReplayClip, ReplayFrame } from "../core/replay/replayBuffer";
import type { AudioSettings } from "../core/audio/audioSettings";
import type { ActiveObjectState, RoadSide } from "../core/types";
import {
  loadAudioSettings,
  loadChallengeProgress,
  loadClassicHighScore,
  loadClassicHighScoreForCarCount,
  loadClassicSpeedSettings,
  loadAchievementState,
  loadDailyProgress,
  loadGameplayModifierSettings,
  loadPracticeProgress,
  loadSelectedCarSkin,
  saveAchievementState,
  saveAudioSettings,
  saveClassicSpeedSettings,
  saveGameplayModifierSettings,
  saveSelectedCarSkin,
} from "../persistence/storage";

type ChallengeCategory = AuthoredTrack["category"];

const categoryLabels: Record<ChallengeCategory, string> = {
  focus: "Focus",
  coordination: "Coordination",
  recognition: "Recognition",
  reaction: "Reaction",
  endurance: "Endurance",
};

const categoryOrder = Object.keys(categoryLabels) as ChallengeCategory[];
const SPEED_LEVEL_OPTIONS = Array.from(
  { length: MAX_CLASSIC_SPEED_LEVEL - MIN_CLASSIC_SPEED_LEVEL + 1 },
  (_, index) => MIN_CLASSIC_SPEED_LEVEL + index,
);

type AppHistoryState = {
  multiCars: true;
  screen: AppScreen;
  activeRun?: GameBootConfig | null;
};

export function App(): ReactElement {
  const [screen, setScreen] = useState<AppScreen>("home");
  const [activeRun, setActiveRun] = useState<GameBootConfig | null>(null);
  const [summary, setSummary] = useState<RunEndedDetail | null>(null);
  const activeRunRef = useRef<GameBootConfig | null>(null);
  const summaryRef = useRef<RunEndedDetail | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ChallengeCategory>("focus");
  const [classicSpeedSettings, setClassicSpeedSettings] = useState<ClassicSpeedSettings>(() =>
    loadClassicSpeedSettings(),
  );
  const [gameplayModifierSettings, setGameplayModifierSettings] = useState<GameplayModifierSettings>(() =>
    loadGameplayModifierSettings(),
  );
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() => loadAudioSettings());
  const [achievementState, setAchievementState] = useState<AchievementState>(() => loadAchievementState());
  const [selectedCarSkinId, setSelectedCarSkinId] = useState<CarSkinId>(() => loadSelectedCarSkin());

  useEffect(() => {
    activeRunRef.current = activeRun;
  }, [activeRun]);

  useEffect(() => {
    summaryRef.current = summary;
  }, [summary]);

  useEffect(() => {
    replaceAppHistoryState("home", null);

    const handlePopState = (event: PopStateEvent) => {
      const historyState = parseAppHistoryState(event.state);
      const nextScreen = historyState?.screen ?? "home";

      if (nextScreen === "summary" && !summaryRef.current) {
        const fallbackScreen = getRunReturnScreen(historyState?.activeRun?.mode ?? activeRunRef.current?.mode ?? "classic");
        setActiveRun(null);
        setSummary(null);
        setScreen(fallbackScreen);
        replaceAppHistoryState(fallbackScreen, null);
        return;
      }

      setScreen(nextScreen);

      if (nextScreen === "gameplay" && historyState?.activeRun) {
        setActiveRun(historyState.activeRun);
        setSummary(null);
        return;
      }

      if (nextScreen !== "gameplay" && nextScreen !== "summary") {
        setActiveRun(null);
      }

      if (nextScreen !== "summary") {
        setSummary(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const handleRunEnded = (event: WindowEventMap[typeof RUN_ENDED_EVENT]) => {
      const currentAchievementState = loadAchievementState();
      const update = updateAchievementsForSummary(currentAchievementState, event.detail.summary);
      const savedAchievementState = saveAchievementState(update.state);
      setAchievementState(savedAchievementState);
      setSelectedCarSkinId(loadSelectedCarSkin());
      setSummary({
        ...event.detail,
        unlockedAchievementIds: update.newlyUnlockedIds,
      });
      setScreen("summary");
      replaceAppHistoryState("summary", activeRunRef.current);
    };
    const handleMenuRequested = () => {
      navigateToStaticScreen("home", { replace: true });
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

  const navigateToStaticScreen = (
    nextScreen: Exclude<AppScreen, "gameplay" | "summary">,
    options: { replace?: boolean } = {},
  ) => {
    setActiveRun(null);
    setSummary(null);
    setScreen(nextScreen);
    if (options.replace) {
      replaceAppHistoryState(nextScreen, null);
      return;
    }

    pushAppHistoryState(nextScreen, null);
  };

  const goBack = () => {
    if (window.history.state?.multiCars) {
      window.history.back();
      return;
    }

    navigateToStaticScreen("home", { replace: true });
  };

  const startRun = (
    mode: PlayMode,
    options: Partial<GameBootConfig> = {},
    historyOptions: { replace?: boolean } = {},
  ) => {
    const run = { mode, ...options };
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    setSummary(null);
    setActiveRun(run);
    setScreen("gameplay");
    if (historyOptions.replace) {
      replaceAppHistoryState("gameplay", run);
      return;
    }

    pushAppHistoryState("gameplay", run);
  };

  const returnFromSummary = () => {
    if (window.history.state?.multiCars) {
      window.history.back();
      return;
    }

    navigateToStaticScreen(getRunReturnScreen(summary?.mode ?? "classic"), { replace: true });
  };

  const handleClassicSpeedSettingsChange = (nextSettings: ClassicSpeedSettings) => {
    const savedSpeedSettings = saveClassicSpeedSettings(nextSettings);
    setClassicSpeedSettings(savedSpeedSettings);
    emitControlRoomUpdated({
      classicSpeedSettings: savedSpeedSettings,
      gameplayModifierSettings,
    });
  };

  const handleGameplayModifierSettingsChange = (nextSettings: GameplayModifierSettings) => {
    const savedModifierSettings = saveGameplayModifierSettings(nextSettings);
    setGameplayModifierSettings(savedModifierSettings);
    emitControlRoomUpdated({
      classicSpeedSettings,
      gameplayModifierSettings: savedModifierSettings,
    });
  };

  const handleAudioSettingsChange = (nextSettings: AudioSettings) => {
    unlockAudio();
    const savedAudioSettings = saveAudioSettings(nextSettings);
    setAudioSettings(savedAudioSettings);
    playUiToggle(savedAudioSettings.soundEffects);
  };

  const handleCarSkinSelect = (skinId: CarSkinId) => {
    setSelectedCarSkinId(saveSelectedCarSkin(skinId, achievementState));
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
          onClassic={() => navigateToStaticScreen("classic-select")}
          onChallenge={() => navigateToStaticScreen("challenge-select")}
          onPractice={() => navigateToStaticScreen("practice-select")}
          onDaily={() => startRun("daily")}
          onGarage={() => navigateToStaticScreen("garage")}
          onSettings={() => navigateToStaticScreen("settings")}
        />
      ) : null}

      {screen === "classic-select" ? (
        <ClassicScreen
          onBack={goBack}
          onStart={(carCount) => startRun("classic", { runIndex: 0, carCount })}
        />
      ) : null}

      {screen === "challenge-select" ? (
        <ChallengeScreen
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onBack={goBack}
          onStart={(trackId) => startRun("challenge", { trackId })}
        />
      ) : null}

      {screen === "practice-select" ? (
        <PracticeScreen
          onBack={goBack}
          onStart={(drillId) => startRun("practice", { drillId })}
        />
      ) : null}

      {screen === "garage" ? (
        <GarageScreen
          achievementState={achievementState}
          selectedCarSkinId={selectedCarSkinId}
          onSelectCarSkin={handleCarSkinSelect}
          onBack={goBack}
        />
      ) : null}

      {screen === "settings" ? (
        <SettingsScreen
          onBack={goBack}
          classicSpeedSettings={classicSpeedSettings}
          onClassicSpeedSettingsChange={handleClassicSpeedSettingsChange}
          gameplayModifierSettings={gameplayModifierSettings}
          onGameplayModifierSettingsChange={handleGameplayModifierSettingsChange}
          audioSettings={audioSettings}
          onAudioSettingsChange={handleAudioSettingsChange}
        />
      ) : null}

      {screen === "summary" && summary ? (
        <SummaryOverlay
          detail={summary}
          classicSpeedSettings={classicSpeedSettings}
          onClassicSpeedSettingsChange={handleClassicSpeedSettingsChange}
          gameplayModifierSettings={gameplayModifierSettings}
          onGameplayModifierSettingsChange={handleGameplayModifierSettingsChange}
          onBack={returnFromSummary}
          onOpenSettings={() => navigateToStaticScreen("settings")}
          onReplay={() =>
            startRun(
              summary.mode,
              {
                runIndex: summary.nextRunIndex,
                trackId: summary.trackId,
                drillId: summary.drillId,
                carCount: summary.carCount,
              },
              { replace: true },
            )
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
  onPractice,
  onDaily,
  onGarage,
  onSettings,
}: {
  onClassic: () => void;
  onChallenge: () => void;
  onPractice: () => void;
  onDaily: () => void;
  onGarage: () => void;
  onSettings: () => void;
}): ReactElement {
  const bestScore = loadClassicHighScore();
  const dailyRun = createDailyRun();
  const dailyProgress = loadDailyProgress(
    dailyRun.dateKey,
    createInitialDailyProgress(dailyRun.dateKey),
  );

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
              icon={<CalendarDays />}
              title="Daily Road"
              detail={`Today's seeded route. Best ${dailyProgress.bestPercent}% / ${dailyProgress.stars} stars.`}
              accent="gold"
              onClick={onDaily}
            />
            <ModeButton
              icon={<Target />}
              title="Practice Drills"
              detail="Focused offline drills for one hand, mirrored movement, sync, and rhythm."
              accent="cyan"
              onClick={onPractice}
            />
            <ModeButton
              icon={<Award />}
              title="Garage"
              detail="Achievements and cosmetic-only car skins."
              accent="slate"
              onClick={onGarage}
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
      <CrawlableHomeSections />
    </ScreenShell>
  );
}

function CrawlableHomeSections(): ReactElement {
  return (
    <section className="mx-auto w-full max-w-5xl px-5 pb-12 pt-2 sm:px-8">
      <div className="border-t border-white/10 pt-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <article>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyanline">Browser reflex game</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">Train focus with one-car and two-car lane switching.</h2>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-relaxed text-slate-300">
              Multi Cars is a fast offline driving game for focus, reaction time, lane reading, and two-hand coordination. Play short runs in your browser, avoid obstacles, collect targets, and lose instantly on one mistake.
            </p>
          </article>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <SeoFact title="Runs offline" detail="Installable PWA with local progress after the first visit." />
            <SeoFact title="Five challenge categories" detail="Focus, coordination, recognition, reaction, and endurance roads." />
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <SeoPanel
            title="How To Play"
            detail="Switch each car between two lanes. Collect green targets, avoid obstacles, and keep reading both roads as speed rises."
          />
          <SeoPanel
            title="Game Modes"
            detail="Classic offers one-car and two-car runs. Challenge Roads add 25 authored levels. Practice Drills isolate specific skills. Daily Road gives a fresh seeded route."
          />
          <SeoPanel
            title="Why It Works"
            detail="The game is simple to start but demanding under speed, making each run a compact focus and coordination test."
          />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <SeoQuestion
            question="Is Multi Cars free?"
            answer="Yes. Multi Cars is free to play in a modern web browser."
          />
          <SeoQuestion
            question="Does progress sync across devices?"
            answer="Not yet. Scores, settings, achievements, and drill progress are saved locally in the current browser profile."
          />
        </div>
      </div>
    </section>
  );
}

function SeoFact({ title, detail }: { title: string; detail: string }): ReactElement {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
      <h3 className="text-base font-black text-slate-100">{title}</h3>
      <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-300">{detail}</p>
    </div>
  );
}

function SeoPanel({ title, detail }: { title: string; detail: string }): ReactElement {
  return (
    <article className="rounded-3xl border border-white/10 bg-panel/70 p-5">
      <h3 className="text-xl font-black">{title}</h3>
      <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-300">{detail}</p>
    </article>
  );
}

function SeoQuestion({ question, answer }: { question: string; answer: string }): ReactElement {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/6 p-4">
      <h3 className="text-base font-black">{question}</h3>
      <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-300">{answer}</p>
    </article>
  );
}

function ClassicScreen({
  onBack,
  onStart,
}: {
  onBack: () => void;
  onStart: (carCount: SupportedClassicCarCount) => void;
}): ReactElement {
  const optionDetails: Record<SupportedClassicCarCount, string> = {
    1: "One centered car, two lanes, and a single full-screen input.",
    2: "The original two-car, four-lane Classic pressure run.",
    3: "A laptop-only six-lane coordination jump with three cars.",
    4: "The full eight-lane keyboard challenge for serious chaos.",
  };

  return (
    <ScreenShell>
      <section className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-5 px-5 py-7 sm:px-8">
        <TopBar title="Classic Run" detail="Pick the number of cars for this run." onBack={onBack} />
        <ClassicKeyboardGuide />
        <div className="grid flex-1 content-center gap-4 sm:grid-cols-2">
          {CLASSIC_CAR_OPTIONS.map((carCount) => (
            <button
              key={carCount}
              type="button"
              onClick={() => {
                unlockAudio();
                playUiClick();
                onStart(carCount);
              }}
              className={`group min-h-64 rounded-3xl border border-white/12 bg-panel/84 p-6 text-left shadow-2xl transition hover:-translate-y-1 hover:border-cyanline/70 hover:shadow-glow focus:outline-none focus:ring-2 focus:ring-cyanline ${
                carCount >= 3 ? "hidden md:block" : ""
              }`}
            >
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-cyanline text-ink">
                <Car />
              </span>
              <h2 className="mt-5 text-3xl font-black">{formatClassicModeLabel(carCount)}</h2>
              <p className="mt-3 text-base font-semibold leading-relaxed text-slate-300">
                {optionDetails[carCount]}
              </p>
              {carCount >= 2 ? (
                <div className="mt-5 hidden rounded-2xl border border-cyanline/20 bg-cyanline/8 px-4 py-3 md:block">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-cyanline">Desktop keys</p>
                  <p className="mt-1 text-sm font-bold text-slate-200">{getClassicKeyboardHint(carCount)}</p>
                </div>
              ) : null}
              <div className="mt-6 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Best</p>
                  <p className="mt-1 text-3xl font-black text-goldline">
                    {loadClassicHighScoreForCarCount(carCount)}
                  </p>
                </div>
                <span className="rounded-2xl bg-white/8 px-4 py-3 text-sm font-black text-slate-100 transition group-hover:bg-cyanline group-hover:text-ink">
                  Start
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </ScreenShell>
  );
}

function ClassicKeyboardGuide(): ReactElement {
  return (
    <aside className="hidden rounded-3xl border border-cyanline/24 bg-gradient-to-r from-cyanline/14 via-panel/88 to-goldline/12 p-4 shadow-glow md:block">
      <div className="grid gap-4 lg:grid-cols-[auto_1fr] lg:items-center">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyanline text-ink shadow-glow">
            <Keyboard />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyanline">Laptop Keyboard</p>
            <h2 className="mt-1 text-2xl font-black leading-tight">Two hands can run up to four cars.</h2>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-5">
          <KeyboardAction keys={["A"]} label="Car 1" />
          <KeyboardAction keys={["S"]} label="Car 2" />
          <KeyboardAction keys={["K"]} label="Car 3" />
          <KeyboardAction keys={["L"]} label="Car 4" />
          <KeyboardAction keys={["P"]} label="Pause" icon={<Pause size={15} />} />
        </div>
      </div>
    </aside>
  );
}

function KeyboardAction({
  keys,
  label,
  icon,
}: {
  keys: string[];
  label: string;
  icon?: ReactNode;
}): ReactElement {
  return (
    <div className="flex min-h-20 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-ink/52 px-4 py-3">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
        <div className="mt-2 flex gap-2">
          {keys.map((key) => (
            <span
              key={key}
              className="grid h-9 min-w-9 place-items-center rounded-xl border border-white/18 bg-white/10 px-3 text-sm font-black text-slate-50 shadow-inner"
            >
              {key}
            </span>
          ))}
        </div>
      </div>
      {icon ? <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/8 text-goldline">{icon}</span> : null}
    </div>
  );
}

function getClassicKeyboardHint(carCount: SupportedClassicCarCount): string {
  if (carCount === 2) {
    return "A for car 1, L for car 2, P to pause.";
  }

  if (carCount === 3) {
    return "A, S, and K control the three cars. P pauses.";
  }

  return "A, S, K, and L control all four cars. P pauses.";
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

function PracticeScreen({
  onBack,
  onStart,
}: {
  onBack: () => void;
  onStart: (drillId: string) => void;
}): ReactElement {
  return (
    <ScreenShell>
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 px-5 py-7 sm:px-8">
        <TopBar title="Practice Drills" detail="Pick a focused drill. Same fail rules, local best progress saved." onBack={onBack} />

        <div className="grid gap-4 md:grid-cols-2">
          {PRACTICE_DRILLS.map((drill) => (
            <PracticeCard key={drill.id} drill={drill} onStart={onStart} />
          ))}
        </div>
      </section>
    </ScreenShell>
  );
}

function GarageScreen({
  achievementState,
  selectedCarSkinId,
  onSelectCarSkin,
  onBack,
}: {
  achievementState: AchievementState;
  selectedCarSkinId: CarSkinId;
  onSelectCarSkin: (skinId: CarSkinId) => void;
  onBack: () => void;
}): ReactElement {
  return (
    <ScreenShell>
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 px-5 py-7 sm:px-8">
        <TopBar title="Garage" detail="Local achievements and cosmetic-only car skins. Unlocks never change gameplay power." onBack={onBack} />

        <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <section className="rounded-3xl border border-white/10 bg-panel/84 p-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-goldline text-ink">
                <Award />
              </span>
              <h2 className="text-2xl font-black">Achievements</h2>
            </div>
            <div className="mt-5 grid gap-3">
              {ACHIEVEMENTS.map((achievement) => {
                const unlocked = achievementState.unlockedIds.includes(achievement.id);
                return (
                  <div
                    key={achievement.id}
                    className={`rounded-2xl border px-4 py-3 ${
                      unlocked ? "border-goldline/35 bg-goldline/10" : "border-white/10 bg-white/6"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-black">{achievement.title}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-300">{achievement.description}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${unlocked ? "bg-goldline text-ink" : "bg-white/10 text-slate-400"}`}>
                        {unlocked ? "Unlocked" : "Locked"}
                      </span>
                    </div>
                    {achievement.rewardSkinId ? (
                      <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-cyanline">
                        Reward: {getCarSkinLabel(achievement.rewardSkinId)}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-panel/84 p-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cyanline text-ink">
                <Palette />
              </span>
              <h2 className="text-2xl font-black">Car Skins</h2>
            </div>
            <div className="mt-5 grid gap-3">
              {CAR_SKINS.map((skin) => {
                const unlocked = isCarSkinUnlocked(skin, achievementState);
                const selected = selectedCarSkinId === skin.id;
                return (
                  <button
                    key={skin.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => onSelectCarSkin(skin.id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-cyanline bg-cyanline/14 shadow-glow"
                        : unlocked
                          ? "border-white/10 bg-white/7 hover:border-cyanline/45"
                          : "border-white/8 bg-white/[0.04] text-slate-500"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-black">{skin.label}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-300">{skin.description}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <span className="h-7 w-7 rounded-full border border-white/20" style={{ backgroundColor: `#${skin.leftColor.toString(16).padStart(6, "0")}` }} />
                        <span className="h-7 w-7 rounded-full border border-white/20" style={{ backgroundColor: `#${skin.rightColor.toString(16).padStart(6, "0")}` }} />
                      </div>
                    </div>
                    <p className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-goldline">
                      {selected ? "Selected" : unlocked ? "Available" : "Locked"}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </section>
    </ScreenShell>
  );
}

function SettingsScreen({
  onBack,
  classicSpeedSettings,
  onClassicSpeedSettingsChange,
  gameplayModifierSettings,
  onGameplayModifierSettingsChange,
  audioSettings,
  onAudioSettingsChange,
}: {
  onBack: () => void;
  classicSpeedSettings: ClassicSpeedSettings;
  onClassicSpeedSettingsChange: (settings: ClassicSpeedSettings) => void;
  gameplayModifierSettings: GameplayModifierSettings;
  onGameplayModifierSettingsChange: (settings: GameplayModifierSettings) => void;
  audioSettings: AudioSettings;
  onAudioSettingsChange: (settings: AudioSettings) => void;
}): ReactElement {
  const handleMinLevelChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const minLevel = Number.parseInt(event.target.value, 10);
    onClassicSpeedSettingsChange({
      minLevel,
      maxLevel: Math.max(minLevel, classicSpeedSettings.maxLevel),
    });
  };

  const handleMaxLevelChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const maxLevel = Number.parseInt(event.target.value, 10);
    onClassicSpeedSettingsChange({
      minLevel: Math.min(classicSpeedSettings.minLevel, maxLevel),
      maxLevel,
    });
  };

  const handlePowerUpToggle = (id: PowerUpId) => {
    onGameplayModifierSettingsChange({
      ...gameplayModifierSettings,
      powerUps: {
        ...gameplayModifierSettings.powerUps,
        [id]: !gameplayModifierSettings.powerUps[id],
      },
    });
  };

  const handleObstacleVarietyToggle = (id: ObstacleVarietyId) => {
    onGameplayModifierSettingsChange({
      ...gameplayModifierSettings,
      obstacleVariety: {
        ...gameplayModifierSettings.obstacleVariety,
        [id]: !gameplayModifierSettings.obstacleVariety[id],
      },
    });
  };

  return (
    <ScreenShell>
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-5 px-5 py-7 sm:px-8">
        <TopBar title="Control Room" detail="Tune the road without changing the pure base game defaults." onBack={onBack} />
        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-panel/84 p-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cyanline text-ink">
                <Gauge />
              </span>
              <h3 className="text-2xl font-black">Classic Pace</h3>
            </div>
            <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-300">
              Classic mode climbs one speed level every 15 seconds. Choose where the road starts and where it tops out.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="rounded-2xl bg-white/6 px-4 py-3">
                <span className="block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Minimum level
                </span>
                <select
                  aria-label="Minimum level"
                  value={classicSpeedSettings.minLevel}
                  onChange={handleMinLevelChange}
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-ink/80 px-3 py-3 text-base font-black text-slate-50 outline-none transition focus:border-cyanline"
                >
                  {SPEED_LEVEL_OPTIONS.map((level) => (
                    <option key={level} value={level}>
                      Level {level}
                    </option>
                  ))}
                </select>
              </label>

              <label className="rounded-2xl bg-white/6 px-4 py-3">
                <span className="block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Maximum level
                </span>
                <select
                  aria-label="Maximum level"
                  value={classicSpeedSettings.maxLevel}
                  onChange={handleMaxLevelChange}
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-ink/80 px-3 py-3 text-base font-black text-slate-50 outline-none transition focus:border-cyanline"
                >
                  {SPEED_LEVEL_OPTIONS.map((level) => (
                    <option key={level} value={level}>
                      Level {level}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4 rounded-2xl border border-cyanline/20 bg-cyanline/8 px-4 py-3 text-sm font-semibold text-slate-200">
              Classic starts at level {classicSpeedSettings.minLevel}, rises every 15 seconds, and caps at level {classicSpeedSettings.maxLevel}.
            </div>
          </section>
          <ModifierPanel
            icon={<Shield />}
            title="Power Ups"
            detail="Disabled by default. Enabled items can appear in generated runs."
            options={POWER_UP_OPTIONS}
            values={gameplayModifierSettings.powerUps}
            onToggle={(id) => handlePowerUpToggle(id as PowerUpId)}
          />
          <ModifierPanel
            icon={<Target />}
            title="Obstacle Variety"
            detail="Add advanced road objects only when you want extra mental load."
            options={OBSTACLE_VARIETY_OPTIONS}
            values={gameplayModifierSettings.obstacleVariety}
            onToggle={(id) => handleObstacleVarietyToggle(id as ObstacleVarietyId)}
          />
          <SettingsPanel icon={<Shield />} title="Comfort" rows={["Reduced motion: off", "Contrast: high", "Screen shake: low"]} />
          <AudioPanel
            audioSettings={audioSettings}
            onAudioSettingsChange={onAudioSettingsChange}
          />
          <SettingsPanel icon={<Sparkles />} title="Visuals & Data" rows={["Theme: road based", "Save data: local", "Cloud sync: later"]} />
        </div>
      </section>
    </ScreenShell>
  );
}

function QuickToggle({
  label,
  active,
  onChange,
}: {
  label: string;
  active: boolean;
  onChange: () => void;
}): ReactElement {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/6 px-3 py-3">
      <span className="text-sm font-black text-slate-100">{label}</span>
      <input
        type="checkbox"
        checked={active}
        onChange={() => {
          unlockAudio();
          playUiClick();
          onChange();
        }}
        className="h-5 w-5 accent-cyanline"
      />
    </label>
  );
}

function SummaryOverlay({
  detail,
  classicSpeedSettings,
  onClassicSpeedSettingsChange,
  gameplayModifierSettings,
  onGameplayModifierSettingsChange,
  onBack,
  onOpenSettings,
  onReplay,
}: {
  detail: RunEndedDetail;
  classicSpeedSettings: ClassicSpeedSettings;
  onClassicSpeedSettingsChange: (settings: ClassicSpeedSettings) => void;
  gameplayModifierSettings: GameplayModifierSettings;
  onGameplayModifierSettingsChange: (settings: GameplayModifierSettings) => void;
  onBack: () => void;
  onOpenSettings: () => void;
  onReplay: () => void;
}): ReactElement {
  const { summary } = detail;
  const [activeTab, setActiveTab] = useState<"result" | "tune">("result");
  const [showReplay, setShowReplay] = useState(false);
  const backLabel = summary.modeId === "classic" || summary.modeId === "challenge" || summary.modeId === "practice" ? "Back" : "Menu";
  const canReplayMistake = summary.result === "failed" && Boolean(detail.replay?.frames.length && detail.replay.frames.length > 1);

  useEffect(() => {
    document.body.dataset.screen = "summary";
    document.body.dataset.gameStatus = "summary";
    document.body.dataset.mode = summary.modeId;
  }, [summary.modeId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isFormControl(event.target)) {
        return;
      }

      if (event.key === "r" || event.key === "R" || event.key === "Enter") {
        event.preventDefault();
        onReplay();
      }

      if (event.key === "m" || event.key === "M" || event.key === "Escape") {
        event.preventDefault();
        onBack();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBack, onReplay]);

  return (
    <div className="fixed inset-0 z-20 grid place-items-center overflow-y-auto bg-ink/55 px-5 py-6 backdrop-blur-sm">
      <section className="w-full max-w-md rounded-[2rem] border border-white/15 bg-panel/92 p-5 text-center shadow-2xl sm:p-6">
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-ink/44 p-1" role="tablist" aria-label="Run summary views">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "result"}
            onClick={() => {
              playUiClick();
              setActiveTab("result");
            }}
            className={`rounded-xl px-4 py-3 text-sm font-black transition ${
              activeTab === "result" ? "bg-cyanline text-ink shadow-glow" : "text-slate-300 hover:bg-white/8"
            }`}
          >
            Result
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "tune"}
            onClick={() => {
              playUiClick();
              setActiveTab("tune");
            }}
            className={`rounded-xl px-4 py-3 text-sm font-black transition ${
              activeTab === "tune" ? "bg-cyanline text-ink shadow-glow" : "text-slate-300 hover:bg-white/8"
            }`}
          >
            Tuning
          </button>
        </div>

        {activeTab === "result" ? (
          <div role="tabpanel" aria-label="Result" className="mt-5">
          <p className="text-sm font-black uppercase tracking-[0.26em] text-dangerline">
            {summary.result === "completed"
              ? summary.modeId === "practice"
                ? "Drill Complete"
                : summary.modeId === "daily"
                  ? "Daily Cleared"
                  : "Road Cleared"
              : "Run Ended"}
          </p>
          <h2 className="mt-3 text-4xl font-black">{summary.modeLabel}</h2>
          <p className="mt-2 text-slate-300">
            {formatFailure(summary.failureReason)}
            {summary.failedPatternFamily ? ` - ${summary.failedPatternFamily}` : ""}
          </p>

          {detail.unlockedAchievementIds?.length ? (
            <div className="mt-5 rounded-2xl border border-goldline/30 bg-goldline/10 px-4 py-3 text-left">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-goldline">Unlocked</p>
              <div className="mt-2 space-y-1">
                {detail.unlockedAchievementIds.map((achievementId) => {
                  const achievement = getAchievement(achievementId);
                  return (
                    <p key={achievementId} className="text-sm font-bold text-slate-100">
                      {achievement.title}
                      {achievement.rewardSkinId ? ` - ${getCarSkinLabel(achievement.rewardSkinId)}` : ""}
                    </p>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-3 gap-3">
            <ScoreTile label={summary.modeId === "challenge" || summary.modeId === "practice" || summary.modeId === "daily" ? "Progress" : "Score"} value={summary.modeId === "challenge" || summary.modeId === "practice" || summary.modeId === "daily" ? `${summary.completedPercent}%` : summary.score} />
            <ScoreTile label={summary.modeId === "practice" ? "Best" : summary.modeId === "daily" ? "Best" : "Best"} value={summary.modeId === "challenge" || summary.modeId === "practice" ? `${summary.bestScore}%` : summary.bestScore} />
            <ScoreTile label={summary.modeId === "challenge" || summary.modeId === "daily" ? "Stars" : summary.modeId === "practice" ? "Drill" : "Speed"} value={summary.modeId === "challenge" || summary.modeId === "daily" ? `${summary.stars ?? 0}/3` : summary.modeId === "practice" ? "Local" : summary.speedLevel} />
          </div>

          {canReplayMistake ? (
            <button
              type="button"
              onClick={() => setShowReplay(true)}
              className="mt-5 w-full rounded-2xl border border-goldline/35 bg-goldline/12 px-4 py-4 font-black text-goldline"
            >
              Replay Mistake
            </button>
          ) : null}
          </div>
        ) : (
          <TuneNextRunPanel
            classicSpeedSettings={classicSpeedSettings}
            onClassicSpeedSettingsChange={onClassicSpeedSettingsChange}
            gameplayModifierSettings={gameplayModifierSettings}
            onGameplayModifierSettingsChange={onGameplayModifierSettingsChange}
            onOpenSettings={onOpenSettings}
          />
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => { playUiClick(); onBack(); }} className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4 font-black text-slate-100">
            {backLabel}
          </button>
          <button type="button" onClick={() => { unlockAudio(); playUiClick(); onReplay(); }} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyanline px-4 py-4 font-black text-ink shadow-glow">
            <RotateCcw size={18} /> Again
          </button>
        </div>
      </section>
      {showReplay && detail.replay ? (
        <MistakeReplayOverlay
          clip={detail.replay}
          modeLabel={summary.modeLabel}
          onClose={() => setShowReplay(false)}
        />
      ) : null}
    </div>
  );
}

function TuneNextRunPanel({
  classicSpeedSettings,
  onClassicSpeedSettingsChange,
  gameplayModifierSettings,
  onGameplayModifierSettingsChange,
  onOpenSettings,
}: {
  classicSpeedSettings: ClassicSpeedSettings;
  onClassicSpeedSettingsChange: (settings: ClassicSpeedSettings) => void;
  gameplayModifierSettings: GameplayModifierSettings;
  onGameplayModifierSettingsChange: (settings: GameplayModifierSettings) => void;
  onOpenSettings: () => void;
}): ReactElement {
  const updateMinLevel = (minLevel: number) => {
    onClassicSpeedSettingsChange({
      minLevel,
      maxLevel: Math.max(minLevel, classicSpeedSettings.maxLevel),
    });
  };

  const updateMaxLevel = (maxLevel: number) => {
    onClassicSpeedSettingsChange({
      minLevel: Math.min(classicSpeedSettings.minLevel, maxLevel),
      maxLevel,
    });
  };

  const handlePowerUpToggle = (id: PowerUpId) => {
    onGameplayModifierSettingsChange({
      ...gameplayModifierSettings,
      powerUps: {
        ...gameplayModifierSettings.powerUps,
        [id]: !gameplayModifierSettings.powerUps[id],
      },
    });
  };

  const handleObstacleVarietyToggle = (id: ObstacleVarietyId) => {
    onGameplayModifierSettingsChange({
      ...gameplayModifierSettings,
      obstacleVariety: {
        ...gameplayModifierSettings.obstacleVariety,
        [id]: !gameplayModifierSettings.obstacleVariety[id],
      },
    });
  };

  return (
    <div role="tabpanel" aria-label="Tune Next Run" className="mt-5 text-left">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyanline">Tune Next Run</p>
          <h3 className="mt-1 text-2xl font-black text-slate-50">Adjust, then replay.</h3>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyanline text-ink">
          <Settings size={20} />
        </span>
      </div>

      <p className="mt-3 text-xs font-bold leading-relaxed text-slate-300">
        These settings are saved before you hit Again.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <SpeedLevelStepper
          label="Start"
          value={classicSpeedSettings.minLevel}
          decrementLabel="Decrease summary minimum speed level"
          incrementLabel="Increase summary minimum speed level"
          onChange={updateMinLevel}
        />
        <SpeedLevelStepper
          label="Cap"
          value={classicSpeedSettings.maxLevel}
          decrementLabel="Decrease summary maximum speed level"
          incrementLabel="Increase summary maximum speed level"
          onChange={updateMaxLevel}
        />
      </div>

      <div className="mt-4 space-y-2">
        <QuickToggle
          label="Shield"
          active={gameplayModifierSettings.powerUps.shield}
          onChange={() => handlePowerUpToggle("shield")}
        />
        <QuickToggle
          label="Slow Motion"
          active={gameplayModifierSettings.powerUps["slow-motion"]}
          onChange={() => handlePowerUpToggle("slow-motion")}
        />
        <QuickToggle
          label="Moving Obstacles"
          active={gameplayModifierSettings.obstacleVariety["moving-obstacles"]}
          onChange={() => handleObstacleVarietyToggle("moving-obstacles")}
        />
      </div>
      <button
        type="button"
        onClick={() => {
          playUiClick();
          onOpenSettings();
        }}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm font-black text-slate-100 transition hover:border-cyanline/50 hover:bg-cyanline/10"
      >
        <Settings size={18} /> Open Control Room
      </button>
    </div>
  );
}

function SpeedLevelStepper({
  label,
  value,
  decrementLabel,
  incrementLabel,
  onChange,
}: {
  label: string;
  value: number;
  decrementLabel: string;
  incrementLabel: string;
  onChange: (value: number) => void;
}): ReactElement {
  const canDecrease = value > MIN_CLASSIC_SPEED_LEVEL;
  const canIncrease = value < MAX_CLASSIC_SPEED_LEVEL;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-3">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <div className="mt-3 grid grid-cols-[2.4rem_1fr_2.4rem] items-center gap-2">
        <button
          type="button"
          aria-label={decrementLabel}
          disabled={!canDecrease}
          onClick={() => {
            playUiClick();
            onChange(value - 1);
          }}
          className="grid h-10 place-items-center rounded-xl border border-white/10 bg-ink/76 text-xl font-black text-slate-100 transition hover:border-cyanline/50 disabled:cursor-not-allowed disabled:opacity-35"
        >
          -
        </button>
        <span
          aria-label={`${label} speed level`}
          className="grid h-10 place-items-center rounded-xl border border-cyanline/20 bg-cyanline/10 text-lg font-black text-cyanline"
        >
          {value}
        </span>
        <button
          type="button"
          aria-label={incrementLabel}
          disabled={!canIncrease}
          onClick={() => {
            playUiClick();
            onChange(value + 1);
          }}
          className="grid h-10 place-items-center rounded-xl border border-white/10 bg-ink/76 text-xl font-black text-slate-100 transition hover:border-cyanline/50 disabled:cursor-not-allowed disabled:opacity-35"
        >
          +
        </button>
      </div>
    </div>
  );
}

function MistakeReplayOverlay({
  clip,
  modeLabel,
  onClose,
}: {
  clip: ReplayClip;
  modeLabel: string;
  onClose: () => void;
}): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    document.body.dataset.replayStatus = "playing";
    return () => {
      document.body.dataset.replayStatus = "";
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return undefined;
    }

    let animationFrameId = 0;
    let startedAt: number | undefined;
    let completed = false;

    const draw = (timestamp: number) => {
      startedAt ??= timestamp;
      const elapsedMs = timestamp - startedAt;
      const frame = getReplayFrame(clip, elapsedMs);
      drawReplayFrame(context, frame);

      if (elapsedMs >= clip.durationMs) {
        if (!completed) {
          completed = true;
          document.body.dataset.replayStatus = "complete";
          setIsComplete(true);
        }
        return;
      }

      animationFrameId = window.requestAnimationFrame(draw);
    };

    animationFrameId = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [clip]);

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-ink/80 px-4 backdrop-blur-md">
      <section className="w-full max-w-sm rounded-[1.75rem] border border-white/15 bg-panel/96 p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-goldline">Mistake Replay</p>
            <h3 className="mt-1 text-2xl font-black">{modeLabel}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/8 px-4 py-2 text-sm font-black"
          >
            Close
          </button>
        </div>
        <canvas
          ref={canvasRef}
          width={360}
          height={640}
          aria-label="Replay of the final mistake"
          className="mt-4 aspect-[9/16] w-full rounded-2xl border border-white/10 bg-ink"
        />
        <p className="mt-3 text-center text-xs font-black uppercase tracking-[0.18em] text-slate-400">
          {isComplete ? "Replay complete" : "Playing final 5 seconds"}
        </p>
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
      onClick={() => {
        unlockAudio();
        playUiClick();
        onClick();
      }}
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

function PracticeCard({
  drill,
  onStart,
}: {
  drill: PracticeDrill;
  onStart: (drillId: string) => void;
}): ReactElement {
  const progress = loadPracticeProgress(drill.id, createInitialPracticeProgress(drill.id));

  return (
    <button
      type="button"
      onClick={() => onStart(drill.id)}
      className="relative overflow-hidden rounded-3xl border border-white/12 bg-panel/85 p-5 text-left text-slate-50 transition hover:-translate-y-0.5 hover:border-cyanline/60"
    >
      <div className={`absolute right-4 top-4 h-24 w-24 rounded-full blur-2xl ${getThemeGlow(drill.roadTheme)}`} />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyanline">
            {formatSkillLabel(drill.focus)}
          </p>
          <h3 className="mt-2 text-2xl font-black">{drill.label}</h3>
          <p className="mt-2 max-w-sm text-sm font-semibold leading-relaxed text-slate-300">{drill.description}</p>
        </div>
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-cyanline text-ink">
          <Target />
        </div>
      </div>
      <div className="relative mt-5 flex items-center justify-between text-sm font-black">
        <span>{Math.round(drill.durationMs / 1000)}s drill</span>
        <span className="text-goldline">Best {progress.bestPercent}%</span>
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

function ModifierPanel({
  icon,
  title,
  detail,
  options,
  values,
  onToggle,
}: {
  icon: ReactElement;
  title: string;
  detail: string;
  options: GameplayModifierMeta[];
  values: Partial<Record<string, boolean>>;
  onToggle: (id: string) => void;
}): ReactElement {
  const enabledCount = options.filter((option) => values[option.id] === true).length;

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/84 p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-goldline text-ink">{icon}</span>
          <div>
            <h3 className="text-2xl font-black">{title}</h3>
            <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              {enabledCount}/{options.length} active
            </p>
          </div>
        </div>
      </div>
      <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-300">{detail}</p>
      <div className="mt-5 space-y-3">
        {options.map((option) => {
          const enabled = values[option.id] === true;

          return (
            <label
              key={option.id}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                enabled
                  ? "border-cyanline/50 bg-cyanline/12 text-slate-50"
                  : "border-white/8 bg-white/6 text-slate-300 hover:border-white/16"
              }`}
            >
              <input
                type="checkbox"
                checked={enabled}
                onChange={() => onToggle(option.id)}
                className="mt-1 h-5 w-5 accent-cyanline"
              />
              <span>
                <span className="block text-sm font-black">{option.label}</span>
                <span className="mt-1 block text-xs font-semibold leading-relaxed text-slate-400">
                  {option.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </section>
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

function AudioPanel({
  audioSettings,
  onAudioSettingsChange,
}: {
  audioSettings: AudioSettings;
  onAudioSettingsChange: (settings: AudioSettings) => void;
}): ReactElement {
  const handleToggle = (key: keyof AudioSettings) => {
    onAudioSettingsChange({
      ...audioSettings,
      [key]: !audioSettings[key],
    });
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/84 p-5 shadow-2xl">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cyanline text-ink">
          <Headphones />
        </span>
        <h3 className="text-2xl font-black">Audio</h3>
      </div>
      <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-300">
        Crisp feedback for lane switches, pickups, power-ups, pause, and crashes. Music is a light pulse for players who want extra tension.
      </p>
      <div className="mt-5 space-y-3">
        <QuickToggle
          label="Sound Effects"
          active={audioSettings.soundEffects}
          onChange={() => handleToggle("soundEffects")}
        />
        <QuickToggle
          label="Music Pulse"
          active={audioSettings.music}
          onChange={() => handleToggle("music")}
        />
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
      <button type="button" onClick={() => { playUiClick(); onBack(); }} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/8">
        <ArrowLeft />
      </button>
      <div>
        <h1 className="text-4xl font-black sm:text-5xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-300 sm:text-base">{detail}</p>
      </div>
    </header>
  );
}

function getReplayFrame(clip: ReplayClip, elapsedMs: number): ReplayFrame {
  const frames = clip.frames;
  if (frames.length === 0) {
    throw new Error("Replay clip contains no frames.");
  }

  if (frames.length === 1 || clip.durationMs <= 0) {
    return frames[frames.length - 1];
  }

  const firstFrameAtMs = frames[0].atMs;
  const replayTimeMs = firstFrameAtMs + Math.min(elapsedMs, Math.max(0, clip.durationMs));

  return frames.reduce((closest, frame) => (
    Math.abs(frame.atMs - replayTimeMs) < Math.abs(closest.atMs - replayTimeMs) ? frame : closest
  ), frames[0]);
}

function drawReplayFrame(context: CanvasRenderingContext2D, frame: ReplayFrame): void {
  const { width, height } = context.canvas;
  const scaleX = width / GAME_WIDTH;
  const scaleY = height / GAME_HEIGHT;
  const scale = (value: number, axis: "x" | "y") => value * (axis === "x" ? scaleX : scaleY);
  const laneX = getReplayLaneX(frame.state.carCount);
  const activeSides = getActiveRoadSides(frame.state.carCount);

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#070b12";
  context.fillRect(0, 0, width, height);
  drawReplayRoad(context, scale, frame.state.carCount);

  for (const object of frame.state.objects) {
    if (!activeSides.includes(object.side) || object.collected || object.y < 70 || object.y > GAME_HEIGHT + 90) {
      continue;
    }

    drawReplayObject(
      context,
      object,
      scale(laneX[object.side][object.lane], "x"),
      scale(object.y, "y"),
      frame.state.timeMs,
      object.id === frame.state.failure?.objectId,
    );
  }

  for (const side of activeSides) {
    drawReplayCar(
      context,
      scale(laneX[side][frame.state.cars[side].lane], "x"),
      scale(COLLECTION_Y, "y"),
      getReplayCarColor(side),
    );
  }

  context.fillStyle = "rgba(7, 11, 18, 0.82)";
  roundRect(context, 44 * scaleX, 14 * scaleY, width - 88 * scaleX, 32 * scaleY, 10 * scaleX);
  context.fill();
  context.fillStyle = "#f8fafc";
  context.font = "700 12px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText(`Score ${frame.state.score}   ${Math.round(frame.atMs / 100) / 10}s`, width / 2, 35 * scaleY);
}

function drawReplayRoad(
  context: CanvasRenderingContext2D,
  scale: (value: number, axis: "x" | "y") => number,
  carCount: number,
): void {
  const laneX = getReplayLaneX(carCount);
  const activeSides = getActiveRoadSides(carCount);
  const xValues = activeSides.flatMap((side) => laneX[side]);
  const minX = Math.min(...xValues) - 68;
  const maxX = Math.max(...xValues) + 68;

  context.fillStyle = "#101827";
  roundRect(context, scale(minX, "x"), scale(94, "y"), scale(maxX - minX, "x"), scale(1220, "y"), scale(16, "x"));
  context.fill();
  context.fillStyle = "#202938";
  for (const side of activeSides) {
    const [laneA, laneB] = laneX[side];
    const groupX = Math.min(laneA, laneB) - getReplayRoadGroupPadding(carCount);
    const groupWidth = Math.abs(laneB - laneA) + getReplayRoadGroupPadding(carCount) * 2;
    roundRect(context, scale(groupX, "x"), scale(100, "y"), scale(groupWidth, "x"), scale(1180, "y"), scale(12, "x"));
    context.fill();
  }

  context.strokeStyle = "rgba(248, 250, 252, 0.22)";
  context.lineWidth = scale(4, "x");
  context.beginPath();
  for (const side of activeSides) {
    const [laneA, laneB] = laneX[side];
    const dividerX = (laneA + laneB) / 2;
    context.moveTo(scale(dividerX, "x"), scale(100, "y"));
    context.lineTo(scale(dividerX, "x"), scale(1280, "y"));
  }
  context.stroke();
}

function getReplayLaneX(carCount: number): Record<RoadSide, [number, number]> {
  const laneXByCarCount: Record<number, Record<RoadSide, [number, number]>> = {
    1: { left: [252, 468], right: [438, 574], third: [438, 574], fourth: [438, 574] },
    2: { left: [146, 282], right: [438, 574], third: [438, 574], fourth: [438, 574] },
    3: { left: [60, 190], right: [295, 425], third: [530, 660], fourth: [530, 660] },
    4: { left: [55, 125], right: [235, 305], third: [415, 485], fourth: [595, 665] },
  };
  return laneXByCarCount[carCount] ?? laneXByCarCount[2];
}

function getReplayRoadGroupPadding(carCount: number): number {
  if (carCount === 1) return 108;
  if (carCount === 2) return 72;
  return 54;
}

function getReplayCarColor(side: RoadSide): string {
  const colors: Record<RoadSide, string> = {
    left: "#3dd6c6",
    right: "#ffd166",
    third: "#fb7185",
    fourth: "#93c5fd",
  };
  return colors[side];
}

function drawReplayObject(
  context: CanvasRenderingContext2D,
  object: ActiveObjectState,
  x: number,
  y: number,
  timeMs: number,
  highlighted: boolean,
): void {
  switch (object.kind) {
    case "collectible":
      drawReplayCollectibleToken(context, x, y, "#6ee7b7");
      break;
    case "color-match":
      drawReplayColorMatchToken(context, x, y, getReplayCarColor(object.colorKey ?? object.side));
      break;
    case "dual-collect":
      drawReplayDualCollectToken(context, x, y);
      break;
    case "power-up":
      drawReplayPowerUpToken(context, x, y, object);
      break;
    case "fake-collectible":
      drawReplayFakeCollectibleToken(context, x, y);
      break;
    case "moving-obstacle":
      drawReplayObstacleToken(context, x, y, "#f97316", true);
      break;
    case "timed-gate":
      drawReplayTimedGateToken(context, x, y, isReplayTimedGateClosed(object, timeMs));
      break;
    case "obstacle":
    default:
      drawReplayObstacleToken(context, x, y, "#fb7185", false);
      break;
  }

  if (highlighted) {
    context.strokeStyle = "#ffd166";
    context.lineWidth = 4;
    context.beginPath();
    context.arc(x, y, 24, 0, Math.PI * 2);
    context.stroke();
  }
}

function drawReplayCollectibleToken(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
): void {
  context.fillStyle = "rgba(0, 0, 0, 0.22)";
  context.beginPath();
  context.ellipse(x, y + 15, 16, 4, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = color;
  context.beginPath();
  context.arc(x, y, 14, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(255, 255, 255, 0.8)";
  context.beginPath();
  context.arc(x - 4, y - 4, 4, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgba(255, 255, 255, 0.28)";
  context.lineWidth = 3;
  context.beginPath();
  context.arc(x, y, 14, 0, Math.PI * 2);
  context.stroke();
}

function drawReplayPowerUpToken(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  object: ActiveObjectState,
): void {
  context.fillStyle = "rgba(0, 0, 0, 0.24)";
  context.beginPath();
  context.ellipse(x, y + 16, 17, 4, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = getReplayPowerUpColor(object);
  context.beginPath();
  context.arc(x, y, 15, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgba(255, 255, 255, 0.36)";
  context.lineWidth = 3;
  context.beginPath();
  context.arc(x, y, 15, 0, Math.PI * 2);
  context.stroke();
  drawReplayPowerUpGlyph(context, x, y, object);
}

function drawReplayPowerUpGlyph(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  object: ActiveObjectState,
): void {
  switch (object.powerUpId) {
    case "shield":
      context.fillStyle = "rgba(255, 255, 255, 0.94)";
      context.beginPath();
      context.moveTo(x, y - 10);
      context.lineTo(x + 8, y - 5);
      context.lineTo(x + 6, y + 6);
      context.lineTo(x, y + 11);
      context.lineTo(x - 6, y + 6);
      context.lineTo(x - 8, y - 5);
      context.closePath();
      context.fill();
      break;
    case "magnet":
      context.strokeStyle = "rgba(255, 255, 255, 0.95)";
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(x - 7, y - 8);
      context.lineTo(x - 7, y + 5);
      context.lineTo(x + 7, y + 5);
      context.lineTo(x + 7, y - 8);
      context.stroke();
      context.fillStyle = "#fb7185";
      roundRect(context, x - 10, y - 11, 6, 5, 2);
      context.fill();
      context.fillStyle = "#38bdf8";
      roundRect(context, x + 4, y - 11, 6, 5, 2);
      context.fill();
      break;
    case "slow-motion":
      context.strokeStyle = "rgba(255, 255, 255, 0.95)";
      context.lineWidth = 3;
      context.beginPath();
      context.arc(x, y, 9, 0, Math.PI * 2);
      context.moveTo(x, y);
      context.lineTo(x, y - 6);
      context.moveTo(x, y);
      context.lineTo(x + 6, y + 3);
      context.stroke();
      context.strokeStyle = "rgba(255, 255, 255, 0.55)";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(x - 16, y - 6);
      context.lineTo(x - 10, y - 6);
      context.moveTo(x - 18, y);
      context.lineTo(x - 10, y);
      context.moveTo(x - 16, y + 6);
      context.lineTo(x - 10, y + 6);
      context.stroke();
      break;
    case "score-multiplier":
      context.fillStyle = "rgba(255, 255, 255, 0.96)";
      context.font = "900 14px Inter, system-ui, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("x2", x, y + 1);
      break;
    case "dual-collect":
      context.strokeStyle = "rgba(255, 255, 255, 0.95)";
      context.lineWidth = 3;
      context.beginPath();
      context.arc(x - 5, y, 6, 0, Math.PI * 2);
      context.arc(x + 5, y, 6, 0, Math.PI * 2);
      context.stroke();
      break;
    default:
      context.fillStyle = "rgba(255, 255, 255, 0.92)";
      context.beginPath();
      context.moveTo(x, y - 9);
      context.lineTo(x + 7, y + 4);
      context.lineTo(x - 7, y + 4);
      context.closePath();
      context.fill();
      break;
  }
}

function drawReplayObstacleToken(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  moving: boolean,
): void {
  context.fillStyle = "rgba(0, 0, 0, 0.25)";
  context.beginPath();
  context.ellipse(x, y + 17, 18, 5, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = color;
  roundRect(context, x - 16, y - 16, 32, 32, moving ? 11 : 4);
  context.fill();
  context.strokeStyle = "rgba(255, 255, 255, 0.24)";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(x - 9, y - 9);
  context.lineTo(x + 9, y + 9);
  context.moveTo(x + 9, y - 9);
  context.lineTo(x - 9, y + 9);
  if (moving) {
    context.moveTo(x - 12, y);
    context.lineTo(x + 12, y);
  }
  context.stroke();
  if (moving) {
    context.fillStyle = "rgba(255, 255, 255, 0.58)";
    context.beginPath();
    context.moveTo(x - 17, y);
    context.lineTo(x - 11, y - 4);
    context.lineTo(x - 11, y + 4);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(x + 17, y);
    context.lineTo(x + 11, y - 4);
    context.lineTo(x + 11, y + 4);
    context.closePath();
    context.fill();
  }
}

function drawReplayFakeCollectibleToken(context: CanvasRenderingContext2D, x: number, y: number): void {
  drawReplayCollectibleToken(context, x, y, "#34d399");
  context.strokeStyle = "rgba(251, 113, 133, 0.95)";
  context.lineWidth = 3;
  context.beginPath();
  context.arc(x, y, 17, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = "rgba(251, 113, 133, 0.94)";
  context.beginPath();
  context.moveTo(x, y - 11);
  context.lineTo(x + 10, y + 8);
  context.lineTo(x - 10, y + 8);
  context.closePath();
  context.fill();
  context.strokeStyle = "rgba(255, 255, 255, 0.96)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x, y - 4);
  context.lineTo(x, y + 3);
  context.stroke();
  context.fillStyle = "rgba(255, 255, 255, 0.96)";
  context.beginPath();
  context.arc(x, y + 6, 1.8, 0, Math.PI * 2);
  context.fill();
}

function drawReplayTimedGateToken(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  closed: boolean,
): void {
  const color = closed ? "#f97316" : "#38bdf8";
  context.fillStyle = "rgba(0, 0, 0, 0.24)";
  context.beginPath();
  context.ellipse(x, y + 16, 20, 4, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = closed ? color : "rgba(56, 189, 248, 0.45)";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(x - 14, y - 15);
  context.lineTo(x - 14, y + 15);
  context.moveTo(x + 14, y - 15);
  context.lineTo(x + 14, y + 15);
  context.moveTo(x - 14, y - 12);
  context.lineTo(x + 14, y - 12);
  if (closed) {
    context.moveTo(x - 14, y + 12);
    context.lineTo(x + 14, y + 12);
  }
  context.stroke();
}

function drawReplayColorMatchToken(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
): void {
  context.fillStyle = "rgba(0, 0, 0, 0.22)";
  context.beginPath();
  context.ellipse(x, y + 15, 16, 4, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(x, y - 16);
  context.lineTo(x + 16, y);
  context.lineTo(x, y + 16);
  context.lineTo(x - 16, y);
  context.closePath();
  context.fill();
  context.strokeStyle = "rgba(255, 255, 255, 0.32)";
  context.lineWidth = 3;
  context.stroke();
}

function drawReplayDualCollectToken(context: CanvasRenderingContext2D, x: number, y: number): void {
  drawReplayCollectibleToken(context, x, y, "#a7f3d0");
  context.strokeStyle = "rgba(255, 209, 102, 0.9)";
  context.lineWidth = 3;
  context.beginPath();
  context.arc(x, y, 9, 0, Math.PI * 2);
  context.stroke();
}

function getReplayPowerUpColor(object: ActiveObjectState): string {
  switch (object.powerUpId) {
    case "shield":
      return "#38bdf8";
    case "slow-motion":
      return "#818cf8";
    case "magnet":
      return "#f472b6";
    case "score-multiplier":
      return "#22c55e";
    case "dual-collect":
      return "#a7f3d0";
    default:
      return "#8bd3ff";
  }
}

function isReplayTimedGateClosed(object: ActiveObjectState, timeMs: number): boolean {
  const elapsedMs = Math.max(0, timeMs - object.timeMs);
  return object.kind !== "timed-gate" || Math.floor(elapsedMs / 480) % 2 === 0;
}

function drawReplayCar(context: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  context.fillStyle = "rgba(0, 0, 0, 0.28)";
  context.beginPath();
  context.ellipse(x, y + 24, 20, 6, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = color;
  roundRect(context, x - 16, y - 26, 32, 52, 8);
  context.fill();
  context.fillStyle = "rgba(255, 255, 255, 0.24)";
  roundRect(context, x - 9, y - 19, 18, 30, 6);
  context.fill();
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
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
  return `${run.mode}-${run.trackId ?? run.drillId ?? ""}-${run.runIndex ?? 0}-${run.carCount ?? ""}`;
}

function getRunReturnScreen(mode: PlayMode): Exclude<AppScreen, "gameplay" | "summary"> {
  if (mode === "classic") {
    return "classic-select";
  }

  if (mode === "challenge") {
    return "challenge-select";
  }

  if (mode === "practice") {
    return "practice-select";
  }

  return "home";
}

function pushAppHistoryState(screen: AppScreen, activeRun: GameBootConfig | null): void {
  window.history.pushState(createAppHistoryState(screen, activeRun), "");
}

function replaceAppHistoryState(screen: AppScreen, activeRun: GameBootConfig | null): void {
  window.history.replaceState(createAppHistoryState(screen, activeRun), "");
}

function createAppHistoryState(screen: AppScreen, activeRun: GameBootConfig | null): AppHistoryState {
  return {
    multiCars: true,
    screen,
    activeRun,
  };
}

function parseAppHistoryState(state: unknown): AppHistoryState | null {
  if (!state || typeof state !== "object") {
    return null;
  }

  const candidate = state as Partial<AppHistoryState>;
  if (candidate.multiCars !== true || !candidate.screen) {
    return null;
  }

  return candidate as AppHistoryState;
}

function isFormControl(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLButtonElement
  );
}

function getThemeGlow(theme: AuthoredTrack["roadTheme"] | PracticeDrill["roadTheme"]): string {
  if (theme === "neon") return "bg-cyanline/30";
  if (theme === "storm") return "bg-dangerline/30";
  if (theme === "canyon") return "bg-goldline/30";
  return "bg-sky-300/25";
}

function getCarSkinLabel(skinId: CarSkinId): string {
  return CAR_SKINS.find((skin) => skin.id === skinId)?.label ?? skinId;
}

function formatSkillLabel(skill: PracticeDrill["focus"]): string {
  if (skill === "pattern-recognition") return "Pattern Recognition";
  return skill.charAt(0).toUpperCase() + skill.slice(1);
}

function formatFailure(reason: string | undefined): string {
  if (reason === "hit-obstacle") return "Obstacle hit";
  if (reason === "missed-collectible") return "Collectible missed";
  return "Clean finish";
}

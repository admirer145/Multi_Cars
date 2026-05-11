import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactElement, ReactNode } from "react";
import Phaser from "phaser";
import {
  ArrowLeft,
  Gauge,
  Headphones,
  CalendarDays,
  Award,
  Lock,
  Medal,
  Palette,
  Play,
  RotateCcw,
  Settings,
  Shield,
  Sparkles,
  Star,
  Target,
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
  ACHIEVEMENTS,
  CAR_SKINS,
  getAchievement,
  isCarSkinUnlocked,
  updateAchievementsForSummary,
  type AchievementState,
  type CarSkinId,
} from "../core/engagement/achievements";
import {
  AUTHORED_TRACKS,
  getAuthoredTracksByCategory,
  type AuthoredTrack,
} from "../core/patterns/authoredTracks";
import { createInitialChallengeProgress } from "../core/modes/challengeMode";
import {
  MAX_CLASSIC_SPEED_LEVEL,
  MIN_CLASSIC_SPEED_LEVEL,
  type ClassicSpeedSettings,
} from "../core/modes/classicMode";
import { createDailyRun, createInitialDailyProgress } from "../core/modes/dailyMode";
import { PRACTICE_DRILLS, type PracticeDrill } from "../core/modes/practiceMode";
import {
  OBSTACLE_VARIETY_OPTIONS,
  POWER_UP_OPTIONS,
  type GameplayModifierMeta,
  type GameplayModifierSettings,
  type ObstacleVarietyId,
  type PowerUpId,
} from "../core/modifiers/gameplayModifiers";
import {
  loadChallengeProgress,
  loadClassicHighScore,
  loadClassicSpeedSettings,
  loadAchievementState,
  loadDailyProgress,
  loadGameplayModifierSettings,
  loadSelectedCarSkin,
  saveAchievementState,
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
    setClassicSpeedSettings(saveClassicSpeedSettings(nextSettings));
  };

  const handleGameplayModifierSettingsChange = (nextSettings: GameplayModifierSettings) => {
    setGameplayModifierSettings(saveGameplayModifierSettings(nextSettings));
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
          onClassic={() => startRun("classic", { runIndex: 0 })}
          onChallenge={() => navigateToStaticScreen("challenge-select")}
          onPractice={() => navigateToStaticScreen("practice-select")}
          onDaily={() => startRun("daily")}
          onGarage={() => navigateToStaticScreen("garage")}
          onSettings={() => navigateToStaticScreen("settings")}
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
        />
      ) : null}

      {screen === "summary" && summary ? (
        <SummaryOverlay
          detail={summary}
          onBack={returnFromSummary}
          onReplay={() =>
            startRun(
              summary.mode,
              {
                runIndex: summary.nextRunIndex,
                trackId: summary.trackId,
                drillId: summary.drillId,
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
        <TopBar title="Practice Drills" detail="Pick a focused drill. Same fail rules, no high-score or road progress writes." onBack={onBack} />

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
}: {
  onBack: () => void;
  classicSpeedSettings: ClassicSpeedSettings;
  onClassicSpeedSettingsChange: (settings: ClassicSpeedSettings) => void;
  gameplayModifierSettings: GameplayModifierSettings;
  onGameplayModifierSettingsChange: (settings: GameplayModifierSettings) => void;
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
          <SettingsPanel icon={<Headphones />} title="Audio" rows={["Sound effects: on", "Music: off", "Haptics: planned"]} />
          <SettingsPanel icon={<Sparkles />} title="Visuals & Data" rows={["Theme: road based", "Save data: local", "Cloud sync: later"]} />
        </div>
      </section>
    </ScreenShell>
  );
}

function SummaryOverlay({
  detail,
  onBack,
  onReplay,
}: {
  detail: RunEndedDetail;
  onBack: () => void;
  onReplay: () => void;
}): ReactElement {
  const { summary } = detail;
  const backLabel = summary.modeId === "challenge" || summary.modeId === "practice" ? "Back" : "Menu";

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
        onBack();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBack, onReplay]);

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-ink/55 px-5 backdrop-blur-sm">
      <section className="w-full max-w-md rounded-[2rem] border border-white/15 bg-panel/92 p-6 text-center shadow-2xl">
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
          <ScoreTile label={summary.modeId === "practice" ? "Score" : summary.modeId === "daily" ? "Best" : "Best"} value={summary.modeId === "challenge" ? `${summary.bestScore}%` : summary.modeId === "practice" ? summary.score : summary.bestScore} />
          <ScoreTile label={summary.modeId === "challenge" || summary.modeId === "daily" ? "Stars" : summary.modeId === "practice" ? "Drill" : "Speed"} value={summary.modeId === "challenge" || summary.modeId === "daily" ? `${summary.stars ?? 0}/3` : summary.modeId === "practice" ? "Local" : summary.speedLevel} />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={onReplay} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyanline px-4 py-4 font-black text-ink shadow-glow">
            <RotateCcw size={18} /> Again
          </button>
          <button type="button" onClick={onBack} className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4 font-black text-slate-100">
            {backLabel}
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

function PracticeCard({
  drill,
  onStart,
}: {
  drill: PracticeDrill;
  onStart: (drillId: string) => void;
}): ReactElement {
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
        <span className="text-goldline">No progress save</span>
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
  return `${run.mode}-${run.trackId ?? run.drillId ?? ""}-${run.runIndex ?? 0}`;
}

function getRunReturnScreen(mode: PlayMode): Exclude<AppScreen, "gameplay" | "summary"> {
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

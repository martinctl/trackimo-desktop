import { useEffect, useState } from "react";
import type { DraftState, Champion, Team } from "./types";

interface DraftViewProps {
  draftState: DraftState | null;
  champions: Map<number, Champion>;
  championVersion?: string;
}

const POSITION_ORDER = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
const PICK_TIMER = 30;
const BAN_TIMER = 30;

export default function DraftView({ draftState, champions, championVersion = "latest" }: DraftViewProps) {
  const [currentTimer, setCurrentTimer] = useState<number>(0);
  const [maxTimer, setMaxTimer] = useState<number>(PICK_TIMER);

  useEffect(() => {
    if (draftState?.timer) {
      setCurrentTimer(draftState.timer);
      const timer = draftState.phase.includes("BAN") ? BAN_TIMER : PICK_TIMER;
      setMaxTimer(timer);
    }
  }, [draftState]);

  // Countdown timer
  useEffect(() => {
    if (!draftState || !draftState.timer) return;

    const interval = setInterval(() => {
      setCurrentTimer((prev) => {
        if (prev <= 0) return 0;
        return Math.max(0, prev - 0.1);
      });
    }, 100);

    return () => clearInterval(interval);
  }, [draftState]);

  const getChampionIconUrl = (championId: number): string => {
    const champ = champions.get(championId);
    if (!champ) return "";
    return `https://ddragon.leagueoflegends.com/cdn/${championVersion || "latest"}/img/champion/${champ.id}.png`;
  };

  const getChampionCenteredImageUrl = (championId: number): string => {
    const champ = champions.get(championId);
    if (!champ) return "";
    return `https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${champ.id}_0.jpg`;
  };

  const getChampionName = (championId: number): string => {
    const champ = champions.get(championId);
    return champ ? champ.name : `Champion ${championId}`;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Component for individual pick card
  const PickCard = ({ 
    isBlue, 
    isActivelySelecting,
    isPreLocked,
    isLocked,
    champIdToDisplay,
    getChampionCenteredImageUrl,
    getChampionName
  }: {
    isBlue: boolean;
    isActivelySelecting: boolean;
    isPreLocked: boolean;
    isLocked: boolean;
    champIdToDisplay: number | undefined;
    getChampionCenteredImageUrl: (id: number) => string;
    getChampionName: (id: number) => string;
  }) => {

    return (
      <div 
        className={`relative flex items-center bg-gradient-to-r ${
          isBlue 
            ? "from-blue-950/30 to-blue-900/20" 
            : "from-red-950/30 to-red-900/20"
        } backdrop-blur-sm border-b ${
          isBlue 
            ? "border-blue-500/20" 
            : "border-red-500/20"
        } ${
          isActivelySelecting ? "shadow-lg" : ""
        } overflow-hidden flex-1 min-h-[120px]`}
      >
        {/* Champion Centered Image - Takes most of the space */}
        <div 
          className={`relative flex-1 h-full ${
            isActivelySelecting 
              ? "border-l-4 border-yellow-400/90 shadow-lg shadow-yellow-400/40" 
              : isPreLocked
              ? "opacity-60 grayscale-[0.3] border-l-4 border-yellow-400/50"
              : isLocked 
              ? "border-l-4 border-cyan-400/80 shadow-lg shadow-cyan-400/30" 
              : "border-l-4 border-gray-700/30"
          }`}
        >
          <div className="relative w-full h-full overflow-hidden">
          {champIdToDisplay && champIdToDisplay !== 0 ? (
            <>
              <img
                src={getChampionCenteredImageUrl(champIdToDisplay)}
                alt={getChampionName(champIdToDisplay)}
                className="w-full h-full object-cover"
                style={{ objectPosition: 'center 30%' }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
              {/* Gradient overlay for better text readability */}
              <div className={`absolute inset-0 bg-gradient-to-r ${
                isBlue
                  ? "from-blue-950/80 via-blue-950/40 to-transparent"
                  : "from-red-950/80 via-red-950/40 to-transparent"
              } pointer-events-none`} />
              {/* Dark overlay for prelock state */}
              {isPreLocked && (
                <div className="absolute inset-0 bg-black/40 pointer-events-none" />
              )}
              {/* Champion Name Overlay */}
              <div className={`absolute left-4 bottom-4 z-10 ${
                isBlue 
                  ? "text-blue-100" 
                  : "text-red-100"
              }`}>
                <div className="text-2xl font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  {getChampionName(champIdToDisplay)}
                </div>
                <div className={`text-xs uppercase tracking-wider ${
                  isActivelySelecting 
                    ? "text-yellow-300" 
                    : isPreLocked
                    ? "text-yellow-400/70"
                    : isLocked
                    ? "text-cyan-300"
                    : "text-gray-400"
                } font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]`}>
                  {isLocked ? "LOCKED" : isPreLocked ? "PRE-LOCKED" : isActivelySelecting ? "SELECTING..." : ""}
                </div>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-900/50">
              <span className="text-gray-500 text-5xl font-bold">?</span>
            </div>
          )}
          </div>
        </div>
      </div>
    );
  };

  const renderTeam = (team: Team, isBlue: boolean) => {
    const sortedCells = [...team.cells].sort((a, b) => {
      const aPos = a.assigned_position || "";
      const bPos = b.assigned_position || "";
      const aIdx = POSITION_ORDER.indexOf(aPos);
      const bIdx = POSITION_ORDER.indexOf(bPos);
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });

    const teamColor = isBlue ? "bg-blue-500/15" : "bg-red-500/15";
    const teamBorderColor = isBlue ? "border-blue-400/25" : "border-red-400/25";

    return (
      <div className={`flex flex-col min-w-[340px] flex-1 ${teamColor} backdrop-blur-xl border-r ${teamBorderColor} overflow-hidden`}>
        {/* Bans Row */}
        <div className="flex border-b border-gray-700/30 bg-black/20 backdrop-blur-sm">
          {Array.from({ length: 5 }).map((_, idx) => {
            const ban = team.bans[idx];
            if (!ban || !ban.champion_id) {
              return (
                <div key={idx} className={`flex-1 h-20 bg-gray-900/50 backdrop-blur-sm ${
                  idx === 4 ? "" : `border-r ${isBlue ? "border-blue-500/20" : "border-red-500/20"}`
                } flex items-center justify-center transition-all`}>
                  <span className="text-gray-500 text-xl font-bold">?</span>
                </div>
              );
            }
            
            // Check if this ban action is in progress
            const activeBanAction = ban.cell_id && draftState?.actions.find(
              action => action.type === "ban" && 
                        action.actor_cell_id === ban.cell_id && 
                        action.is_in_progress &&
                        !action.completed
            );
            
            const isActivelyBanning = Boolean(activeBanAction && !ban.completed);
            const isPreSelectedBan = Boolean(!activeBanAction && !ban.completed && ban.champion_id !== undefined);
            
            return (
              <div 
                key={idx} 
                className={`relative flex-1 h-20 overflow-hidden ${
                  idx === 4 ? "" : `border-r ${isBlue ? "border-blue-500/20" : "border-red-500/20"}`
                } ${
                  ban.completed 
                    ? "grayscale-[0.4] brightness-75 opacity-85" 
                    : isActivelyBanning
                    ? "shadow-lg shadow-yellow-400/40 brightness-110" 
                    : isPreSelectedBan
                    ? "opacity-75 grayscale-[0.2] brightness-90"
                    : ""
                }`}
              >
                <img
                  src={getChampionIconUrl(ban.champion_id)}
                  alt={getChampionName(ban.champion_id)}
                  className="w-full h-full object-cover object-center"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
                {ban.completed && (
                  <div className="absolute inset-0 bg-red-500/60 backdrop-blur-[1px] flex items-center justify-center">
                    <span className="text-white text-xs font-bold uppercase tracking-widest drop-shadow-lg">BAN</span>
                  </div>
                )}
                {!ban.completed && isActivelyBanning && (
                  <div className="absolute inset-0 bg-yellow-400/20 backdrop-blur-[1px] border-2 border-yellow-400/60" />
                )}
                {!ban.completed && isPreSelectedBan && (
                  <div className="absolute inset-0 bg-yellow-400/10 backdrop-blur-[1px] border border-yellow-400/40" />
                )}
              </div>
            );
          })}
        </div>

        {/* Picks */}
        <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden">
          {sortedCells.map((cell) => {
            const lockedChampId = cell.champion_id;
            const preselectedChampId = cell.selected_champion_id;
            
            // Check if this cell has an in-progress pick action
            const activePickAction = draftState?.actions.find(
              action => action.type === "pick" && 
                        action.actor_cell_id === cell.cell_id && 
                        action.is_in_progress &&
                        !action.completed
            );
            
            const champIdToDisplay = lockedChampId ?? preselectedChampId;
            
            // Active selecting: player's turn and has preselected champion
            const isActivelySelecting = Boolean(activePickAction && preselectedChampId != null && preselectedChampId !== 0 && !lockedChampId);
            // Pre-locked: has preselected champion but not their turn
            const isPreLocked = Boolean(!activePickAction && preselectedChampId != null && preselectedChampId !== 0 && !lockedChampId);
            const isLocked = Boolean(lockedChampId != null && lockedChampId !== 0);

            return (
              <PickCard
                key={cell.cell_id}
                isBlue={isBlue}
                isActivelySelecting={isActivelySelecting}
                isPreLocked={isPreLocked}
                isLocked={isLocked}
                champIdToDisplay={champIdToDisplay}
                getChampionCenteredImageUrl={getChampionCenteredImageUrl}
                getChampionName={getChampionName}
              />
            );
          })}
        </div>
      </div>
    );
  };

  if (!draftState) return null;

  const timerPercent = maxTimer > 0 ? (currentTimer / maxTimer) * 100 : 0;
  const hasTwoTeams = draftState.teams.length >= 2;

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header with Timer and Team Names */}
      <div className="bg-black/50 backdrop-blur-xl text-white px-6 py-4 border-b border-gray-700/30 shadow-lg flex-shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-6 flex-1 min-w-0">
            <h2 className="text-xl font-bold uppercase tracking-wider text-gray-200 flex-shrink-0">
              {draftState.phase.replace(/_/g, " ")}
            </h2>
            {hasTwoTeams && (
              <>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-lg font-bold text-blue-300">Blue Side</span>
                  <span className="text-gray-500">/</span>
                  <span className="text-lg font-bold text-red-300">Red Side</span>
                </div>
              </>
            )}
          </div>
          {draftState.timer !== undefined && (
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="text-2xl font-mono font-bold tabular-nums">
                {formatTime(currentTimer)}
              </div>
              <div className="w-48 h-3 bg-gray-800/80 backdrop-blur-sm rounded-full overflow-hidden border border-gray-700/50 shadow-inner min-w-[120px]">
                <div
                  className={`h-full transition-all duration-100 ${
                    timerPercent > 50 
                      ? "bg-gradient-to-r from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/30" 
                      : timerPercent > 20 
                      ? "bg-gradient-to-r from-yellow-500 to-orange-400 shadow-lg shadow-yellow-500/30" 
                      : "bg-gradient-to-r from-red-500 to-pink-500 shadow-lg shadow-red-500/30"
                  }`}
                  style={{ width: `${timerPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Draft Area */}
      <div className="flex-1 flex overflow-hidden min-w-0">
        {draftState.teams.length >= 2 ? (
          <>
            {renderTeam(draftState.teams[0], true)}
            
            {/* Center VS Divider */}
            <div className="flex-shrink-0 w-32 flex items-center justify-center bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-2xl relative shadow-inner min-w-[120px]">
              <div className="absolute inset-0 opacity-[0.03]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_white_1px,_transparent_1px)] bg-[length:40px_40px]" />
              </div>
              <div className="relative text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 drop-shadow-2xl">
                VS
              </div>
            </div>
            
            {renderTeam(draftState.teams[1], false)}
          </>
        ) : draftState.teams.length === 1 ? (
          <div className="flex-1 flex">
            <div className="flex-1" />
            {renderTeam(draftState.teams[0], true)}
            <div className="flex-1" />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <p className="text-xl">Waiting for draft to start...</p>
          </div>
        )}
      </div>
    </div>
  );
}

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

  const getChampionName = (championId: number): string => {
    const champ = champions.get(championId);
    return champ ? champ.name : `Champion ${championId}`;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
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
    const teamAccent = isBlue ? "bg-blue-500/10" : "bg-red-500/10";
    const teamName = isBlue ? "Blue Side" : "Red Side";

    return (
      <div className={`flex flex-col min-w-[340px] ${teamColor} backdrop-blur-xl border-r ${teamBorderColor}`}>
        {/* Team Header */}
        <div className={`${teamAccent} backdrop-blur-md px-6 py-4 border-b ${teamBorderColor} shadow-sm`}>
          <h3 className="text-white text-xl font-bold uppercase tracking-wider">
            {teamName}
          </h3>
        </div>

        {/* Bans Row */}
        <div className="flex gap-2 p-4 bg-black/30 backdrop-blur-sm">
          {Array.from({ length: 5 }).map((_, idx) => {
            const ban = team.bans[idx];
            if (!ban || !ban.champion_id) {
              return (
                <div key={idx} className="w-16 h-16 bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-lg flex items-center justify-center">
                  <span className="text-gray-500 text-lg">?</span>
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
            
            const isActivelyBanning = activeBanAction && !ban.completed;
            const isPreSelectedBan = !activeBanAction && !ban.completed && ban.champion_id !== undefined;
            
            return (
              <div 
                key={idx} 
                className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                  ban.completed 
                    ? "border-red-400/60 grayscale brightness-50 shadow-lg shadow-red-500/20" 
                    : isActivelyBanning
                    ? "border-yellow-400/90 animate-pulse shadow-lg shadow-yellow-400/40" 
                    : isPreSelectedBan
                    ? "border-yellow-400/60 shadow-md shadow-yellow-400/20"
                    : "border-gray-600/50"
                } backdrop-blur-sm`}
              >
                <img
                  src={getChampionIconUrl(ban.champion_id)}
                  alt={getChampionName(ban.champion_id)}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
                {ban.completed && (
                  <div className="absolute bottom-0 left-0 right-0 bg-red-500/90 backdrop-blur-sm text-white text-[10px] font-bold text-center py-1">
                    BAN
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Picks */}
        <div className="flex-1 flex flex-col p-4 gap-3 overflow-y-auto">
          {sortedCells.map((cell, idx) => {
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
            const isActivelySelecting = activePickAction && preselectedChampId != null && preselectedChampId !== 0 && !lockedChampId;
            // Pre-locked: has preselected champion but not their turn
            const isPreLocked = !activePickAction && preselectedChampId != null && preselectedChampId !== 0 && !lockedChampId;
            const isLocked = lockedChampId != null && lockedChampId !== 0;
            const position = cell.assigned_position || "";

            return (
              <div key={cell.cell_id} className="flex items-center gap-4 bg-black/20 backdrop-blur-md rounded-xl p-4 border border-gray-700/30 hover:border-gray-600/40 transition-all shadow-sm">
                {/* Position Label */}
                <div className="min-w-[70px] text-xs font-semibold text-gray-400 uppercase text-center bg-gray-800/40 backdrop-blur-sm px-3 py-2 rounded-lg">
                  {position || `Slot ${idx + 1}`}
                </div>

                {/* Champion Portrait - Full Size */}
                <div className={`relative flex-shrink-0 w-24 h-24 rounded-xl border-2 overflow-hidden transition-all ${
                  isActivelySelecting 
                    ? "border-yellow-400/90 animate-pulse bg-yellow-400/10 shadow-lg shadow-yellow-400/40" 
                    : isPreLocked
                    ? "border-yellow-400/60 bg-yellow-400/5 shadow-md shadow-yellow-400/20"
                    : isLocked 
                    ? "border-cyan-400/80 bg-cyan-400/10 shadow-lg shadow-cyan-400/30" 
                    : "border-gray-600/50 bg-gray-800/50"
                } backdrop-blur-sm`}>
                  {champIdToDisplay && champIdToDisplay !== 0 ? (
                    <>
                      <img
                        src={getChampionIconUrl(champIdToDisplay)}
                        alt={getChampionName(champIdToDisplay)}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                      {/* Background blur effect behind champion */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-800/50">
                      <span className="text-gray-500 text-3xl">?</span>
                    </div>
                  )}
                </div>

                {/* Champion Name */}
                {champIdToDisplay && champIdToDisplay !== 0 && (
                  <div className="text-white text-base font-semibold flex-1 bg-black/20 backdrop-blur-sm px-4 py-2 rounded-lg">
                    {getChampionName(champIdToDisplay)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (!draftState) return null;

  const timerPercent = maxTimer > 0 ? (currentTimer / maxTimer) * 100 : 0;

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header with Timer */}
      <div className="bg-black/50 backdrop-blur-xl text-white px-8 py-5 border-b border-gray-700/30 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold uppercase tracking-wider text-gray-200">
            {draftState.phase.replace(/_/g, " ")}
          </h2>
          {draftState.timer !== undefined && (
            <div className="flex items-center gap-4">
              <div className="text-2xl font-mono font-bold tabular-nums">
                {formatTime(currentTimer)}
              </div>
              <div className="w-48 h-3 bg-gray-800/80 backdrop-blur-sm rounded-full overflow-hidden border border-gray-700/50 shadow-inner">
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
      <div className="flex-1 flex overflow-hidden">
        {draftState.teams.length >= 2 ? (
          <>
            {renderTeam(draftState.teams[0], true)}
            
            {/* Center VS Divider */}
            <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-2xl relative shadow-inner">
              <div className="absolute inset-0 opacity-[0.03]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_white_1px,_transparent_1px)] bg-[length:40px_40px]" />
              </div>
              <div className="relative text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 drop-shadow-2xl">
                VS
              </div>
            </div>
            
            {renderTeam(draftState.teams[1], false)}
          </>
        ) : draftState.teams.length === 1 ? (
          renderTeam(draftState.teams[0], true)
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <p className="text-xl">Waiting for draft to start...</p>
          </div>
        )}
      </div>
    </div>
  );
}

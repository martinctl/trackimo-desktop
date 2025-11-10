import { useState } from "react";
import type { DraftState, Champion } from "./types";
import TeamView from "./components/draft/TeamView";
import RecommendationsPanel from "./components/draft/RecommendationsPanel";
import DraftHeader from "./components/draft/DraftHeader";

interface DraftViewProps {
  draftState: DraftState | null;
  champions: Map<number, Champion>;
  currentTimer?: number;
  maxTimer?: number;
  formatTime?: (seconds: number) => string;
}

export default function DraftView({ draftState, champions, currentTimer, maxTimer, formatTime }: DraftViewProps) {
  // State for manually selected roles (cellId -> role)
  const [manualRoles, setManualRoles] = useState<Map<number, string>>(new Map());
  // Store the current player's cell ID from LCU (persists throughout the draft)
  const currentPlayerCellId = draftState?.local_player_cell_id ?? null;

  // No auto-role assignment - let users pick their own role

  const getChampionCenteredImageUrl = (championId: number): string => {
    const champ = champions.get(championId);
    if (!champ) return "";
    return `https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${champ.id}_0.jpg`;
  };

  const getChampionName = (championId: number): string => {
    const champ = champions.get(championId);
    return champ ? champ.name : `Champion ${championId}`;
  };

  const handleRoleSelect = (cellId: number, role: string) => {
    setManualRoles((prev) => {
      const newMap = new Map(prev);
      newMap.set(cellId, role);
      return newMap;
    });
  };

  // Get current player's role for AI recommendations
  const getCurrentPlayerRole = (): string | undefined => {
    if (!draftState || currentPlayerCellId == null) return undefined;

    // Find the cell
    for (const team of draftState.teams) {
      const cell = team.cells.find(c => c.cell_id === currentPlayerCellId);
      if (cell) {
        // Return manual role if set, otherwise assigned_position
        return manualRoles.get(cell.cell_id) || cell.assigned_position;
      }
    }
    return undefined;
  };

  if (!draftState) return null;

  return (
    <div className="flex h-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 overflow-hidden">
      {/* Left side: Draft Header + Main Draft Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Draft Header with Timer */}
        {currentTimer !== undefined && maxTimer !== undefined && formatTime && (
          <DraftHeader
            timer={draftState.timer}
            currentTimer={currentTimer}
            maxTimer={maxTimer}
            formatTime={formatTime}
          />
        )}
        
        {/* Main Draft Area */}
        <div className="flex-1 flex overflow-hidden min-w-0">
          {draftState.teams.length >= 2 ? (
            <>
              <TeamView
                team={draftState.teams[0]}
                isBlue={true}
                draftState={draftState}
                getChampionCenteredImageUrl={getChampionCenteredImageUrl}
                getChampionName={getChampionName}
                manualRoles={manualRoles}
                onRoleSelect={handleRoleSelect}
                currentPlayerCellId={currentPlayerCellId}
              />
              
              {/* Center VS Divider */}
              <div className="flex-shrink-0 w-32 flex items-center justify-center bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-2xl relative shadow-inner min-w-[120px]">
                <div className="absolute inset-0 opacity-[0.03]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_white_1px,_transparent_1px)] bg-[length:40px_40px]" />
                </div>
                <div className="relative text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 drop-shadow-2xl">
                  VS
                </div>
              </div>
              
              <TeamView
                team={draftState.teams[1]}
                isBlue={false}
                draftState={draftState}
                getChampionCenteredImageUrl={getChampionCenteredImageUrl}
                getChampionName={getChampionName}
                manualRoles={manualRoles}
                onRoleSelect={handleRoleSelect}
                currentPlayerCellId={currentPlayerCellId}
              />
            </>
          ) : draftState.teams.length === 1 ? (
            <div className="flex-1 flex">
              <div className="flex-1" />
              <TeamView
                team={draftState.teams[0]}
                isBlue={true}
                draftState={draftState}
                getChampionCenteredImageUrl={getChampionCenteredImageUrl}
                getChampionName={getChampionName}
                manualRoles={manualRoles}
                onRoleSelect={handleRoleSelect}
                currentPlayerCellId={currentPlayerCellId}
              />
              <div className="flex-1" />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <p className="text-xl">Waiting for draft to start...</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Recommendations Panel - extends to top, positioned to the right */}
      <RecommendationsPanel
        draftState={draftState}
        champions={champions}
        getChampionCenteredImageUrl={getChampionCenteredImageUrl}
        currentPlayerRole={getCurrentPlayerRole()}
      />
    </div>
  );
}

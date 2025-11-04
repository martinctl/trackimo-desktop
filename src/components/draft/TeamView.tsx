import type { Team, DraftState } from "../../types";
import PickCard from "./PickCard";
import BanSlot from "./BanSlot";

const POSITION_ORDER = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

interface TeamViewProps {
  team: Team;
  isBlue: boolean;
  draftState: DraftState;
  getChampionCenteredImageUrl: (championId: number) => string;
  getChampionName: (championId: number) => string;
}

export default function TeamView({
  team,
  isBlue,
  draftState,
  getChampionCenteredImageUrl,
  getChampionName
}: TeamViewProps) {
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
        {Array.from({ length: 5 }).map((_, idx) => (
          <BanSlot
            key={idx}
            ban={team.bans[idx]}
            index={idx}
            isBlue={isBlue}
            draftActions={draftState.actions}
            getChampionCenteredImageUrl={getChampionCenteredImageUrl}
            getChampionName={getChampionName}
          />
        ))}
      </div>

      {/* Picks */}
      <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden">
        {sortedCells.map((cell) => {
          const lockedChampId = cell.champion_id;
          const preselectedChampId = cell.selected_champion_id;
          
          // Check if this cell has an in-progress pick action
          const activePickAction = draftState.actions.find(
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
}


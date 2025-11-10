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
  manualRoles: Map<number, string>;
  onRoleSelect: (cellId: number, role: string) => void;
  currentPlayerCellId: number | null;
  selectedCellForRole: number | null;
}

export default function TeamView({
  team,
  isBlue,
  draftState,
  getChampionCenteredImageUrl,
  getChampionName,
  manualRoles,
  onRoleSelect,
  currentPlayerCellId,
  selectedCellForRole,
}: TeamViewProps) {

  // Find which team the current player is on
  const getPlayerTeamId = (): number | null => {
    if (currentPlayerCellId === null) return null;
    for (const t of draftState.teams) {
      if (t.cells.some(c => c.cell_id === currentPlayerCellId)) {
        return t.team_id;
      }
    }
    return null;
  };

  const playerTeamId = getPlayerTeamId();
  // If we know the player team, use it. Otherwise, allow selection on first team only
  const isPlayerTeam = currentPlayerCellId 
    ? playerTeamId === team.team_id 
    : isBlue; // Allow first team (blue) to select before we know which is player's

  // Get roles already taken by teammates (assigned or manual)
  const getTakenRoles = (cellId: number): string[] => {
    return team.cells
      .filter(c => c.cell_id !== cellId) // Exclude current cell
      .map(c => c.assigned_position || manualRoles.get(c.cell_id))
      .filter((role): role is string => role !== undefined && role !== "");
  };

  const sortedCells = [...team.cells].sort((a, b) => {
    const aPos = a.assigned_position || manualRoles.get(a.cell_id) || "";
    const bPos = b.assigned_position || manualRoles.get(b.cell_id) || "";
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
      <div className="flex-1 flex flex-col overflow-y-auto overflow-x-visible">
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

          // Get role: prefer assigned_position, fallback to manual role
          const displayRole = cell.assigned_position || manualRoles.get(cell.cell_id);
          // Allow role selection if: 
          // 1. This is the confirmed player cell, OR
          // 2. No player cell detected yet and this cell has a selected role, OR  
          // 3. No player cell detected yet and this is first cell on player team
          const isCurrentPlayer = currentPlayerCellId 
            ? cell.cell_id === currentPlayerCellId
            : (cell.cell_id === selectedCellForRole || (isPlayerTeam && !selectedCellForRole));
          const takenRoles = getTakenRoles(cell.cell_id);

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
              assignedPosition={displayRole}
              isCurrentPlayer={isCurrentPlayer}
              isPlayerTeam={isPlayerTeam}
              takenRoles={takenRoles}
              onRoleSelect={(role) => onRoleSelect(cell.cell_id, role)}
            />
          );
        })}
      </div>
    </div>
  );
}


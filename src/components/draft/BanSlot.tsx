import type { ChampionBan, DraftAction } from "../../types";

interface BanSlotProps {
  ban: ChampionBan | undefined;
  index: number;
  isBlue: boolean;
  draftActions: DraftAction[];
  getChampionIconUrl: (id: number) => string;
  getChampionName: (id: number) => string;
}

export default function BanSlot({
  ban,
  index,
  isBlue,
  draftActions,
  getChampionIconUrl,
  getChampionName
}: BanSlotProps) {
  if (!ban || !ban.champion_id) {
    return (
      <div className={`flex-1 h-20 bg-gray-900/50 backdrop-blur-sm ${
        index === 4 ? "" : `border-r ${isBlue ? "border-blue-500/20" : "border-red-500/20"}`
      } flex items-center justify-center transition-all`}>
        <span className="text-gray-500 text-xl font-bold">?</span>
      </div>
    );
  }

  // Check if this ban action is in progress
  const activeBanAction = ban.cell_id && draftActions.find(
    action => action.type === "ban" && 
              action.actor_cell_id === ban.cell_id && 
              action.is_in_progress &&
              !action.completed
  );
  
  const isActivelyBanning = Boolean(activeBanAction && !ban.completed);
  const isPreSelectedBan = Boolean(!activeBanAction && !ban.completed && ban.champion_id !== undefined);

  return (
    <div 
      className={`relative flex-1 h-20 overflow-hidden ${
        index === 4 ? "" : `border-r ${isBlue ? "border-blue-500/20" : "border-red-500/20"}`
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
}


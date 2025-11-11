import type { ChampionBan, DraftAction } from "../../types";

interface BanSlotProps {
  ban: ChampionBan | undefined;
  index: number;
  isBlue: boolean;
  draftActions: DraftAction[];
  getChampionCenteredImageUrl: (id: number) => string;
  getChampionName: (id: number) => string;
}

export default function BanSlot({
  ban,
  index,
  isBlue,
  draftActions,
  getChampionCenteredImageUrl,
  getChampionName
}: BanSlotProps) {
  // Handle no ban selected (champion_id === 0 means nothing selected)
  if (!ban || ban.champion_id === 0) {
    return (
      <div className={`relative flex-1 h-20 bg-gradient-to-r ${
        isBlue 
          ? "from-blue-950/30 to-blue-900/20" 
          : "from-red-950/30 to-red-900/20"
      } backdrop-blur-sm ${
        index === 4 ? "" : `border-r ${isBlue ? "border-blue-500/20" : "border-red-500/20"}`
      } flex items-center justify-center transition-all`}>
        <span className="text-gray-500 text-2xl font-bold">?</span>
      </div>
    );
  }

  // Handle no ban (champion_id === -1 means banned nothing)
  if (ban.champion_id === -1) {
    // Check if this ban action is in progress
    const activeBanAction = ban.cell_id && draftActions.find(
      action => action.type === "ban" && 
                action.actor_cell_id === ban.cell_id && 
                action.is_in_progress &&
                !action.completed
    );
    
    const isActivelyBanning = Boolean(activeBanAction && !ban.completed);

    return (
      <div 
        className={`relative flex-1 h-20 overflow-hidden ${
          index === 4 ? "" : `border-r ${isBlue ? "border-blue-500/20" : "border-red-500/20"}`
        }`}
      >
        <div 
          className={`relative w-full h-full ${
            isActivelyBanning 
              ? "border-l-4 border-yellow-400/90 shadow-lg shadow-yellow-400/40" 
              : ban.completed
              ? "border-l-4 border-gray-600/50 shadow-lg shadow-gray-500/20 opacity-80 grayscale-[0.85]"
              : "border-l-4 border-gray-700/30"
          }`}
        >
          <div className="relative w-full h-full overflow-hidden">
            <img
              src="https://ddragon.leagueoflegends.com/cdn/15.22.1/img/profileicon/29.png"
              alt="No Ban"
              className="w-full h-full object-cover"
              style={{ objectPosition: 'center center' }}
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
            {/* Dark overlay for completed ban */}
            {ban.completed && (
              <div className="absolute inset-0 bg-gray-900/40 pointer-events-none" />
            )}
            {/* No Ban Text and Status Overlay */}
            <div className={`absolute left-2 bottom-2 z-10 ${
              isBlue 
                ? "text-blue-100" 
                : "text-red-100"
            }`}>
              <div className="text-sm font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                No Ban
              </div>
              <div className={`text-xs uppercase tracking-wider ${
                isActivelyBanning 
                  ? "text-yellow-300" 
                  : ban.completed
                  ? "text-gray-300"
                  : "text-gray-400"
              } font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]`}>
                {ban.completed ? "SELECTED" : isActivelyBanning ? "BANNING..." : ""}
              </div>
            </div>
          </div>
        </div>
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
      }`}
    >
      <div 
        className={`relative w-full h-full ${
          isActivelyBanning 
            ? "border-l-4 border-yellow-400/90 shadow-lg shadow-yellow-400/40" 
            : isPreSelectedBan
            ? "opacity-60 grayscale-[0.3] border-l-4 border-yellow-400/50"
            : ban.completed
            ? "border-l-4 border-gray-600/50 shadow-lg shadow-gray-500/20 opacity-80 grayscale-[0.85]"
            : "border-l-4 border-gray-700/30"
        }`}
      >
        <div className="relative w-full h-full overflow-hidden">
          <img
            src={getChampionCenteredImageUrl(ban.champion_id)}
            alt={getChampionName(ban.champion_id)}
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
          {/* Dark overlay for completed ban - very subtle, almost grayscale */}
          {ban.completed && (
            <div className="absolute inset-0 bg-gray-900/40 pointer-events-none" />
          )}
          {/* Dark overlay for preselected ban */}
          {isPreSelectedBan && (
            <div className="absolute inset-0 bg-black/40 pointer-events-none" />
          )}
          {/* Champion Name and Status Overlay */}
          <div className={`absolute left-2 bottom-2 z-10 ${
            isBlue 
              ? "text-blue-100" 
              : "text-red-100"
          }`}>
            <div className="text-sm font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              {getChampionName(ban.champion_id)}
            </div>
            <div className={`text-xs uppercase tracking-wider ${
              isActivelyBanning 
                ? "text-yellow-300" 
                : isPreSelectedBan
                ? "text-yellow-400/70"
                : ban.completed
                ? "text-gray-300"
                : "text-gray-400"
            } font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]`}>
              {ban.completed ? "BANNED" : isPreSelectedBan ? "PRE-SELECTED" : isActivelyBanning ? "BANNING..." : ""}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


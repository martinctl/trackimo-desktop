import { getCurrentWindow } from "@tauri-apps/api/window";
import { useState, useEffect } from "react";
import type { SummonerInfo, RankedStats } from "../types";

interface HeaderProps {
  view: "welcome" | "dashboard";
  summonerInfo?: SummonerInfo | null;
  rankedStats?: RankedStats[];
  championVersion?: string;
}

export default function Header({
  view,
  summonerInfo,
  rankedStats = [],
  championVersion = "latest",
}: HeaderProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    
    const checkMaximized = async () => {
      const maximized = await appWindow.isMaximized();
      setIsMaximized(maximized);
    };

    checkMaximized();

    const unlisten = appWindow.onResized(async () => {
      const maximized = await appWindow.isMaximized();
      setIsMaximized(maximized);
    });

    return () => {
      unlisten.then(unlistenFn => unlistenFn());
    };
  }, []);

  const handleMinimize = async () => {
    const appWindow = getCurrentWindow();
    await appWindow.minimize();
  };

  const handleMaximize = async () => {
    const appWindow = getCurrentWindow();
    if (await appWindow.isMaximized()) {
      await appWindow.unmaximize();
    } else {
      await appWindow.maximize();
    }
  };

  const handleClose = async () => {
    const appWindow = getCurrentWindow();
    await appWindow.close();
  };

  const getRankImage = (tier: string) => {
    const tierLower = tier.toLowerCase();
    return `/ranks/${tierLower}.png`;
  };

  return (
    <div className="flex-shrink-0 bg-black/50 backdrop-blur-xl border-b border-gray-700/30 shadow-lg">
      {/* Title Bar with Window Controls */}
      <div 
        data-tauri-drag-region 
        className="h-10 flex items-center justify-between select-none"
      >
        <div className="flex items-center px-4 h-full">
          <span className="text-sm font-medium text-gray-300">Trackimo Desktop</span>
        </div>

        <div className="flex items-center h-full">
          <button
            onClick={handleMinimize}
            className="h-full w-12 flex items-center justify-center hover:bg-gray-700/30 transition-colors text-gray-400 hover:text-gray-200"
            aria-label="Minimize"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 6H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          
          <button
            onClick={handleMaximize}
            className="h-full w-12 flex items-center justify-center hover:bg-gray-700/30 transition-colors text-gray-400 hover:text-gray-200"
            aria-label={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 4H8V9H3V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4 3H9V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 2H10V10H2V2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
          
          <button
            onClick={handleClose}
            className="h-full w-12 flex items-center justify-center hover:bg-red-600/30 transition-colors text-gray-400 hover:text-red-400"
            aria-label="Close"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Content Header - changes based on view */}
      {view === "dashboard" && summonerInfo && (
        <div className="border-t border-gray-700/20">
          <div className="max-w-[1600px] mx-auto px-8 py-4 flex items-center justify-between">
            {/* Profile Section */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-lg overflow-hidden border-2 border-cyan-400/60 shadow-lg">
                  <img 
                    src={`https://ddragon.leagueoflegends.com/cdn/${championVersion}/img/profileicon/${summonerInfo.profile_icon_id}.png`}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-bold px-2 py-0.5 rounded shadow-lg">
                  {summonerInfo.summoner_level}
                </div>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {summonerInfo.game_name && summonerInfo.tag_line 
                    ? `${summonerInfo.game_name}#${summonerInfo.tag_line}`
                    : summonerInfo.display_name}
                </h2>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                  <span>Online</span>
                </div>
              </div>
            </div>

            {/* Rank Section */}
            {rankedStats.filter(r => r.queue_type === "RANKED_SOLO_5x5").map((rank) => {
              const winRate = rank.wins + rank.losses > 0 
                ? Math.round((rank.wins / (rank.wins + rank.losses)) * 100) 
                : 0;

              return (
                <div key={rank.queue_type} className="flex items-center gap-4">
                  <img 
                    src={getRankImage(rank.tier)}
                    alt={`${rank.tier} ${rank.rank}`}
                    className="w-16 h-16 object-contain drop-shadow-lg"
                  />
                  <div>
                    <div className="text-white font-bold text-lg">
                      {rank.tier.charAt(0) + rank.tier.slice(1).toLowerCase()} {rank.rank}
                    </div>
                    <div className="text-sm text-gray-400">
                      {rank.league_points} LP • {winRate}% WR
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


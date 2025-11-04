import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SummonerInfo, MatchHistoryGame, Champion, RankedStats } from "../../types";
import WelcomeTitle from "./WelcomeTitle";
import WelcomeScreen from "./WelcomeScreen";
import MatchHistory from "./MatchHistory";
import StatsPanel from "./StatsPanel";

interface PlayerDashboardProps {
  summonerInfo: SummonerInfo | null;
  matchHistory: MatchHistoryGame[];
  champions: Map<number, Champion>;
  championVersion: string;
  rankedStats: RankedStats[];
  connected: boolean;
  tauriReady: boolean;
}

export default function PlayerDashboard({
  summonerInfo,
  matchHistory: initialMatchHistory,
  champions,
  championVersion,
  rankedStats,
  connected,
  tauriReady
}: PlayerDashboardProps) {
  const [matchHistory, setMatchHistory] = useState<MatchHistoryGame[]>(initialMatchHistory);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreGames, setHasMoreGames] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Update match history when initial data changes
  useEffect(() => {
    setMatchHistory(initialMatchHistory);
    setHasMoreGames(initialMatchHistory.length >= 10);
  }, [initialMatchHistory]);

  const loadMoreGames = useCallback(async () => {
    if (isLoadingMore || !hasMoreGames || !summonerInfo) return;

    setIsLoadingMore(true);
    try {
      const newGames: MatchHistoryGame[] = await invoke("get_match_history_paginated", {
        begIndex: matchHistory.length,
        endIndex: matchHistory.length + 10
      });

      if (newGames.length === 0) {
        setHasMoreGames(false);
      } else {
        setMatchHistory(prev => [...prev, ...newGames]);
        setHasMoreGames(newGames.length === 10);
      }
    } catch (error) {
      console.error("Failed to load more games:", error);
      setHasMoreGames(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [matchHistory.length, isLoadingMore, hasMoreGames, summonerInfo]);

  // Infinite scroll handler
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // Load more when scrolled to within 200px of bottom
      if (scrollHeight - scrollTop - clientHeight < 200 && hasMoreGames && !isLoadingMore) {
        loadMoreGames();
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [hasMoreGames, isLoadingMore, loadMoreGames]);

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {!summonerInfo && (
        <div className="flex-1 flex items-center justify-center">
          <WelcomeTitle />
        </div>
      )}

      {summonerInfo ? (
        <div className="flex-1 flex overflow-hidden min-w-0">
          {/* Single scroll container for both columns */}
          <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto overflow-x-hidden"
          >
            <div className="flex min-h-full max-w-[1600px] mx-auto w-full">
              {/* Left Column - Match History */}
              <div className="flex-1 px-6 py-6">
                <MatchHistory
                  matchHistory={matchHistory}
                  champions={champions}
                  championVersion={championVersion}
                  isLoadingMore={isLoadingMore}
                  hasMoreGames={hasMoreGames}
                  getChampionCenteredImageUrl={(championId: number) => {
                    const champ = champions.get(championId);
                    if (!champ) return "";
                    return `https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${champ.id}_0.jpg`;
                  }}
                  getChampionName={(championId: number) => {
                    const champ = champions.get(championId);
                    return champ ? champ.name : `Champion ${championId}`;
                  }}
                />
              </div>

              {/* Right Column - Stats Panel */}
              <div className="flex-shrink-0 w-96 border-l border-gray-700/30 bg-black/20 backdrop-blur-xl px-6 py-6">
                <StatsPanel
                  matchHistory={matchHistory}
                  champions={champions}
                  championVersion={championVersion}
                  rankedStats={rankedStats}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <WelcomeScreen connected={connected} tauriReady={tauriReady} />
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { listen } from "@tauri-apps/api/event";
import type { DraftState, Champion, SummonerInfo, RankedStats, MatchHistoryGame } from "./types";
import DraftView from "./DraftView";

interface ConnectionStatus {
  connected: boolean;
  error?: string;
}

function App() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ connected: false });
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [champions, setChampions] = useState<Map<number, Champion>>(new Map());
  const [championVersion, setChampionVersion] = useState<string>("latest");
  const [tauriReady, setTauriReady] = useState(false);
  const [summonerInfo, setSummonerInfo] = useState<SummonerInfo | null>(null);
  const [rankedStats, setRankedStats] = useState<RankedStats[]>([]);
  const [matchHistory, setMatchHistory] = useState<MatchHistoryGame[]>([]);
  const draftStateRef = useRef<DraftState | null>(null);
  const monitoringStartedRef = useRef(false);
  const previousConnectedRef = useRef(false);

  useEffect(() => {
    const initialize = async () => {
      try {
        // Load champions
        await loadChampions();
        setTauriReady(true);
        
        // Auto-connect to LCU
        await autoConnect();
        
        // Listen for draft state changes
        const unlistenDraft = await listen<DraftState>("draft-state-changed", (event) => {
          draftStateRef.current = event.payload;
          setDraftState(event.payload);
        });

        // Monitor gameflow phase to detect game end/dodge
        const phaseCheckInterval = setInterval(async () => {
          try {
            const phase: string = await invoke("get_gameflow_phase");
            
            if (draftStateRef.current && phase !== "ChampSelect" && phase !== "ChampionSelect") {
              draftStateRef.current = null;
              setDraftState(null);
            }
          } catch (e) {
            // Ignore errors - LCU might be disconnected
          }
        }, 2000);

        return () => {
          unlistenDraft();
          clearInterval(phaseCheckInterval);
        };
      } catch (e) {
        // Retry initialization
        setTimeout(initialize, 500);
      }
    };
    
    initialize();
  }, []);

  const loadChampions = async () => {
    try {
      const allChampions: Champion[] = await invoke("get_all_champions");
      const champMap = new Map<number, Champion>();
      allChampions.forEach(champ => champMap.set(champ.key, champ));
      setChampions(champMap);
      
      // Fetch from API if cache is empty
      if (champMap.size === 0) {
        const champData = await invoke("fetch_champion_data", { apiKey: null }) as { version: string, champions: Record<string, Champion> };
        const updated: Champion[] = await invoke("get_all_champions");
        updated.forEach(champ => champMap.set(champ.key, champ));
        setChampions(new Map(champMap));
        setChampionVersion(champData.version);
      } else {
        const version = await invoke("get_champion_version") as string | null;
        if (version) setChampionVersion(version);
      }
    } catch {
      // Failed to load champions - will retry on next connection attempt
    }
  };

  const fetchPlayerInfo = async (retryCount = 0): Promise<boolean> => {
    const maxRetries = 3;
    try {
      const summoner: SummonerInfo = await invoke("get_current_summoner");
      setSummonerInfo(summoner);
      
      const ranked: RankedStats[] = await invoke("get_ranked_stats");
      setRankedStats(ranked);

      try {
        const matches: MatchHistoryGame[] = await invoke("get_match_history");
        setMatchHistory(matches);
      } catch {
        setMatchHistory([]);
      }
      return true;
    } catch (error) {
      // Failed to fetch player info - retry if we haven't exceeded max retries
      if (retryCount < maxRetries) {
        // Wait a bit before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return fetchPlayerInfo(retryCount + 1);
      }
      // Clear data on final failure
      setSummonerInfo(null);
      setRankedStats([]);
      setMatchHistory([]);
      return false;
    }
  };

  const autoConnect = async () => {
    try {
      const status: ConnectionStatus = await invoke("test_connection");
      const wasConnected = previousConnectedRef.current;
      previousConnectedRef.current = status.connected;
      setConnectionStatus(status);
      
      if (status.connected) {
        // Start monitoring if not already started
        if (!monitoringStartedRef.current) {
          await invoke("start_draft_monitoring");
          monitoringStartedRef.current = true;
        }
        
        // Fetch player info if we just connected or if we don't have data yet
        if (!wasConnected || !summonerInfo) {
          // Small delay to ensure League API is fully ready
          await new Promise(resolve => setTimeout(resolve, 500));
          await fetchPlayerInfo();
        }
      } else {
        // Disconnected - clear monitoring and data
        monitoringStartedRef.current = false;
        setSummonerInfo(null);
        setRankedStats([]);
        setMatchHistory([]);
      }
    } catch (error) {
      setConnectionStatus({ connected: false, error: String(error) });
      previousConnectedRef.current = false;
      monitoringStartedRef.current = false;
      setSummonerInfo(null);
      setRankedStats([]);
      setMatchHistory([]);
    }
    
    // Always retry after 3 seconds to detect reconnections/disconnections
    setTimeout(autoConnect, 3000);
  };

  const getRankImage = (tier: string) => {
    const tierLower = tier.toLowerCase();
    return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${tierLower}.png`;
  };

  return (
    <div className="relative flex flex-col h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Subtle connection status in bottom-right corner */}
      <div className="absolute bottom-3 right-3 z-50 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-2 rounded-lg border border-gray-700/30 shadow-lg">
        {!tauriReady ? (
          <>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            <span className="text-xs text-gray-300">Loading...</span>
          </>
        ) : connectionStatus.connected ? (
          <>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-sm shadow-green-400/50"></div>
            <span className="text-xs text-green-400">Connected</span>
          </>
        ) : (
          <>
            <div className="w-2 h-2 bg-red-400 rounded-full"></div>
            <span className="text-xs text-red-400">Disconnected</span>
          </>
        )}
      </div>

      {/* Player Header - shown when connected but not in draft */}
      {summonerInfo && !draftState && (
        <div className="bg-black/50 backdrop-blur-xl border-b border-gray-700/30 shadow-lg">
          <div className="px-8 py-4 flex items-center justify-between">
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
                <h2 className="text-xl font-bold text-white">{summonerInfo.display_name}</h2>
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

      {/* Main content */}
      {!draftState ? (
        <div className="flex-1 overflow-y-auto">
          <div className="min-h-full flex flex-col items-center p-8">
            <div className="w-full max-w-4xl">
              {/* Show title only if not connected */}
              {!summonerInfo && (
                <div className="text-center mb-12">
                  <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
                    Trackimo
                  </h1>
                  <p className="text-gray-400 text-xl">Draft Assistant</p>
                </div>
              )}

              {/* Player Dashboard */}
              {summonerInfo ? (
                <div className="space-y-6 py-6">
                  {/* Recent Games */}
                  {matchHistory.length > 0 && (
                  <div className="bg-black/40 backdrop-blur-xl rounded-xl p-6 border border-gray-700/30 shadow-lg">
                    <h3 className="text-xl font-bold text-white mb-4">Recent Games</h3>
                    <div className="space-y-3">
                      {matchHistory.map((game) => {
                        const champion = champions.get(game.champion_id);
                        const kda = game.deaths > 0 
                          ? ((game.kills + game.assists) / game.deaths).toFixed(2)
                          : (game.kills + game.assists).toFixed(1);
                        const minutes = Math.floor(game.game_duration / 60);
                        const seconds = game.game_duration % 60;

                        return (
                          <div 
                            key={game.game_id}
                            className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                              game.win 
                                ? 'bg-blue-500/10 border-blue-400/30 hover:bg-blue-500/15' 
                                : 'bg-red-500/10 border-red-400/30 hover:bg-red-500/15'
                            }`}
                          >
                            {/* Champion Icon */}
                            <div className="flex-shrink-0">
                              <div className={`w-16 h-16 rounded-lg overflow-hidden border-2 ${
                                game.win ? 'border-blue-400/50' : 'border-red-400/50'
                              }`}>
                                {champion && (
                                  <img 
                                    src={`https://ddragon.leagueoflegends.com/cdn/${championVersion}/img/champion/${champion.id}.png`}
                                    alt={champion.name}
                                    className="w-full h-full object-cover"
                                  />
                                )}
                              </div>
                            </div>

                            {/* Game Info */}
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <span className={`text-sm font-bold ${game.win ? 'text-blue-400' : 'text-red-400'}`}>
                                  {game.win ? 'Victory' : 'Defeat'}
                                </span>
                                <span className="text-gray-500 text-sm">•</span>
                                <span className="text-gray-400 text-sm">{minutes}:{seconds.toString().padStart(2, '0')}</span>
                              </div>
                              <div className="flex items-center gap-4 text-sm">
                                <span className="text-white font-semibold">
                                  {game.kills} / {game.deaths} / {game.assists}
                                </span>
                                <span className="text-gray-500">•</span>
                                <span className="text-gray-300">
                                  <span className="text-cyan-400 font-bold">{kda}</span> KDA
                                </span>
                              </div>
                            </div>

                            {/* Champion Name */}
                            <div className="hidden md:block text-right">
                              <div className="text-white font-semibold">{champion?.name || 'Unknown'}</div>
                              <div className="text-gray-400 text-xs">{champion?.title || ''}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  {!connectionStatus.connected && tauriReady && (
                    <div className="bg-black/40 backdrop-blur-xl rounded-xl p-12 border border-gray-700/30 shadow-xl">
                      <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gray-800/50 flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-gray-600 border-t-blue-400 rounded-full animate-spin"></div>
                      </div>
                      <h3 className="text-xl font-bold text-gray-300 mb-3">Waiting for League Client</h3>
                      <p className="text-gray-500 text-sm">
                        Please start League of Legends to view your profile and stats
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <DraftView 
            draftState={draftState} 
            champions={champions}
            championVersion={championVersion}
          />
        </div>
      )}
    </div>
  );
}

export default App;

import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import type { DraftState, Champion, SummonerInfo, RankedStats, MatchHistoryGame } from "./types";
import DraftView from "./DraftView";
import PlayerHeader from "./components/player/PlayerHeader";
import PlayerDashboard from "./components/player/PlayerDashboard";

function App() {
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [champions, setChampions] = useState<Map<number, Champion>>(new Map());
  const [championVersion, setChampionVersion] = useState<string>("latest");
  const [tauriReady, setTauriReady] = useState(false);
  const [summonerInfo, setSummonerInfo] = useState<SummonerInfo | null>(null);
  const [rankedStats, setRankedStats] = useState<RankedStats[]>([]);
  const [matchHistory, setMatchHistory] = useState<MatchHistoryGame[]>([]);
  const [appVersion, setAppVersion] = useState<string>("");
  const draftStateRef = useRef<DraftState | null>(null);
  const monitoringStartedRef = useRef(false);
  const previousConnectedRef = useRef(false);

  useEffect(() => {
    const initialize = async () => {
      try {
        // Get app version
        const version = await getVersion();
        setAppVersion(version);
        
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
      // Try to get gameflow phase to check if LCU is connected
      await invoke("get_gameflow_phase");
      const wasConnected = previousConnectedRef.current;
      previousConnectedRef.current = true;
      
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
    } catch (error) {
      // LCU not connected
      previousConnectedRef.current = false;
      monitoringStartedRef.current = false;
      setSummonerInfo(null);
      setRankedStats([]);
      setMatchHistory([]);
    }
    
    // Always retry after 3 seconds to detect reconnections/disconnections
    setTimeout(autoConnect, 3000);
  };

  return (
    <div className="relative flex flex-col h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Version display in bottom-right corner */}
      {appVersion && (
        <div className="fixed bottom-2 right-2 z-50 px-2 py-1 bg-black/50 rounded text-xs text-gray-400 font-mono">
          v{appVersion}
        </div>
      )}

      {/* Player Header - shown when connected but not in draft */}
      {summonerInfo && !draftState && (
        <PlayerHeader
          summonerInfo={summonerInfo}
          rankedStats={rankedStats}
          championVersion={championVersion}
        />
      )}

      {/* Main content */}
      {!draftState ? (
        <PlayerDashboard
          summonerInfo={summonerInfo}
          matchHistory={matchHistory}
          champions={champions}
          championVersion={championVersion}
          rankedStats={rankedStats}
          connected={summonerInfo !== null}
          tauriReady={tauriReady}
        />
      ) : (
        <div className="flex-1 overflow-hidden">
          <DraftView 
            draftState={draftState} 
            champions={champions}
          />
        </div>
      )}
    </div>
  );
}

export default App;

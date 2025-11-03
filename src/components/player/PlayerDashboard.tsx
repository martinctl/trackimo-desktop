import type { SummonerInfo, MatchHistoryGame, Champion } from "../../types";
import WelcomeTitle from "./WelcomeTitle";
import WelcomeScreen from "./WelcomeScreen";
import MatchHistory from "./MatchHistory";

interface PlayerDashboardProps {
  summonerInfo: SummonerInfo | null;
  matchHistory: MatchHistoryGame[];
  champions: Map<number, Champion>;
  championVersion: string;
  connectionStatus: { connected: boolean; error?: string };
  tauriReady: boolean;
}

export default function PlayerDashboard({
  summonerInfo,
  matchHistory,
  champions,
  championVersion,
  connectionStatus,
  tauriReady
}: PlayerDashboardProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="min-h-full flex flex-col items-center p-8">
        <div className="w-full max-w-4xl">
          {/* Show title only if not connected */}
          {!summonerInfo && <WelcomeTitle />}

          {/* Player Dashboard */}
          {summonerInfo ? (
            <div className="space-y-6 py-6">
              <MatchHistory
                matchHistory={matchHistory}
                champions={champions}
                championVersion={championVersion}
              />
            </div>
          ) : (
            <WelcomeScreen connectionStatus={connectionStatus} tauriReady={tauriReady} />
          )}
        </div>
      </div>
    </div>
  );
}


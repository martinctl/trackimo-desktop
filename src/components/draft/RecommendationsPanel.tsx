import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { DraftState, Champion } from "../../types";

interface RecommendationsPanelProps {
  draftState: DraftState;
  champions: Map<number, Champion>;
  getChampionCenteredImageUrl: (championId: number) => string;
  currentPlayerRole?: string;
}

interface Recommendation {
  champion_id: number;
  score: number;
}

interface RecommendationsResult {
  recommendations: Recommendation[];
  win_probability: number;
}

export default function RecommendationsPanel({
  draftState,
  champions,
  getChampionCenteredImageUrl,
  currentPlayerRole,
}: RecommendationsPanelProps) {
  const [recommendations, setRecommendations] = useState<RecommendationsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the current player's cell ID
  const getCurrentPlayerCellId = (): number | null => {
    const activeAction = draftState.actions.find(
      (action) => action.type === "pick" && action.is_in_progress && !action.completed
    );
    return activeAction?.actor_cell_id ?? null;
  };

  // Get team prelocks (excluding self)
  const getTeamPrelocks = (): number[] => {
    const currentCellId = getCurrentPlayerCellId();
    if (currentCellId === null) return [];

    // Find which team the current player is on
    let currentTeamId: number | null = null;
    for (const team of draftState.teams) {
      if (team.cells.some((cell) => cell.cell_id === currentCellId)) {
        currentTeamId = team.team_id;
        break;
      }
    }

    if (currentTeamId === null) return [];

    // Get all prelocks from the current team (excluding self)
    const team = draftState.teams.find((t) => t.team_id === currentTeamId);
    if (!team) return [];

    const prelocks: number[] = [];
    for (const cell of team.cells) {
      // Skip self and cells that are already locked
      if (cell.cell_id === currentCellId || cell.champion_id) continue;
      
      // Add prelock if it exists
      if (cell.selected_champion_id && cell.selected_champion_id > 0) {
        prelocks.push(cell.selected_champion_id);
      }
    }

    return prelocks;
  };

  const teamPrelocks = getTeamPrelocks();

  // Check if the current player has locked their champion
  const hasPlayerLockedChampion = (): boolean => {
    const currentCellId = getCurrentPlayerCellId();
    if (currentCellId === null) return false;

    // Find the player's cell
    for (const team of draftState.teams) {
      const cell = team.cells.find((c) => c.cell_id === currentCellId);
      if (cell) {
        // Player has locked if champion_id is set (not null/undefined/0)
        return Boolean(cell.champion_id && cell.champion_id !== 0);
      }
    }
    return false;
  };

  useEffect(() => {
    // Fetch recommendations on any draft state change
    const fetchRecommendations = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<RecommendationsResult>("get_draft_recommendations", {
          draftState: draftState,
          topK: 5, // This will be converted to top_k by Tauri
          playerRole: currentPlayerRole || null, // Pass the player's selected role
        });
        setRecommendations(result);
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        setError(errorMsg);
        console.error("Failed to get recommendations:", errorMsg);
      } finally {
        setLoading(false);
      }
    };

    // Debounce to avoid too many requests
    const timeoutId = setTimeout(fetchRecommendations, 300);
    return () => clearTimeout(timeoutId);
  }, [draftState, currentPlayerRole]);

  // Hide panel if the current player has locked their champion
  if (hasPlayerLockedChampion()) {
    return null;
  }

  if (loading) {
    return (
      <div className="w-80 h-full bg-black/50 backdrop-blur-xl border-l border-gray-700/30 p-4 flex items-center justify-center">
        <div className="text-gray-400">Loading recommendations...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-80 h-full bg-black/50 backdrop-blur-xl border-l border-gray-700/30 p-4">
        <div className="text-red-400 text-sm">Failed to load recommendations</div>
        <div className="text-gray-500 text-xs mt-1">{error}</div>
      </div>
    );
  }

  // Show panel if we have either team prelocks or AI recommendations
  if ((!recommendations || recommendations.recommendations.length === 0) && teamPrelocks.length === 0) {
    return null;
  }

  return (
    <div className="w-80 h-full bg-black/50 backdrop-blur-xl border-l border-gray-700/30 flex flex-col overflow-hidden shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-gray-700/30 bg-black/20 backdrop-blur-sm">
        <h3 className="text-lg font-semibold text-white">Recommendations</h3>
        {recommendations && recommendations.win_probability > 0 && (
          <div className="mt-2 text-sm">
            <span className="text-gray-400">Win Probability: </span>
            <span className={`font-semibold ${
              recommendations.win_probability >= 0.55
                ? "text-green-400"
                : recommendations.win_probability >= 0.45
                ? "text-yellow-400"
                : "text-red-400"
            }`}>
              {(recommendations.win_probability * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {/* Recommendations List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Team Prelocks Section */}
        {teamPrelocks.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-blue-300 uppercase tracking-wider mb-2 px-1">
              Team Suggestions
            </div>
            <div className="space-y-2">
              {teamPrelocks.map((championId) => {
                const champ = champions.get(championId);
                if (!champ) return null;

                return (
                  <div
                    key={`prelock-${championId}`}
                    className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-950/30 to-blue-900/20 rounded-lg border border-blue-500/20 hover:from-blue-950/40 hover:to-blue-900/30 transition-colors backdrop-blur-sm"
                  >
                    {/* Icon Badge */}
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-black/70 rounded-lg border-2 border-blue-600/50 backdrop-blur-sm">
                      <svg className="w-4 h-4 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>

                    {/* Champion Image */}
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 border-blue-500/20">
                      <img
                        src={getChampionCenteredImageUrl(championId)}
                        alt={champ.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://ddragon.leagueoflegends.com/cdn/13.24.1/img/champion/${champ.id}.png`;
                        }}
                      />
                    </div>

                    {/* Champion Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white truncate">{champ.name}</div>
                      <div className="text-xs text-blue-200">Teammate wants</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AI Recommendations Section */}
        {recommendations && recommendations.recommendations.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-purple-300 uppercase tracking-wider mb-2 px-1">
              AI Suggestions
            </div>
            <div className="space-y-2">
              {recommendations.recommendations.map((rec, idx) => {
                const champ = champions.get(rec.champion_id);
                if (!champ) return null;

                return (
                  <div
                    key={rec.champion_id}
                    className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg border border-gray-700/30 hover:bg-gray-900/70 transition-colors backdrop-blur-sm"
                  >
                    {/* Rank Badge */}
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-black/70 rounded-lg border-2 border-gray-600/50 backdrop-blur-sm text-white font-bold text-sm">
                      {idx + 1}
                    </div>

                    {/* Champion Image */}
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 border-gray-700/30">
                      <img
                        src={getChampionCenteredImageUrl(rec.champion_id)}
                        alt={champ.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://ddragon.leagueoflegends.com/cdn/13.24.1/img/champion/${champ.id}.png`;
                        }}
                      />
                    </div>

                    {/* Champion Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white truncate">{champ.name}</div>
                      <div className="text-xs text-gray-400">
                        {(rec.score * 100).toFixed(1)}% match
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


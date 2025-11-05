import type { DraftState, Champion } from "./types";
import TeamView from "./components/draft/TeamView";

interface DraftViewProps {
  draftState: DraftState | null;
  champions: Map<number, Champion>;
}

export default function DraftView({ draftState, champions }: DraftViewProps) {

  const getChampionCenteredImageUrl = (championId: number): string => {
    const champ = champions.get(championId);
    if (!champ) return "";
    return `https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${champ.id}_0.jpg`;
  };

  const getChampionName = (championId: number): string => {
    const champ = champions.get(championId);
    return champ ? champ.name : `Champion ${championId}`;
  };

  if (!draftState) return null;

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Main Draft Area */}
      <div className="flex-1 flex overflow-hidden min-w-0">
        {draftState.teams.length >= 2 ? (
          <>
            <TeamView
              team={draftState.teams[0]}
              isBlue={true}
              draftState={draftState}
              getChampionCenteredImageUrl={getChampionCenteredImageUrl}
              getChampionName={getChampionName}
            />
            
            {/* Center VS Divider */}
            <div className="flex-shrink-0 w-32 flex items-center justify-center bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-2xl relative shadow-inner min-w-[120px]">
              <div className="absolute inset-0 opacity-[0.03]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_white_1px,_transparent_1px)] bg-[length:40px_40px]" />
              </div>
              <div className="relative text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 drop-shadow-2xl">
                VS
              </div>
            </div>
            
            <TeamView
              team={draftState.teams[1]}
              isBlue={false}
              draftState={draftState}
              getChampionCenteredImageUrl={getChampionCenteredImageUrl}
              getChampionName={getChampionName}
            />
          </>
        ) : draftState.teams.length === 1 ? (
          <div className="flex-1 flex">
            <div className="flex-1" />
            <TeamView
              team={draftState.teams[0]}
              isBlue={true}
              draftState={draftState}
              getChampionCenteredImageUrl={getChampionCenteredImageUrl}
              getChampionName={getChampionName}
            />
            <div className="flex-1" />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <p className="text-xl">Waiting for draft to start...</p>
          </div>
        )}
      </div>
    </div>
  );
}

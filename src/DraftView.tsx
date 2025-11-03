import { useEffect, useState } from "react";
import type { DraftState, Champion } from "./types";
import DraftHeader from "./components/draft/DraftHeader";
import TeamView from "./components/draft/TeamView";

interface DraftViewProps {
  draftState: DraftState | null;
  champions: Map<number, Champion>;
  championVersion?: string;
}

const PICK_TIMER = 30;
const BAN_TIMER = 30;

export default function DraftView({ draftState, champions, championVersion = "latest" }: DraftViewProps) {
  const [currentTimer, setCurrentTimer] = useState<number>(0);
  const [maxTimer, setMaxTimer] = useState<number>(PICK_TIMER);

  useEffect(() => {
    if (draftState?.timer) {
      setCurrentTimer(draftState.timer);
      const timer = draftState.phase.includes("BAN") ? BAN_TIMER : PICK_TIMER;
      setMaxTimer(timer);
    }
  }, [draftState]);

  // Countdown timer
  useEffect(() => {
    if (!draftState || !draftState.timer) return;

    const interval = setInterval(() => {
      setCurrentTimer((prev) => {
        if (prev <= 0) return 0;
        return Math.max(0, prev - 0.1);
      });
    }, 100);

    return () => clearInterval(interval);
  }, [draftState]);

  const getChampionIconUrl = (championId: number): string => {
    const champ = champions.get(championId);
    if (!champ) return "";
    return `https://ddragon.leagueoflegends.com/cdn/${championVersion || "latest"}/img/champion/${champ.id}.png`;
  };

  const getChampionCenteredImageUrl = (championId: number): string => {
    const champ = champions.get(championId);
    if (!champ) return "";
    return `https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${champ.id}_0.jpg`;
  };

  const getChampionName = (championId: number): string => {
    const champ = champions.get(championId);
    return champ ? champ.name : `Champion ${championId}`;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!draftState) return null;

  const hasTwoTeams = draftState.teams.length >= 2;

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <DraftHeader
        phase={draftState.phase}
        hasTwoTeams={hasTwoTeams}
        timer={draftState.timer}
        currentTimer={currentTimer}
        maxTimer={maxTimer}
        formatTime={formatTime}
      />

      {/* Main Draft Area */}
      <div className="flex-1 flex overflow-hidden min-w-0">
        {draftState.teams.length >= 2 ? (
          <>
            <TeamView
              team={draftState.teams[0]}
              isBlue={true}
              draftState={draftState}
              champions={champions}
              championVersion={championVersion}
              getChampionIconUrl={getChampionIconUrl}
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
              champions={champions}
              championVersion={championVersion}
              getChampionIconUrl={getChampionIconUrl}
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
              champions={champions}
              championVersion={championVersion}
              getChampionIconUrl={getChampionIconUrl}
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

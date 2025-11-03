import TimerBar from "./TimerBar";

interface DraftHeaderProps {
  phase: string;
  hasTwoTeams: boolean;
  timer?: number;
  currentTimer: number;
  maxTimer: number;
  formatTime: (seconds: number) => string;
}

export default function DraftHeader({
  phase,
  hasTwoTeams,
  timer,
  currentTimer,
  maxTimer,
  formatTime
}: DraftHeaderProps) {
  return (
    <div className="bg-black/50 backdrop-blur-xl text-white px-6 py-4 border-b border-gray-700/30 shadow-lg flex-shrink-0">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-6 flex-1 min-w-0">
          <h2 className="text-xl font-bold uppercase tracking-wider text-gray-200 flex-shrink-0">
            {phase.replace(/_/g, " ")}
          </h2>
          {hasTwoTeams && (
            <>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-lg font-bold text-blue-300">Blue Side</span>
                <span className="text-gray-500">/</span>
                <span className="text-lg font-bold text-red-300">Red Side</span>
              </div>
            </>
          )}
        </div>
        {timer !== undefined && (
          <TimerBar currentTimer={currentTimer} maxTimer={maxTimer} formatTime={formatTime} />
        )}
      </div>
    </div>
  );
}


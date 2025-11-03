import TimerBar from "./TimerBar";

interface DraftHeaderProps {
  timer?: number;
  currentTimer: number;
  maxTimer: number;
  formatTime: (seconds: number) => string;
}

export default function DraftHeader({
  timer,
  currentTimer,
  maxTimer,
  formatTime
}: DraftHeaderProps) {
  return (
    <div className="bg-black/50 backdrop-blur-xl text-white border-b border-gray-700/30 shadow-lg flex-shrink-0 flex flex-col">
      {/* Top row with timer */}
      <div className="flex items-center justify-center px-6 py-4">
        {timer !== undefined && (
          <div className="text-3xl font-mono font-bold tabular-nums">
            {formatTime(currentTimer)}
          </div>
        )}
      </div>
      
      {/* Full width timer bar at the bottom */}
      {timer !== undefined && (
        <div className="w-full h-2 bg-gray-800/80 backdrop-blur-sm overflow-hidden border-t border-gray-700/50">
          <TimerBar currentTimer={currentTimer} maxTimer={maxTimer} />
        </div>
      )}
    </div>
  );
}


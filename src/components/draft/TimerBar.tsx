interface TimerBarProps {
  currentTimer: number;
  maxTimer: number;
  formatTime: (seconds: number) => string;
}

export default function TimerBar({ currentTimer, maxTimer, formatTime }: TimerBarProps) {
  const timerPercent = maxTimer > 0 ? (currentTimer / maxTimer) * 100 : 0;

  return (
    <div className="flex items-center gap-4 flex-shrink-0">
      <div className="text-2xl font-mono font-bold tabular-nums">
        {formatTime(currentTimer)}
      </div>
      <div className="w-48 h-3 bg-gray-800/80 backdrop-blur-sm rounded-full overflow-hidden border border-gray-700/50 shadow-inner min-w-[120px]">
        <div
          className={`h-full transition-all duration-100 ${
            timerPercent > 50 
              ? "bg-gradient-to-r from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/30" 
              : timerPercent > 20 
              ? "bg-gradient-to-r from-yellow-500 to-orange-400 shadow-lg shadow-yellow-500/30" 
              : "bg-gradient-to-r from-red-500 to-pink-500 shadow-lg shadow-red-500/30"
          }`}
          style={{ width: `${timerPercent}%` }}
        />
      </div>
    </div>
  );
}


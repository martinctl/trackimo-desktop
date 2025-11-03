interface TimerBarProps {
  currentTimer: number;
  maxTimer: number;
}

export default function TimerBar({ currentTimer, maxTimer }: TimerBarProps) {
  const timerPercent = maxTimer > 0 ? (currentTimer / maxTimer) * 100 : 0;

  return (
    <div
      className={`h-full transition-all duration-75 ${
        timerPercent > 50 
          ? "bg-gradient-to-r from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/30" 
          : timerPercent > 20 
          ? "bg-gradient-to-r from-yellow-500 to-orange-400 shadow-lg shadow-yellow-500/30" 
          : "bg-gradient-to-r from-red-500 to-pink-500 shadow-lg shadow-red-500/30"
      }`}
      style={{ width: `${timerPercent}%` }}
    />
  );
}


interface PickCardProps {
  isBlue: boolean;
  isActivelySelecting: boolean;
  isPreLocked: boolean;
  isLocked: boolean;
  champIdToDisplay: number | undefined;
  getChampionCenteredImageUrl: (id: number) => string;
  getChampionName: (id: number) => string;
}

export default function PickCard({
  isBlue,
  isActivelySelecting,
  isPreLocked,
  isLocked,
  champIdToDisplay,
  getChampionCenteredImageUrl,
  getChampionName
}: PickCardProps) {
  return (
    <div 
      className={`relative flex items-center bg-gradient-to-r ${
        isBlue 
          ? "from-blue-950/30 to-blue-900/20" 
          : "from-red-950/30 to-red-900/20"
      } backdrop-blur-sm border-b ${
        isBlue 
          ? "border-blue-500/20" 
          : "border-red-500/20"
      } ${
        isActivelySelecting ? "shadow-lg" : ""
      } overflow-hidden flex-1 min-h-[120px]`}
    >
      {/* Champion Centered Image - Takes most of the space */}
      <div 
        className={`relative flex-1 h-full ${
          isActivelySelecting 
            ? "border-l-4 border-yellow-400/90 shadow-lg shadow-yellow-400/40" 
            : isPreLocked
            ? "opacity-60 grayscale-[0.3] border-l-4 border-yellow-400/50"
            : isLocked 
            ? "border-l-4 border-cyan-400/80 shadow-lg shadow-cyan-400/30" 
            : "border-l-4 border-gray-700/30"
        }`}
      >
        <div className="relative w-full h-full overflow-hidden">
        {champIdToDisplay && champIdToDisplay !== 0 ? (
          <>
            <img
              src={getChampionCenteredImageUrl(champIdToDisplay)}
              alt={getChampionName(champIdToDisplay)}
              className="w-full h-full object-cover"
              style={{ objectPosition: 'center 30%' }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
            {/* Gradient overlay for better text readability */}
            <div className={`absolute inset-0 bg-gradient-to-r ${
              isBlue
                ? "from-blue-950/80 via-blue-950/40 to-transparent"
                : "from-red-950/80 via-red-950/40 to-transparent"
            } pointer-events-none`} />
            {/* Dark overlay for prelock state */}
            {isPreLocked && (
              <div className="absolute inset-0 bg-black/40 pointer-events-none" />
            )}
            {/* Champion Name Overlay */}
            <div className={`absolute left-4 bottom-4 z-10 ${
              isBlue 
                ? "text-blue-100" 
                : "text-red-100"
            }`}>
              <div className="text-2xl font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                {getChampionName(champIdToDisplay)}
              </div>
              <div className={`text-xs uppercase tracking-wider ${
                isActivelySelecting 
                  ? "text-yellow-300" 
                  : isPreLocked
                  ? "text-yellow-400/70"
                  : isLocked
                  ? "text-cyan-300"
                  : "text-gray-400"
              } font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]`}>
                {isLocked ? "LOCKED" : isPreLocked ? "PRE-LOCKED" : isActivelySelecting ? "SELECTING..." : ""}
              </div>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-900/50">
            <span className="text-gray-500 text-5xl font-bold">?</span>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}


interface ConnectionStatusProps {
  tauriReady: boolean;
  connected: boolean;
}

export default function ConnectionStatus({ tauriReady, connected }: ConnectionStatusProps) {
  return (
    <div className="absolute bottom-3 right-3 z-50 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-2 rounded-lg border border-gray-700/30 shadow-lg">
      {!tauriReady ? (
        <>
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
          <span className="text-xs text-gray-300">Loading...</span>
        </>
      ) : connected ? (
        <>
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-sm shadow-green-400/50"></div>
          <span className="text-xs text-green-400">Connected</span>
        </>
      ) : (
        <>
          <div className="w-2 h-2 bg-red-400 rounded-full"></div>
          <span className="text-xs text-red-400">Disconnected</span>
        </>
      )}
    </div>
  );
}


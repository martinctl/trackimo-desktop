interface WelcomeScreenProps {
  connected: boolean;
  tauriReady: boolean;
}

export default function WelcomeScreen({ connected, tauriReady }: WelcomeScreenProps) {
  return (
    <div className="text-center py-12">
      {!connected && tauriReady && (
        <div className="bg-black/40 backdrop-blur-xl rounded-xl p-12 border border-gray-700/30 shadow-xl">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gray-800/50 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-gray-600 border-t-blue-400 rounded-full animate-spin"></div>
          </div>
          <h3 className="text-xl font-bold text-gray-300 mb-3">Waiting for League Client</h3>
          <p className="text-gray-500 text-sm">
            Please start League of Legends to view your profile and stats
          </p>
        </div>
      )}
    </div>
  );
}


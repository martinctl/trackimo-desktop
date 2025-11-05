interface UpdateNotificationProps {
  version: string;
  currentVersion: string;
  isInstalling: boolean;
  onInstall: () => void;
  onDismiss: () => void;
}

export default function UpdateNotification({
  version,
  currentVersion,
  isInstalling,
  onInstall,
  onDismiss,
}: UpdateNotificationProps) {
  return (
    <div className="fixed bottom-2 left-2 z-50 bg-black/50 backdrop-blur-xl border border-gray-700/30 rounded-lg shadow-lg px-4 py-3 max-w-sm">
      {/* Close button */}
      <button
        onClick={onDismiss}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-200 transition-colors"
        aria-label="Dismiss"
      >
        <svg 
          width="14" 
          height="14" 
          viewBox="0 0 14 14" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" 
            stroke="currentColor" 
            strokeWidth="1.5" 
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Content */}
      <div>
        <div className="text-sm font-medium text-white mb-1">
          Update Available
        </div>
        <div className="text-xs text-gray-400 mb-3">
          v{version} (current: v{currentVersion})
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onDismiss}
            className="px-3 py-1.5 text-xs bg-gray-700/50 hover:bg-gray-700/70 text-gray-300 rounded transition-colors"
          >
            Later
          </button>
          <button
            onClick={onInstall}
            disabled={isInstalling}
            className="px-3 py-1.5 text-xs bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {isInstalling ? 'Installing...' : 'Install Now'}
          </button>
        </div>
      </div>
    </div>
  );
}


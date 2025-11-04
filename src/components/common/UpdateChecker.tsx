import { useState, useEffect } from 'react';
import { check } from '@tauri-apps/plugin-updater';

interface UpdateInfo {
  available: boolean;
  version?: string;
  currentVersion?: string;
}

export function UpdateChecker() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdates = async () => {
    setIsChecking(true);
    setError(null);

    try {
      // For private GitHub repos, you need to provide authentication
      // Option 1: Use a GitHub Personal Access Token (store securely!)
      // Option 2: Use a proxy server endpoint
      // Option 3: Use the raw manifest URL (public)
      
      const update = await check({
        // If using GitHub API directly with private repo:
        // headers: {
        //   'Authorization': `token ${yourGitHubToken}`,
        //   'Accept': 'application/vnd.github.v3+json'
        // },
        
        // If using timeout:
        timeout: 30000, // 30 seconds
      });

      if (update?.available) {
        setUpdateInfo({
          available: true,
          version: update.version,
          currentVersion: update.currentVersion,
        });
      } else {
        setUpdateInfo({
          available: false,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Failed to check for updates:', err);
    } finally {
      setIsChecking(false);
    }
  };

  const installUpdate = async () => {
    if (!updateInfo?.available) return;

    try {
      const update = await check();
      if (update?.available) {
        await update.downloadAndInstall();
      }
    } catch (err) {
      console.error('Failed to install update:', err);
      setError('Failed to install update. Please try again.');
    }
  };

  useEffect(() => {
    // Check for updates on component mount (optional)
    // checkForUpdates();
  }, []);

  return (
    <div className="update-checker">
      {error && (
        <div className="text-red-500 text-sm mb-2">
          Error: {error}
        </div>
      )}

      {updateInfo?.available && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-2">
          <p className="text-sm">
            Update available: {updateInfo.version} (current: {updateInfo.currentVersion})
          </p>
          <button
            onClick={installUpdate}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Install Update
          </button>
        </div>
      )}

      <button
        onClick={checkForUpdates}
        disabled={isChecking}
        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
      >
        {isChecking ? 'Checking...' : 'Check for Updates'}
      </button>

      {updateInfo && !updateInfo.available && !error && (
        <p className="text-sm text-gray-600 mt-2">
          You're using the latest version.
        </p>
      )}
    </div>
  );
}


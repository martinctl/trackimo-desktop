import { getCurrentWindow } from "@tauri-apps/api/window";
import { useState, useEffect } from "react";

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    
    const checkMaximized = async () => {
      const maximized = await appWindow.isMaximized();
      setIsMaximized(maximized);
    };

    checkMaximized();

    const unlisten = appWindow.onResized(async () => {
      const maximized = await appWindow.isMaximized();
      setIsMaximized(maximized);
    });

    return () => {
      unlisten.then(unlistenFn => unlistenFn());
    };
  }, []);

  const handleMinimize = async () => {
    const appWindow = getCurrentWindow();
    await appWindow.minimize();
  };

  const handleMaximize = async () => {
    const appWindow = getCurrentWindow();
    if (await appWindow.isMaximized()) {
      await appWindow.unmaximize();
    } else {
      await appWindow.maximize();
    }
  };

  const handleClose = async () => {
    const appWindow = getCurrentWindow();
    await appWindow.close();
  };

  return (
    <div 
      data-tauri-drag-region 
      className="h-10 flex-shrink-0 flex items-center justify-between bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-b border-gray-700/30 select-none z-50"
    >
      <div className="flex items-center px-4 h-full">
        <span className="text-sm font-medium text-gray-300">Trackimo Desktop</span>
      </div>

      <div className="flex items-center h-full">
        <button
          onClick={handleMinimize}
          className="h-full w-12 flex items-center justify-center hover:bg-gray-700/30 transition-colors text-gray-400 hover:text-gray-200"
          aria-label="Minimize"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 6H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
        
        <button
          onClick={handleMaximize}
          className="h-full w-12 flex items-center justify-center hover:bg-gray-700/30 transition-colors text-gray-400 hover:text-gray-200"
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 4H8V9H3V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 3H9V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 2H10V10H2V2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
        
        <button
          onClick={handleClose}
          className="h-full w-12 flex items-center justify-center hover:bg-red-600/30 transition-colors text-gray-400 hover:text-red-400"
          aria-label="Close"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}


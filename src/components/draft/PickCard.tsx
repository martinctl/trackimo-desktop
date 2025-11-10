import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface PickCardProps {
  isBlue: boolean;
  isActivelySelecting: boolean;
  isPreLocked: boolean;
  isLocked: boolean;
  champIdToDisplay: number | undefined;
  getChampionCenteredImageUrl: (id: number) => string;
  getChampionName: (id: number) => string;
  assignedPosition?: string;
  isCurrentPlayer: boolean;
  isPlayerTeam: boolean;
  takenRoles: string[];
  onRoleSelect?: (role: string) => void;
}

const ROLES = [
  { key: "TOP", label: "Top", icon: "top.png" },
  { key: "JUNGLE", label: "Jungle", icon: "jungle.png" },
  { key: "MIDDLE", label: "Mid", icon: "middle.png" },
  { key: "BOTTOM", label: "Bot", icon: "bottom.png" },
  { key: "UTILITY", label: "Support", icon: "support.png" },
];

interface RoleSelectorProps {
  dropdownRef: React.RefObject<HTMLDivElement>;
  position: { top: number; left: number };
  availableRoles: typeof ROLES;
  assignedPosition: string | undefined;
  onRoleSelect: (roleKey: string) => void;
  onClose: () => void;
}

function RoleSelector({ 
  dropdownRef, 
  position, 
  availableRoles, 
  assignedPosition, 
  onRoleSelect, 
  onClose 
}: RoleSelectorProps) {
  return createPortal(
    <div 
      ref={dropdownRef}
      className="fixed bg-gray-900/95 rounded-lg border-2 border-gray-600 p-2 shadow-xl backdrop-blur-md min-w-[140px] z-[9999]"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
    >
      <div className="text-xs text-gray-300 font-semibold mb-2 px-1">Select Role</div>
      <div className="space-y-1">
        {availableRoles.map((role) => (
          <button
            key={role.key}
            onClick={() => onRoleSelect(role.key)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition-colors ${
              assignedPosition === role.key 
                ? "bg-blue-600/50 hover:bg-blue-600/70" 
                : "hover:bg-gray-700/80"
            }`}
          >
            <img 
              src={`/roles/${role.icon}`} 
              alt={role.label}
              className="w-6 h-6 object-contain"
            />
            <span className="text-sm text-white">{role.label}</span>
            {assignedPosition === role.key && (
              <svg className="w-4 h-4 text-green-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        ))}
      </div>
      <button
        onClick={onClose}
        className="w-full mt-2 px-2 py-1 text-xs text-gray-400 hover:text-white transition-colors"
      >
        Cancel
      </button>
    </div>,
    document.body
  );
}

export default function PickCard({
  isBlue,
  isActivelySelecting,
  isPreLocked,
  isLocked,
  champIdToDisplay,
  getChampionCenteredImageUrl,
  getChampionName,
  assignedPosition,
  isCurrentPlayer,
  isPlayerTeam,
  takenRoles,
  onRoleSelect,
}: PickCardProps) {
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getRoleIcon = (position: string): string | null => {
    const role = ROLES.find(r => r.key === position.toUpperCase());
    return role ? `/roles/${role.icon}` : null;
  };

  const handleRoleSelect = (roleKey: string) => {
    if (onRoleSelect) {
      onRoleSelect(roleKey);
    }
    setShowRoleSelector(false);
  };

  const handleOpenRoleSelector = (event: React.MouseEvent<HTMLButtonElement>) => {
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const dropdownWidth = 140; // min-w-[140px]
    
    // Position dropdown below the button, aligned to the right edge
    setDropdownPosition({
      top: rect.bottom + 8, // 8px gap below button
      left: rect.right - dropdownWidth, // Align right edges
    });
    
    setShowRoleSelector(true);
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    if (!showRoleSelector) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowRoleSelector(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showRoleSelector]);

  // Filter available roles - exclude roles already taken by teammates
  const availableRoles = ROLES.filter(role => 
    !takenRoles.includes(role.key) || assignedPosition === role.key
  );
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
      } overflow-visible flex-1 min-h-[120px]`}
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
            
            {/* Role Icon or Selector */}
            <div className="absolute top-2 right-2 z-[100]">
              {isPlayerTeam ? (
                // Player's team - show role icon with ability to change
                <div className="relative">
                  {assignedPosition && getRoleIcon(assignedPosition) && !showRoleSelector ? (
                    // Show role icon with edit overlay
                    <div className="relative group">
                      <div className="w-10 h-10 bg-black/70 rounded-lg p-1.5 border-2 border-gray-600/50 backdrop-blur-sm">
                        <img 
                          src={getRoleIcon(assignedPosition)!} 
                          alt={assignedPosition}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      {isCurrentPlayer && (
                        <button
                          ref={buttonRef}
                          onClick={handleOpenRoleSelector}
                          className="absolute inset-0 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                          title="Change role"
                        >
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ) : isCurrentPlayer && !assignedPosition && !showRoleSelector ? (
                    // Show + button if no role assigned
                    <button
                      ref={buttonRef}
                      onClick={handleOpenRoleSelector}
                      className="w-10 h-10 bg-yellow-600/90 hover:bg-yellow-500/90 rounded-lg p-2 border-2 border-yellow-400/70 backdrop-blur-sm transition-colors cursor-pointer flex items-center justify-center"
                      title="Select your role"
                    >
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  ) : null}
                  
                  {showRoleSelector && isCurrentPlayer && (
                    <RoleSelector
                      dropdownRef={dropdownRef}
                      position={dropdownPosition}
                      availableRoles={availableRoles}
                      assignedPosition={assignedPosition}
                      onRoleSelect={handleRoleSelect}
                      onClose={() => setShowRoleSelector(false)}
                    />
                  )}
                </div>
              ) : (
                // Enemy team - just show role icon if available
                assignedPosition && getRoleIcon(assignedPosition) ? (
                  <div className="w-10 h-10 bg-black/70 rounded-lg p-1.5 border-2 border-gray-600/50 backdrop-blur-sm">
                    <img 
                      src={getRoleIcon(assignedPosition)!} 
                      alt={assignedPosition}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : null
              )}
            </div>

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
          <div className="relative w-full h-full flex items-center justify-center bg-gray-900/50">
            <span className="text-gray-500 text-5xl font-bold">?</span>
            
            {/* Role Icon or Selector for empty slot */}
            <div className="absolute top-2 right-2 z-[100]">
              {isPlayerTeam && isCurrentPlayer ? (
                // Player's team - show role icon with ability to change
                <div className="relative">
                  {assignedPosition && getRoleIcon(assignedPosition) && !showRoleSelector ? (
                    // Show role icon with edit overlay
                    <div className="relative group">
                      <div className="w-10 h-10 bg-black/70 rounded-lg p-1.5 border-2 border-gray-600/50 backdrop-blur-sm">
                        <img 
                          src={getRoleIcon(assignedPosition)!} 
                          alt={assignedPosition}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <button
                        ref={buttonRef}
                        onClick={handleOpenRoleSelector}
                        className="absolute inset-0 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                        title="Change role"
                      >
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>
                  ) : !assignedPosition && !showRoleSelector ? (
                    // Show + button if no role assigned
                    <button
                      ref={buttonRef}
                      onClick={handleOpenRoleSelector}
                      className="w-10 h-10 bg-yellow-600/90 hover:bg-yellow-500/90 rounded-lg p-2 border-2 border-yellow-400/70 backdrop-blur-sm transition-colors cursor-pointer flex items-center justify-center"
                      title="Select your role"
                    >
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  ) : null}
                  
                  {showRoleSelector && (
                    <RoleSelector
                      dropdownRef={dropdownRef}
                      position={dropdownPosition}
                      availableRoles={availableRoles}
                      assignedPosition={assignedPosition}
                      onRoleSelect={handleRoleSelect}
                      onClose={() => setShowRoleSelector(false)}
                    />
                  )}
                </div>
              ) : isPlayerTeam && !isCurrentPlayer && assignedPosition && getRoleIcon(assignedPosition) ? (
                // Teammate's role icon (read-only)
                <div className="w-10 h-10 bg-black/70 rounded-lg p-1.5 border-2 border-gray-600/50 backdrop-blur-sm">
                  <img 
                    src={getRoleIcon(assignedPosition)!} 
                    alt={assignedPosition}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : null}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}


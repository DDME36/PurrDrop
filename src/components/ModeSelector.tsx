'use client';

import { useState, useEffect } from 'react';

export type DiscoveryMode = 'public' | 'wifi' | 'private';

interface ModeSelectorProps {
  mode: DiscoveryMode;
  roomCode: string | null;
  roomPassword: string | null;
  networkName: string | null;
  roomError: string | null;
  onChangeMode: (mode: DiscoveryMode, roomCode?: string, password?: string) => void;
}

// Lucide Icons as components
const EarthIcon = ({ className = '' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21.54 15H17a2 2 0 0 0-2 2v4.54"/>
    <path d="M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17"/>
    <path d="M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05"/>
    <circle cx="12" cy="12" r="10"/>
  </svg>
);

const WifiIcon = ({ className = '' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 20h.01"/>
    <path d="M2 8.82a15 15 0 0 1 20 0"/>
    <path d="M5 12.859a10 10 0 0 1 14 0"/>
    <path d="M8.5 16.429a5 5 0 0 1 7 0"/>
  </svg>
);

const LockIcon = ({ className = '' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const DoorOpenIcon = ({ className = '' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M13 4h3a2 2 0 0 1 2 2v14"/>
    <path d="M2 20h3"/>
    <path d="M13 20h9"/>
    <path d="M10 12v.01"/>
    <path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z"/>
  </svg>
);

const CopyIcon = ({ className = '' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
  </svg>
);

const CheckIcon = ({ className = '' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20 6 9 17l-5-5"/>
  </svg>
);

const CheckSmallIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-pink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5"/>
  </svg>
);

const BackspaceIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 5a2 2 0 0 0-1.344.519l-6.328 5.74a1 1 0 0 0 0 1.481l6.328 5.741A2 2 0 0 0 10 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z"/>
    <path d="m12 9 6 6"/>
    <path d="m18 9-6 6"/>
  </svg>
);

const modeIcons = {
  public: EarthIcon,
  wifi: WifiIcon,
  private: LockIcon,
};

const modeConfig = {
  public: { label: 'สาธารณะ', desc: 'เห็นทุกคน' },
  wifi: { label: 'WiFi', desc: 'เฉพาะเครือข่ายเดียวกัน' },
  private: { label: 'ส่วนตัว', desc: 'เฉพาะรหัสห้อง' },
};

export function ModeSelector({ mode, roomCode, networkName, roomError, onChangeMode }: ModeSelectorProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(null);

  useEffect(() => {
    if (roomError) {
      setJoinError(roomError);
      setTimeout(() => setJoinError(null), 3000);
    }
  }, [roomError]);

  useEffect(() => {
    if (mode === 'private' && roomCode && pendingJoinCode && roomCode === pendingJoinCode) {
      setShowJoinModal(false);
      setInputCode('');
      setPendingJoinCode(null);
    }
  }, [mode, roomCode, pendingJoinCode]);

  const CurrentIcon = modeIcons[mode];
  const currentConfig = modeConfig[mode];

  const handleSelectMode = (newMode: DiscoveryMode) => {
    if (newMode === 'private') {
      onChangeMode('private');
    } else {
      onChangeMode(newMode);
    }
    setShowMenu(false);
  };

  const handleJoinRoom = () => {
    if (inputCode.length === 5) {
      setPendingJoinCode(inputCode);
      onChangeMode('private', inputCode);
    }
  };

  const handleCopyCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = roomCode;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="mode-selector">
      <button 
        className="mode-current" 
        onClick={() => setShowMenu(!showMenu)}
        title={currentConfig.desc}
      >
        <span className="mode-icon">
          <CurrentIcon className="mode-svg-icon" />
        </span>
        <span className="mode-label">{currentConfig.label}</span>
        {mode === 'wifi' && networkName && (
          <span className="mode-network-name">{networkName}</span>
        )}
        {mode === 'private' && roomCode && (
          <span className="mode-room-code">{roomCode}</span>
        )}
        <span className="mode-arrow">{showMenu ? '▲' : '▼'}</span>
      </button>

      {showMenu && (
        <div className="mode-menu">
          {(Object.keys(modeConfig) as DiscoveryMode[]).map((m) => {
            const Icon = modeIcons[m];
            return (
              <button
                key={m}
                className={`mode-option ${mode === m ? 'active' : ''}`}
                onClick={() => handleSelectMode(m)}
              >
                <span className="mode-option-icon">
                  <Icon className="mode-svg-icon" />
                </span>
                <div className="mode-option-text">
                  <span className="mode-option-label">{modeConfig[m].label}</span>
                  <span className="mode-option-desc">{modeConfig[m].desc}</span>
                </div>
                {mode === m && <span className="mode-check"><CheckSmallIcon /></span>}
              </button>
            );
          })}

          <button 
            className="mode-join-room"
            onClick={() => {
              setShowMenu(false);
              setShowJoinModal(true);
            }}
          >
            <DoorOpenIcon className="mode-svg-icon" />
            <span>เข้าห้องด้วยรหัส</span>
          </button>
        </div>
      )}

      {showMenu && (
        <div className="mode-backdrop" onClick={() => setShowMenu(false)} />
      )}

      {mode === 'private' && roomCode && !showMenu && (
        <div className="mode-private-panel">
          <div className="mode-private-panel-header">
            <span className="mode-private-label">
              <LockIcon className="mode-svg-icon-sm" />
              ห้องส่วนตัว
            </span>
            <div className="mode-room-code-big">{roomCode}</div>
            <button className="mode-copy-btn-big" onClick={handleCopyCode}>
              {copied ? (
                <>
                  <CheckIcon className="mode-svg-icon-sm" />
                  คัดลอกแล้ว
                </>
              ) : (
                <>
                  <CopyIcon className="mode-svg-icon-sm" />
                  คัดลอกรหัส
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {showJoinModal && (
        <div className="mode-join-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="mode-join-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mode-join-header">
              <DoorOpenIcon className="mode-svg-icon" />
              <span>เข้าห้อง</span>
            </div>
            
            {joinError && (
              <div className="mode-join-error">{joinError}</div>
            )}
            
            <div className="mode-code-display">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className={`mode-code-digit ${inputCode[i] ? 'filled' : ''}`}>
                  {inputCode[i] || ''}
                </div>
              ))}
            </div>
            
            <div className="mode-numpad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  className="mode-numpad-btn"
                  onClick={() => inputCode.length < 5 && setInputCode(inputCode + num)}
                >
                  {num}
                </button>
              ))}
              <button
                className="mode-numpad-btn mode-numpad-clear"
                onClick={() => setInputCode('')}
              >
                C
              </button>
              <button
                className="mode-numpad-btn"
                onClick={() => inputCode.length < 5 && setInputCode(inputCode + '0')}
              >
                0
              </button>
              <button
                className="mode-numpad-btn mode-numpad-delete"
                onClick={() => setInputCode(inputCode.slice(0, -1))}
              >
                <BackspaceIcon />
              </button>
            </div>
            
            <div className="mode-join-actions">
              <button 
                className="mode-join-btn"
                onClick={handleJoinRoom}
                disabled={inputCode.length !== 5}
              >
                เข้าห้อง
              </button>
              <button 
                className="mode-cancel-btn"
                onClick={() => {
                  setShowJoinModal(false);
                  setInputCode('');
                  setPendingJoinCode(null);
                }}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

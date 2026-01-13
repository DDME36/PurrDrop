'use client';

import { useState } from 'react';

export type DiscoveryMode = 'public' | 'wifi' | 'private';

interface ModeSelectorProps {
  mode: DiscoveryMode;
  roomCode: string | null;
  onChangeMode: (mode: DiscoveryMode, roomCode?: string) => void;
}

const modeConfig = {
  public: { icon: '🌐', label: 'สาธารณะ', desc: 'เห็นทุกคน' },
  wifi: { icon: '📶', label: 'WiFi', desc: 'เฉพาะเครือข่ายเดียวกัน' },
  private: { icon: '🔐', label: 'ส่วนตัว', desc: 'เฉพาะรหัสห้อง' },
};

export function ModeSelector({ mode, roomCode, onChangeMode }: ModeSelectorProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);

  const currentMode = modeConfig[mode];

  const handleSelectMode = (newMode: DiscoveryMode) => {
    if (newMode === 'private') {
      // Create new room
      onChangeMode('private');
    } else {
      onChangeMode(newMode);
    }
    setShowMenu(false);
  };

  const handleJoinRoom = () => {
    if (inputCode.length === 5) {
      onChangeMode('private', inputCode);
      setShowJoinInput(false);
      setInputCode('');
      setShowMenu(false);
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
        title={currentMode.desc}
      >
        <span className="mode-icon">{currentMode.icon}</span>
        <span className="mode-label">{currentMode.label}</span>
        {mode === 'private' && roomCode && (
          <span className="mode-room-code">{roomCode}</span>
        )}
        <span className="mode-arrow">{showMenu ? '▲' : '▼'}</span>
      </button>

      {showMenu && (
        <div className="mode-menu">
          {/* Mode options */}
          {(Object.keys(modeConfig) as DiscoveryMode[]).map((m) => (
            <button
              key={m}
              className={`mode-option ${mode === m ? 'active' : ''}`}
              onClick={() => handleSelectMode(m)}
            >
              <span className="mode-option-icon">{modeConfig[m].icon}</span>
              <div className="mode-option-text">
                <span className="mode-option-label">{modeConfig[m].label}</span>
                <span className="mode-option-desc">{modeConfig[m].desc}</span>
              </div>
              {mode === m && <span className="mode-check">✓</span>}
            </button>
          ))}

          {/* Private mode extras */}
          {mode === 'private' && roomCode && (
            <div className="mode-private-info">
              <div className="mode-room-display">
                <span className="mode-room-label">รหัสห้อง:</span>
                <span className="mode-room-value">{roomCode}</span>
                <button className="mode-copy-btn" onClick={handleCopyCode}>
                  {copied ? '✓' : '📋'}
                </button>
              </div>
            </div>
          )}

          {/* Join room input */}
          {showJoinInput ? (
            <div className="mode-join-input">
              <input
                type="text"
                maxLength={5}
                placeholder="รหัส 5 หลัก"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                autoFocus
              />
              <button 
                className="mode-join-btn"
                onClick={handleJoinRoom}
                disabled={inputCode.length !== 5}
              >
                เข้า
              </button>
              <button 
                className="mode-cancel-btn"
                onClick={() => { setShowJoinInput(false); setInputCode(''); }}
              >
                ✕
              </button>
            </div>
          ) : (
            <button 
              className="mode-join-room"
              onClick={() => setShowJoinInput(true)}
            >
              🚪 เข้าห้องด้วยรหัส
            </button>
          )}
        </div>
      )}

      {/* Click outside to close */}
      {showMenu && (
        <div className="mode-backdrop" onClick={() => setShowMenu(false)} />
      )}
    </div>
  );
}

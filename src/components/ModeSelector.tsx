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

const modeConfig = {
  public: { icon: '🌐', label: 'สาธารณะ', desc: 'เห็นทุกคน' },
  wifi: { icon: '📶', label: 'WiFi', desc: 'เฉพาะเครือข่ายเดียวกัน' },
  private: { icon: '🔐', label: 'ส่วนตัว', desc: 'เฉพาะรหัสห้อง' },
};

export function ModeSelector({ mode, roomCode, networkName, roomError, onChangeMode }: ModeSelectorProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(null);

  // แสดง error จาก server
  useEffect(() => {
    if (roomError) {
      setJoinError(roomError);
      setTimeout(() => setJoinError(null), 3000);
    }
  }, [roomError]);

  // ปิด modal เมื่อเข้าห้องสำเร็จ
  useEffect(() => {
    if (mode === 'private' && roomCode && pendingJoinCode && roomCode === pendingJoinCode) {
      setShowJoinModal(false);
      setInputCode('');
      setPendingJoinCode(null);
    }
  }, [mode, roomCode, pendingJoinCode]);

  const currentMode = modeConfig[mode];

  const handleSelectMode = (newMode: DiscoveryMode) => {
    if (newMode === 'private') {
      // สร้างห้องใหม่ทันที (ไม่มีรหัสผ่าน)
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
      {/* Current mode button */}
      <button 
        className="mode-current" 
        onClick={() => setShowMenu(!showMenu)}
        title={currentMode.desc}
      >
        <span className="mode-icon">{currentMode.icon}</span>
        <span className="mode-label">{currentMode.label}</span>
        {mode === 'wifi' && networkName && (
          <span className="mode-network-name">{networkName}</span>
        )}
        {mode === 'private' && roomCode && (
          <span className="mode-room-code">{roomCode}</span>
        )}
        <span className="mode-arrow">{showMenu ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown menu */}
      {showMenu && (
        <div className="mode-menu">
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

          {/* เข้าห้องด้วยรหัส */}
          <button 
            className="mode-join-room"
            onClick={() => {
              setShowMenu(false);
              setShowJoinModal(true);
            }}
          >
            🚪 เข้าห้องด้วยรหัส
          </button>
        </div>
      )}

      {/* Backdrop for dropdown */}
      {showMenu && (
        <div className="mode-backdrop" onClick={() => setShowMenu(false)} />
      )}

      {/* Private mode panel */}
      {mode === 'private' && roomCode && !showMenu && (
        <div className="mode-private-panel">
          <div className="mode-private-panel-header">
            <span>🔐 ห้องส่วนตัว</span>
            <div className="mode-room-code-big">{roomCode}</div>
            <button className="mode-copy-btn-big" onClick={handleCopyCode}>
              {copied ? '✓ คัดลอกแล้ว' : '📋 คัดลอกรหัส'}
            </button>
          </div>
        </div>
      )}

      {/* Join room modal */}
      {showJoinModal && (
        <div className="mode-join-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="mode-join-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mode-join-header">🚪 เข้าห้อง</div>
            
            {joinError && (
              <div className="mode-join-error">❌ {joinError}</div>
            )}
            
            {/* Code display */}
            <div className="mode-code-display">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className={`mode-code-digit ${inputCode[i] ? 'filled' : ''}`}>
                  {inputCode[i] || ''}
                </div>
              ))}
            </div>
            
            {/* Numpad */}
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
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 5a2 2 0 0 0-1.344.519l-6.328 5.74a1 1 0 0 0 0 1.481l6.328 5.741A2 2 0 0 0 10 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z"/>
                  <path d="m12 9 6 6"/>
                  <path d="m18 9-6 6"/>
                </svg>
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

'use client';

import { useState } from 'react';

export type DiscoveryMode = 'public' | 'wifi' | 'private';

interface ModeSelectorProps {
  mode: DiscoveryMode;
  roomCode: string | null;
  roomPassword: string | null;
  networkName: string | null;
  onChangeMode: (mode: DiscoveryMode, roomCode?: string, password?: string) => void;
}

const modeConfig = {
  public: { icon: '🌐', label: 'สาธารณะ', desc: 'เห็นทุกคน' },
  wifi: { icon: '📶', label: 'WiFi', desc: 'เฉพาะเครือข่ายเดียวกัน' },
  private: { icon: '🔐', label: 'ส่วนตัว', desc: 'เฉพาะรหัสห้อง' },
};

export function ModeSelector({ mode, roomCode, roomPassword, networkName, onChangeMode }: ModeSelectorProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [newRoomPassword, setNewRoomPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const currentMode = modeConfig[mode];

  const handleSelectMode = (newMode: DiscoveryMode) => {
    if (newMode === 'private') {
      // Show create room options
      setShowCreateRoom(true);
    } else {
      onChangeMode(newMode);
      setShowMenu(false);
    }
  };

  const handleCreateRoom = () => {
    // Create room with optional password
    onChangeMode('private', undefined, newRoomPassword || undefined);
    setShowCreateRoom(false);
    setNewRoomPassword('');
    setShowMenu(false);
  };

  const handleJoinRoom = () => {
    if (inputCode.length === 5) {
      onChangeMode('private', inputCode, inputPassword || undefined);
      setShowJoinInput(false);
      setInputCode('');
      setInputPassword('');
      setShowMenu(false);
    }
  };

  const handleCopyCode = async () => {
    if (!roomCode) return;
    // Copy code + password if exists
    const textToCopy = roomPassword 
      ? `รหัสห้อง: ${roomCode}\nรหัสผ่าน: ${roomPassword}`
      : roomCode;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = textToCopy;
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
        {mode === 'wifi' && networkName && (
          <span className="mode-network-name">{networkName}</span>
        )}
        {mode === 'private' && roomCode && (
          <>
            <span className="mode-room-code">{roomCode}</span>
            {roomPassword && <span className="mode-lock">🔑</span>}
          </>
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

          {/* Create room with password */}
          {showCreateRoom && (
            <div className="mode-create-room">
              <div className="mode-create-header">✨ สร้างห้องใหม่</div>
              <div className="mode-password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="รหัสผ่าน (ไม่บังคับ)"
                  value={newRoomPassword}
                  onChange={(e) => setNewRoomPassword(e.target.value)}
                  maxLength={20}
                />
                <button 
                  className="mode-show-pwd"
                  onClick={() => setShowPassword(!showPassword)}
                  type="button"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              <div className="mode-create-actions">
                <button className="mode-create-btn" onClick={handleCreateRoom}>
                  สร้างห้อง
                </button>
                <button 
                  className="mode-cancel-btn"
                  onClick={() => { setShowCreateRoom(false); setNewRoomPassword(''); }}
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          )}

          {/* Private mode extras */}
          {mode === 'private' && roomCode && !showCreateRoom && (
            <div className="mode-private-info">
              <div className="mode-room-display">
                <span className="mode-room-label">รหัสห้อง:</span>
                <span className="mode-room-value">{roomCode}</span>
                <button className="mode-copy-btn" onClick={handleCopyCode} title="คัดลอก">
                  {copied ? '✓' : '📋'}
                </button>
              </div>
              {roomPassword && (
                <div className="mode-room-display">
                  <span className="mode-room-label">รหัสผ่าน:</span>
                  <span className="mode-room-value mode-password">
                    {showPassword ? roomPassword : '••••••'}
                  </span>
                  <button 
                    className="mode-show-pwd-small"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              )}
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
                onKeyDown={(e) => e.key === 'Enter' && inputCode.length === 5 && handleJoinRoom()}
                autoFocus
              />
              <input
                type="password"
                placeholder="รหัสผ่าน (ถ้ามี)"
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && inputCode.length === 5 && handleJoinRoom()}
              />
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
                  onClick={() => { setShowJoinInput(false); setInputCode(''); setInputPassword(''); }}
                >
                  ✕
                </button>
              </div>
            </div>
          ) : !showCreateRoom && (
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
        <div className="mode-backdrop" onClick={() => {
          setShowMenu(false);
          setShowCreateRoom(false);
          setShowJoinInput(false);
        }} />
      )}
    </div>
  );
}

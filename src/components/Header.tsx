'use client';

interface HeaderProps {
  muted: boolean;
  isDark: boolean;
  hasPeers: boolean;
  isInstallable?: boolean;
  onInstall?: () => void;
  onToggleMute: () => void;
  onToggleTheme: () => void;
  onShowHistory: () => void;
  onShowQR: () => void;
}

export function Header({ muted, isDark, hasPeers, isInstallable, onInstall, onToggleMute, onToggleTheme, onShowHistory, onShowQR }: HeaderProps) {
  return (
    <header className="header">
      <div className="logo">
        <div className="logo-wrapper">
          <span className="logo-purr">
            <span className="char-p">P</span>urr
          </span>
          <span className="logo-drop">Drop</span>
          <div className="logo-dot"></div>
        </div>
      </div>
      <div className="header-actions">
        {isInstallable && onInstall && (
          <button
            className="btn-icon-header install-btn"
            onClick={onInstall}
            title="ติดตั้งแอป"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span className="install-text">ติดตั้ง</span>
          </button>
        )}
        {hasPeers && (
          <button
            className="btn-icon-header"
            onClick={onShowQR}
            title="QR Code"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
              <rect x="14" y="14" width="3" height="3"></rect>
              <rect x="18" y="14" width="3" height="3"></rect>
              <rect x="14" y="18" width="3" height="3"></rect>
              <rect x="18" y="18" width="3" height="3"></rect>
            </svg>
          </button>
        )}
        <button
          className="btn-icon-header"
          onClick={onShowHistory}
          title="ประวัติ"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </button>
        <button
          className="btn-icon-header"
          onClick={onToggleTheme}
          title={isDark ? 'โหมดสว่าง' : 'โหมดมืด'}
        >
          {isDark ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          )}
        </button>
        <button
          className={`btn-icon-header ${muted ? 'muted' : ''}`}
          onClick={onToggleMute}
          title="เสียง"
        >
          {muted ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <line x1="23" y1="9" x2="17" y2="15"></line>
              <line x1="17" y1="9" x2="23" y2="15"></line>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}

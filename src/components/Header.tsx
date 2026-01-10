'use client';

interface HeaderProps {
  muted: boolean;
  onToggleMute: () => void;
}

export function Header({ muted, onToggleMute }: HeaderProps) {
  return (
    <header className="header">
      <div className="logo-badge">
        <span className="logo-icon">🐱</span>
        <span className="logo-text">PurrDrop</span>
        <span className="logo-sparkle">✨</span>
      </div>
      <div className="header-actions">
        <button 
          className={`btn-icon-header ${muted ? 'muted' : ''}`}
          onClick={onToggleMute}
          title="เสียง"
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    </header>
  );
}

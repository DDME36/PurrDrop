'use client';

interface FooterProps {
  onFeedback: () => void;
}

export function Footer({ onFeedback }: FooterProps) {
  return (
    <div className="app-footer">
      <button className="feedback-badge" onClick={onFeedback}>
        💬 Feedback
      </button>
      <div className="credit">
        by ddme36 (Dome)
      </div>
    </div>
  );
}

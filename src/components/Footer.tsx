'use client';

interface FooterProps {
  onFeedback: () => void;
  hasPeers: boolean;
}

export function Footer({ onFeedback, hasPeers }: FooterProps) {
  return (
    <div className={`app-footer ${hasPeers ? 'has-peers' : 'no-peers'}`}>
      <button className="feedback-btn" onClick={onFeedback}>
        💬 Feedback
      </button>
      <div className="footer-credit">by ddme36 (Dome)</div>
    </div>
  );
}

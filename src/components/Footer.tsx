'use client';

// Lucide Icon
const MessageCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>
  </svg>
);

export function Footer({ hasPeers }: { hasPeers: boolean }) {
  return (
    <div className={`app-footer ${hasPeers ? 'has-peers' : 'no-peers'}`}>
      <div className="footer-credit">by ddme36 (Dome)</div>
    </div>
  );
}

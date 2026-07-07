'use client';



export function Footer({ hasPeers }: { hasPeers: boolean }) {
  return (
    <div className={`app-footer ${hasPeers ? 'has-peers' : 'no-peers'}`}>
      <div className="footer-credit">by ddme36 (Dome)</div>
    </div>
  );
}

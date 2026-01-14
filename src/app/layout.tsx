import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PurrDrop - Send Files with Love',
  description: 'ส่งไฟล์ง่ายๆ ระหว่างอุปกรณ์ในเครือข่ายเดียวกัน',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PurrDrop',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#ffb3d1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Inline script to prevent FOUC (Flash of Unstyled Content)
  // This runs before React hydration, so theme is applied immediately
  const themeScript = `
    (function() {
      try {
        var theme = localStorage.getItem('purrdrop_theme');
        var resolved = theme;
        if (!theme || theme === 'system') {
          resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        document.documentElement.setAttribute('data-theme', resolved);
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', resolved === 'dark' ? '#1a1a2e' : '#ffb3d1');
      } catch (e) {}
    })();
  `;

  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&family=Mitr:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>{children}</body>
    </html>
  );
}

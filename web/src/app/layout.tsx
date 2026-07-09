import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { PWARegister } from './pwa-register';

export const metadata: Metadata = {
  title: 'NoteForge',
  description: '全平台智能笔记系统',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'NoteForge',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>{children}</Providers>
        <PWARegister />
      </body>
    </html>
  );
}

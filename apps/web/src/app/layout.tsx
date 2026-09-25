import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from '@/providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Primsett — Your personal booking assistant',
  description: 'Book appointments with Nigerian beauty pros. Nail techs, lash techs, makeup artists & more.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#e84393',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

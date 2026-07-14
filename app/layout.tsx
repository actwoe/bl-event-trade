import type { Metadata } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/shared/SiteHeader';

export const metadata: Metadata = {
  title: '팝업 & 콜카 굿즈 교환판',
  description: 'Popup & Callabo Cafe Trade Board',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-neutral-100 text-neutral-950 antialiased">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import Script from 'next/script';
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
        <Script id="detect-app-display-mode" strategy="beforeInteractive">
          {`
            (() => {
              const isStandalone =
                window.matchMedia('(display-mode: standalone)').matches ||
                window.navigator.standalone === true;

              document.documentElement.dataset.appDisplayMode = isStandalone
                ? 'standalone'
                : 'browser';
            })();
          `}
        </Script>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}

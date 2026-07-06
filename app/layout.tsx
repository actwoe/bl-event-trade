import type { Metadata } from 'next';
import { SiteHeader } from '@/components/shared/SiteHeader';
import './globals.css';

export const metadata: Metadata = {
  title: '굿즈 교환판 생성기',
  description: '굿즈 교환판 이미지를 만들고 카드 이미지를 제보하는 사이트',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
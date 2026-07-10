import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAllowedImageUrl(value: string) {
  try {
    const url = new URL(value);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (url.protocol !== 'https:') return false;
    if (!supabaseUrl) return true;

    return url.origin === new URL(supabaseUrl).origin;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const imageUrl = request.nextUrl.searchParams.get('url');

  if (!imageUrl || !isAllowedImageUrl(imageUrl)) {
    return NextResponse.json({ message: 'Invalid image URL' }, { status: 400 });
  }

  try {
    const response = await fetch(imageUrl, {
      cache: 'no-store',
      redirect: 'follow',
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { message: 'Image request failed' },
        { status: response.status },
      );
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('이미지 프록시 요청에 실패했습니다.', error);
    return NextResponse.json({ message: 'Image proxy failed' }, { status: 502 });
  }
}

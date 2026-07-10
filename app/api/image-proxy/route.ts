import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 86_400;

function isAllowedImageUrl(url: URL) {
  if (url.protocol !== "https:") return false;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      if (url.hostname === new URL(supabaseUrl).hostname) return true;
    } catch {
      // 환경변수가 잘못되어도 일반 Supabase 호스트 검사를 계속합니다.
    }
  }

  return (
    url.hostname.endsWith(".supabase.co") ||
    url.hostname.endsWith(".supabase.in")
  );
}

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("url");

  if (!source) {
    return NextResponse.json({ error: "Missing image URL" }, { status: 400 });
  }

  let imageUrl: URL;
  try {
    imageUrl = new URL(source);
  } catch {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
  }

  if (!isAllowedImageUrl(imageUrl)) {
    return NextResponse.json({ error: "Image host is not allowed" }, { status: 403 });
  }

  try {
    const response = await fetch(imageUrl, {
      cache: "force-cache",
      next: { revalidate: 86_400 },
      headers: { Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8" },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Image request failed" },
        { status: response.status },
      );
    }

    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Invalid image response" }, { status: 415 });
    }

    return new NextResponse(await response.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Image proxy failed", error);
    return NextResponse.json({ error: "Image proxy failed" }, { status: 502 });
  }
}

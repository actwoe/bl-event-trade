import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const BROWSER_CACHE_SECONDS = 86_400;
const CDN_CACHE_SECONDS = 604_800;
const STALE_CACHE_SECONDS = 2_592_000;

function getAllowedSupabaseHost() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) return null;

  try {
    return new URL(supabaseUrl).host;
  } catch {
    return null;
  }
}

function isAllowedStorageImageUrl(sourceUrl: URL) {
  const allowedHost = getAllowedSupabaseHost();

  if (
    sourceUrl.protocol !== "https:" ||
    !allowedHost ||
    sourceUrl.host !== allowedHost
  ) {
    return false;
  }

  return (
    sourceUrl.pathname.startsWith("/storage/v1/object/public/") ||
    sourceUrl.pathname.startsWith("/storage/v1/render/image/public/")
  );
}

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("url");

  if (!source) {
    return NextResponse.json({ error: "Missing image URL" }, { status: 400 });
  }

  let sourceUrl: URL;

  try {
    sourceUrl = new URL(source);
  } catch {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
  }

  if (!isAllowedStorageImageUrl(sourceUrl)) {
    return NextResponse.json({ error: "Image URL is not allowed" }, { status: 403 });
  }

  try {
    const imageResponse = await fetch(sourceUrl, {
      cache: "force-cache",
      next: { revalidate: BROWSER_CACHE_SECONDS },
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });

    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch image" },
        { status: imageResponse.status },
      );
    }

    const contentType = imageResponse.headers.get("content-type");

    if (!contentType?.startsWith("image/")) {
      return NextResponse.json(
        { error: "Requested resource is not an image" },
        { status: 415 },
      );
    }

    return new NextResponse(imageResponse.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": `public, max-age=${BROWSER_CACHE_SECONDS}, s-maxage=${CDN_CACHE_SECONDS}, stale-while-revalidate=${STALE_CACHE_SECONDS}`,
        "Access-Control-Allow-Origin": "*",
        "X-Content-Type-Options": "nosniff",
        Vary: "Accept",
      },
    });
  } catch (error) {
    console.error("Image proxy request failed", error);
    return NextResponse.json({ error: "Image proxy failed" }, { status: 502 });
  }
}

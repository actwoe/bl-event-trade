export const GOODS_WATERMARK_TEXT = "BL EVENT TRADE";
export const GOODS_WATERMARK_TILE_WIDTH = 180;
export const GOODS_WATERMARK_TILE_HEIGHT = 120;
export const GOODS_WATERMARK_ANGLE_DEG = -32;
export const GOODS_WATERMARK_FONT_SIZE = 18;
export const GOODS_WATERMARK_FILL = "rgba(38, 38, 38, 0.18)";

function encodeSvg(svg: string) {
  return encodeURIComponent(svg)
    .replace(/%0A/g, "")
    .replace(/%20/g, " ");
}

export function createGoodsWatermarkDataUrl() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${GOODS_WATERMARK_TILE_WIDTH}" height="${GOODS_WATERMARK_TILE_HEIGHT}" viewBox="0 0 ${GOODS_WATERMARK_TILE_WIDTH} ${GOODS_WATERMARK_TILE_HEIGHT}">
      <g transform="rotate(${GOODS_WATERMARK_ANGLE_DEG} ${GOODS_WATERMARK_TILE_WIDTH / 2} ${GOODS_WATERMARK_TILE_HEIGHT / 2})">
        <text x="8" y="44" fill="${GOODS_WATERMARK_FILL}" font-family="Arial, sans-serif" font-size="${GOODS_WATERMARK_FONT_SIZE}" font-weight="700">${GOODS_WATERMARK_TEXT}</text>
        <text x="54" y="94" fill="${GOODS_WATERMARK_FILL}" font-family="Arial, sans-serif" font-size="${GOODS_WATERMARK_FONT_SIZE}" font-weight="700">${GOODS_WATERMARK_TEXT}</text>
      </g>
    </svg>
  `;

  return `url("data:image/svg+xml,${encodeSvg(svg)}")`;
}

export function getGoodsWatermarkOverlayStyle() {
  return {
    backgroundImage: createGoodsWatermarkDataUrl(),
    backgroundRepeat: "repeat",
    backgroundSize: `${GOODS_WATERMARK_TILE_WIDTH}px ${GOODS_WATERMARK_TILE_HEIGHT}px`,
    backgroundPosition: "center",
  } as const;
}

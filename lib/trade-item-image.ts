import { getTradeAssetUrl } from '@/lib/supabase';
import type { TradeImageRatio } from '@/lib/trade-types';

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function createTextOnlyTradeItemImageUrl(
  _itemName?: string | null,
  imageRatio: TradeImageRatio = 'square',
) {
  const isPhotocard = imageRatio === 'photocard';
  const width = isPhotocard ? 550 : 600;
  const height = isPhotocard ? 850 : 600;
  const primaryLines = ['아직 실물 이미지가', '등록되지 않았습니다.'];
  const secondaryLines = ['직접 촬영한 이미지를', '업로드 해주세요.'];
  const primaryStartY = height / 2 - (isPhotocard ? 86 : 74);
  const secondaryStartY = height / 2 + (isPhotocard ? 72 : 64);

  const primaryText = primaryLines
    .map(
      (line, index) =>
        `<text x="50%" y="${primaryStartY + index * (isPhotocard ? 58 : 52)}" text-anchor="middle" dominant-baseline="middle" font-family="Arial, Apple SD Gothic Neo, sans-serif" font-size="${isPhotocard ? 34 : 36}" font-weight="800" fill="#404040">${escapeXml(line)}</text>`,
    )
    .join('');
  const secondaryText = secondaryLines
    .map(
      (line, index) =>
        `<text x="50%" y="${secondaryStartY + index * (isPhotocard ? 42 : 38)}" text-anchor="middle" dominant-baseline="middle" font-family="Arial, Apple SD Gothic Neo, sans-serif" font-size="${isPhotocard ? 24 : 25}" font-weight="700" fill="#737373">${escapeXml(line)}</text>`,
    )
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" rx="36" fill="#f5f5f5"/><rect x="18" y="18" width="${width - 36}" height="${height - 36}" rx="28" fill="none" stroke="#d4d4d4" stroke-width="3" stroke-dasharray="10 10"/>${primaryText}${secondaryText}<text x="50%" y="${height - 42}" text-anchor="middle" font-family="Arial, Apple SD Gothic Neo, sans-serif" font-size="18" font-weight="700" fill="#a3a3a3">IMAGE TO BE UPDATED</text></svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function getTradeItemImageUrl(
  imagePath?: string | null,
  itemName?: string | null,
  imageRatio: TradeImageRatio = 'square',
) {
  const normalizedPath = imagePath?.trim() ?? '';
  return normalizedPath
    ? getTradeAssetUrl(normalizedPath)
    : createTextOnlyTradeItemImageUrl(itemName, imageRatio);
}

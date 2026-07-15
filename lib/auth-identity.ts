export const ADMIN_LOGIN_ID = 'admin';

const AUTH_EMAIL_DOMAIN = 'goods-trade.local';
const LOGIN_ID_PATTERN = /^[a-z0-9_]{4,20}$/;

export function normalizeLoginId(value: string) {
  return value.trim().toLowerCase();
}

export function isValidLoginId(value: string) {
  return LOGIN_ID_PATTERN.test(normalizeLoginId(value));
}

export function getAuthEmailFromLoginId(value: string) {
  const normalizedLoginId = normalizeLoginId(value);
  return `${normalizedLoginId}@${AUTH_EMAIL_DOMAIN}`;
}

import { Response, CookieOptions } from 'express';

export const ACCESS_COOKIE = 'sf_access';
export const REFRESH_COOKIE = 'sf_refresh';

const isProd = process.env.NODE_ENV === 'production';

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd, // requires HTTPS in production; localhost dev stays http
  sameSite: 'lax',
  path: '/',
};

// Refresh cookie is scoped to /api/v1/auth only -- it has no reason to be
// sent on every API request, which shrinks its exposure surface.
const REFRESH_COOKIE_PATH = '/api/v1/auth';

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie(ACCESS_COOKIE, accessToken, { ...baseCookieOptions, maxAge: 15 * 60 * 1000 });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookieOptions,
    path: REFRESH_COOKIE_PATH,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, baseCookieOptions);
  res.clearCookie(REFRESH_COOKIE, { ...baseCookieOptions, path: REFRESH_COOKIE_PATH });
}

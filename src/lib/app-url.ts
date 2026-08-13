const DEFAULT_PUBLIC_APP_URL = "https://madarasapro-mocha.vercel.app";

/**
 * Stable public origin for shareable links (parent portal, WhatsApp/SMS).
 * Prefer NEXT_PUBLIC_APP_URL; never fall back to localhost for invite URLs.
 */
export function getPublicAppUrl() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_PUBLIC_APP_URL;
  return raw.replace(/\/$/, "");
}

/** Join a path onto the public app origin without double slashes. */
export function publicAppPath(path: string) {
  const base = getPublicAppUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

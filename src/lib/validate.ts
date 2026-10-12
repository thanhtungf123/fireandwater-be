import { AllowedIframeDomain } from "../models/AllowedIframeDomain";

/**
 * Built-in hosts that are always allowed. These are the vetted baseline;
 * additional hosts are managed at runtime by the admin via the
 * AllowedIframeDomain collection (no code change needed) — see the
 * "Nguồn game" admin page.
 */
export const BASELINE_ALLOWED_HOSTS = [
  "html5.gamedistribution.com",
  "gamedistribution.com",
  "www.gameflare.com",
  "gameflare.com",
  "html5.gamemonetize.co",
  "html5.gamemonetize.com",
];

/**
 * Normalize admin input into a bare lowercase hostname, or null if invalid.
 * Accepts either a full URL (https://html5.gamemonetize.co/xxx/) — the hostname
 * is extracted — or a bare host (html5.gamemonetize.co). A bare host must have
 * at least one dot and a valid TLD so we never whitelist something like "com".
 */
export function normalizeIframeDomain(input: string): string | null {
  let raw = String(input ?? "").trim().toLowerCase();
  if (!raw) return null;

  // Looks like a URL -> take its hostname.
  if (/^[a-z][a-z0-9+.-]*:\/\//.test(raw)) {
    try {
      return new URL(raw).hostname || null;
    } catch {
      return null;
    }
  }

  // Bare host: drop any accidental path/port/query and a trailing dot.
  raw = raw.split("/")[0].split(":")[0].split("?")[0].replace(/\.$/, "");
  const HOST_RE =
    /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
  return HOST_RE.test(raw) ? raw : null;
}

/** Normalize to a URL-safe slug: lowercase, no diacritics, hyphen-separated. */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Whether an iframe src is https and on an allowed host (baseline + DB). */
export async function isAllowedIframeUrl(url: string): Promise<boolean> {
  let host: string;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    host = u.hostname.toLowerCase();
  } catch {
    return false;
  }
  if (BASELINE_ALLOWED_HOSTS.includes(host)) return true;
  const extra = await AllowedIframeDomain.find().select("domain").lean();
  return extra.some((d) => d.domain.toLowerCase() === host);
}

import { AllowedIframeDomain } from "../models/AllowedIframeDomain";

const BASELINE_ALLOWED_HOSTS = [
  "html5.gamedistribution.com",
  "gamedistribution.com",
];

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

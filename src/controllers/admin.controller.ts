import type { Response } from "express";
import { Game } from "../models/Game";
import { SiteSetting } from "../models/SiteSetting";
import { StaticPage } from "../models/StaticPage";
import { Redirect } from "../models/Redirect";
import { User } from "../models/User";
import {
  verifyPassword,
  signToken,
  type AuthedRequest,
} from "../lib/auth";
import {
  slugify,
  isAllowedIframeUrl,
  BASELINE_ALLOWED_HOSTS,
  normalizeIframeDomain,
} from "../lib/validate";
import { AllowedIframeDomain } from "../models/AllowedIframeDomain";
import { uploadBuffer, cloudinaryConfigured } from "../lib/cloudinary";

// ---------------- Auth ----------------

export async function login(req: AuthedRequest, res: Response) {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json({ error: "missing_credentials" });
  }
  const user = await User.findOne({ username: String(username).toLowerCase() });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ error: "invalid_credentials" });
  }
  const token = signToken({
    sub: String(user._id),
    username: user.username,
    role: user.role,
  });
  res.json({ token, user: { username: user.username, role: user.role } });
}

export async function me(req: AuthedRequest, res: Response) {
  res.json({ user: req.user });
}

// ---------------- Games ----------------

export async function listGames(req: AuthedRequest, res: Response) {
  const { group, status, q } = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (group) filter.group = group;
  if (status) filter.status = status;
  if (q) filter.name = { $regex: q, $options: "i" };
  const games = await Game.find(filter).sort({ order: 1, createdAt: 1 }).lean();
  res.json(games);
}

export async function getGame(req: AuthedRequest, res: Response) {
  const game = await Game.findById(req.params.id).lean();
  if (!game) return res.status(404).json({ error: "not_found" });
  res.json(game);
}

async function validateGameInput(
  body: Record<string, unknown>,
  currentId?: string
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const name = String(body.name ?? "").trim();
  const iframeUrl = String(body.iframeUrl ?? "").trim();
  if (!name) return { ok: false, error: "name_required" };
  if (!iframeUrl) return { ok: false, error: "iframe_required" };
  if (!(await isAllowedIframeUrl(iframeUrl))) {
    return { ok: false, error: "iframe_domain_not_allowed" };
  }
  const slug = slugify(String(body.slug ?? "") || name);
  if (!slug) return { ok: false, error: "slug_invalid" };
  const clash = await Game.findOne({ slug });
  if (clash && String(clash._id) !== currentId) {
    return { ok: false, error: "slug_taken" };
  }
  return { ok: true, slug };
}

export async function createGame(req: AuthedRequest, res: Response) {
  const v = await validateGameInput(req.body);
  if (!v.ok) return res.status(400).json({ error: v.error });

  const b = req.body;
  const game = await Game.create({
    name: String(b.name).trim(),
    slug: v.slug,
    thumbnail: b.thumbnail || undefined,
    iframeUrl: String(b.iframeUrl).trim(),
    frameWidth: b.frameWidth || 900,
    frameHeight: b.frameHeight || 510,
    group: b.group === "tuong-tu" ? "tuong-tu" : "lua-va-nuoc",
    order: typeof b.order === "number" ? b.order : 0,
    status: ["draft", "published", "hidden"].includes(b.status)
      ? b.status
      : "draft",
    seoContentHtml: b.seoContentHtml || undefined,
    seo: b.seo || undefined,
    related: b.related || { mode: "auto", limit: 8, gameIds: [] },
  });
  res.status(201).json(game);
}

export async function updateGame(req: AuthedRequest, res: Response) {
  const id = req.params.id;
  const existing = await Game.findById(id);
  if (!existing) return res.status(404).json({ error: "not_found" });

  const v = await validateGameInput(req.body, id);
  if (!v.ok) return res.status(400).json({ error: v.error });

  const b = req.body;
  const oldSlug = existing.slug;

  existing.name = String(b.name).trim();
  existing.slug = v.slug;
  existing.thumbnail = b.thumbnail || undefined;
  existing.iframeUrl = String(b.iframeUrl).trim();
  existing.frameWidth = b.frameWidth || 900;
  existing.frameHeight = b.frameHeight || 510;
  existing.group = b.group === "tuong-tu" ? "tuong-tu" : "lua-va-nuoc";
  if (typeof b.order === "number") existing.order = b.order;
  if (["draft", "published", "hidden"].includes(b.status)) existing.status = b.status;
  existing.seoContentHtml = b.seoContentHtml || undefined;
  existing.seo = b.seo || undefined;
  if (b.related) existing.related = b.related;

  await existing.save();

  // Slug changed -> record a 301 so the old URL keeps working (spec §2).
  if (oldSlug !== v.slug) {
    await Redirect.deleteOne({ from: v.slug }); // avoid redirect loop
    await Redirect.findOneAndUpdate(
      { from: oldSlug },
      { $set: { from: oldSlug, to: v.slug } },
      { upsert: true }
    );
  }

  res.json(existing);
}

export async function deleteGame(req: AuthedRequest, res: Response) {
  const deleted = await Game.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true });
}

export async function reorderGames(req: AuthedRequest, res: Response) {
  const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
  await Promise.all(
    ids.map((id, index) => Game.updateOne({ _id: id }, { $set: { order: index } }))
  );
  res.json({ ok: true });
}

// ---------------- Site settings ----------------

export async function getSettings(_req: AuthedRequest, res: Response) {
  const setting = await SiteSetting.findOne({ key: "default" }).lean();
  res.json(setting ?? {});
}

export async function updateSettings(req: AuthedRequest, res: Response) {
  const b = req.body ?? {};
  const update: Record<string, unknown> = {};
  for (const key of [
    "homeDefaultGameId",
    "homeH1",
    "homeSeoContentHtml",
    "homeMainGameIds",
    "homeRelated",
    "seoTitle",
    "seoDescription",
    "ogImage",
    "headerTitle",
    "logoUrl",
    "faviconUrl",
    "footerText",
    "footerLinks",
    "headerLinks",
  ]) {
    if (key in b) update[key] = b[key];
  }
  const setting = await SiteSetting.findOneAndUpdate(
    { key: "default" },
    { $set: update },
    { upsert: true, returnDocument: "after" }
  );
  res.json(setting);
}

// ---------------- Static pages ----------------

const RESERVED_SLUGS = new Set([
  "admin", "api", "tro-choi", "danh-muc", "game", "sitemap.xml", "robots.txt", "",
]);

/** Fields an admin may set on a page (shared by create/update). */
function pageFieldsFrom(b: Record<string, unknown>) {
  return {
    title: String(b.title ?? "").trim(),
    headerLabel: b.headerLabel ? String(b.headerLabel).trim() : undefined,
    showInHeader: Boolean(b.showInHeader),
    headerOrder: typeof b.headerOrder === "number" ? b.headerOrder : 0,
    contentHtml: b.contentHtml ? String(b.contentHtml) : undefined,
    seo: (b.seo as Record<string, unknown> | undefined) || undefined,
    status: (["published", "hidden"].includes(b.status as string)
      ? (b.status as string)
      : "published") as "published" | "hidden",
  };
}

export async function listPages(_req: AuthedRequest, res: Response) {
  const pages = await StaticPage.find()
    .sort({ headerOrder: 1, slug: 1 })
    .lean();
  res.json(pages);
}

export async function getPage(req: AuthedRequest, res: Response) {
  const page = await StaticPage.findOne({ slug: req.params.slug }).lean();
  if (!page) return res.status(404).json({ error: "not_found" });
  res.json(page);
}

export async function createPage(req: AuthedRequest, res: Response) {
  const b = req.body ?? {};
  const slug = slugify(String(b.slug ?? "") || String(b.title ?? ""));
  if (!slug || RESERVED_SLUGS.has(slug)) {
    return res.status(400).json({ error: "slug_invalid" });
  }
  if (!String(b.title ?? "").trim()) {
    return res.status(400).json({ error: "title_required" });
  }
  // Slug must be unique across pages AND games (both are level-1 URLs).
  if (await StaticPage.findOne({ slug })) {
    return res.status(400).json({ error: "slug_taken" });
  }
  if (await Game.findOne({ slug })) {
    return res.status(400).json({ error: "slug_taken_by_game" });
  }
  const page = await StaticPage.create({ slug, ...pageFieldsFrom(b) });
  res.status(201).json(page);
}

export async function updatePage(req: AuthedRequest, res: Response) {
  const b = req.body ?? {};
  const oldSlug = req.params.slug;
  const existing = await StaticPage.findOne({ slug: oldSlug });

  // Optional slug change on update (records a 301).
  let newSlug = oldSlug;
  if (b.slug && slugify(String(b.slug)) !== oldSlug) {
    newSlug = slugify(String(b.slug));
    if (!newSlug || RESERVED_SLUGS.has(newSlug)) {
      return res.status(400).json({ error: "slug_invalid" });
    }
    if (await StaticPage.findOne({ slug: newSlug })) {
      return res.status(400).json({ error: "slug_taken" });
    }
    if (await Game.findOne({ slug: newSlug })) {
      return res.status(400).json({ error: "slug_taken_by_game" });
    }
  }

  const page = await StaticPage.findOneAndUpdate(
    { slug: oldSlug },
    { $set: { slug: newSlug, ...pageFieldsFrom(b) } },
    { upsert: true, returnDocument: "after" }
  );

  if (existing && newSlug !== oldSlug) {
    await Redirect.deleteOne({ from: newSlug });
    await Redirect.findOneAndUpdate(
      { from: oldSlug },
      { $set: { from: oldSlug, to: newSlug } },
      { upsert: true }
    );
  }

  res.json(page);
}

export async function deletePage(req: AuthedRequest, res: Response) {
  const deleted = await StaticPage.findOneAndDelete({ slug: req.params.slug });
  if (!deleted) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true });
}

export async function reorderPages(req: AuthedRequest, res: Response) {
  const slugs: string[] = Array.isArray(req.body?.slugs) ? req.body.slugs : [];
  await Promise.all(
    slugs.map((slug, i) =>
      StaticPage.updateOne({ slug }, { $set: { headerOrder: i } })
    )
  );
  res.json({ ok: true });
}

// ---------------- Iframe domain whitelist ----------------

/**
 * Lists the embed hosts an iframe URL may use: the built-in `baseline`
 * (locked, defined in code) and the admin-managed `custom` hosts (stored in
 * DB, deletable). Custom hosts that duplicate a baseline one are hidden so a
 * host never appears twice.
 */
export async function listIframeDomains(_req: AuthedRequest, res: Response) {
  const rows = await AllowedIframeDomain.find().sort({ domain: 1 }).lean();
  const baseline = new Set(BASELINE_ALLOWED_HOSTS.map((d) => d.toLowerCase()));
  res.json({
    baseline: BASELINE_ALLOWED_HOSTS,
    custom: rows
      .filter((d) => !baseline.has(d.domain.toLowerCase()))
      .map((d) => ({
        _id: String(d._id),
        domain: d.domain,
        createdAt: d.createdAt,
      })),
  });
}

export async function addIframeDomain(req: AuthedRequest, res: Response) {
  const domain = normalizeIframeDomain(String(req.body?.domain ?? ""));
  if (!domain) return res.status(400).json({ error: "domain_invalid" });
  if (BASELINE_ALLOWED_HOSTS.map((d) => d.toLowerCase()).includes(domain)) {
    return res.status(400).json({ error: "domain_builtin" });
  }
  if (await AllowedIframeDomain.findOne({ domain })) {
    return res.status(400).json({ error: "domain_exists" });
  }
  const created = await AllowedIframeDomain.create({ domain });
  res.status(201).json({
    _id: String(created._id),
    domain: created.domain,
    createdAt: created.createdAt,
  });
}

export async function deleteIframeDomain(req: AuthedRequest, res: Response) {
  const deleted = await AllowedIframeDomain.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true });
}

// ---------------- Image upload (Cloudinary) ----------------

export async function uploadImage(req: AuthedRequest, res: Response) {
  if (!cloudinaryConfigured()) {
    return res.status(503).json({ error: "cloudinary_not_configured" });
  }
  const file = (req as AuthedRequest & { file?: Express.Multer.File }).file;
  if (!file) return res.status(400).json({ error: "no_file" });
  try {
    const { url } = await uploadBuffer(file.buffer);
    res.json({ url });
  } catch {
    res.status(502).json({ error: "upload_failed" });
  }
}

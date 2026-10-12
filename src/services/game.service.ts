import { connectDB } from "../lib/db";
import { Game, type IGame, type GameGroup } from "../models/Game";
import { SiteSetting } from "../models/SiteSetting";
import { StaticPage } from "../models/StaticPage";

export interface GameDTO {
  id: string;
  name: string;
  slug: string;
  thumbnail?: string;
  iframeUrl: string;
  frameWidth: number;
  frameHeight: number;
  group: GameGroup;
  order: number;
  seoContentHtml?: string;
  seo?: IGame["seo"];
}

function toGameDTO(g: IGame): GameDTO {
  return {
    id: String(g._id),
    name: g.name,
    slug: g.slug,
    thumbnail: g.thumbnail,
    iframeUrl: g.iframeUrl,
    frameWidth: g.frameWidth ?? 900,
    frameHeight: g.frameHeight ?? 510,
    group: g.group,
    order: g.order,
    seoContentHtml: g.seoContentHtml,
    seo: g.seo,
  };
}

export async function getPublishedGames(group?: GameGroup): Promise<GameDTO[]> {
  await connectDB();
  const filter: Record<string, unknown> = { status: "published" };
  if (group) filter.group = group;
  const games = await Game.find(filter)
    .sort({ order: 1, createdAt: 1 })
    .lean<IGame[]>();
  return games.map(toGameDTO);
}

export async function getGameBySlug(slug: string): Promise<GameDTO | null> {
  await connectDB();
  const g = await Game.findOne({ slug, status: "published" }).lean<IGame>();
  return g ? toGameDTO(g) : null;
}

/**
 * Related / similar games honouring manual vs auto mode, always excluding the
 * current game and unpublished entries (spec §6).
 */
export async function resolveRelatedGames(opts: {
  mode: "manual" | "auto";
  limit: number;
  manualIds?: string[];
  excludeSlug?: string;
  preferredGroup?: GameGroup;
}): Promise<GameDTO[]> {
  await connectDB();
  const { mode, limit, manualIds = [], excludeSlug, preferredGroup } = opts;

  if (mode === "manual" && manualIds.length) {
    const games = await Game.find({
      _id: { $in: manualIds },
      status: "published",
      ...(excludeSlug ? { slug: { $ne: excludeSlug } } : {}),
    }).lean<IGame[]>();
    const byId = new Map(games.map((g) => [String(g._id), g]));
    return manualIds
      .map((id) => byId.get(id))
      .filter((g): g is IGame => Boolean(g))
      .slice(0, limit)
      .map(toGameDTO);
  }

  const group: GameGroup = preferredGroup ?? "tuong-tu";
  const primary = await Game.find({
    status: "published",
    group,
    ...(excludeSlug ? { slug: { $ne: excludeSlug } } : {}),
  })
    .sort({ order: 1, createdAt: 1 })
    .limit(limit)
    .lean<IGame[]>();

  if (primary.length >= limit) return primary.map(toGameDTO);

  const need = limit - primary.length;
  const have = new Set(primary.map((g) => String(g._id)));
  const backfill = await Game.find({
    status: "published",
    group: { $ne: group },
    ...(excludeSlug ? { slug: { $ne: excludeSlug } } : {}),
    _id: { $nin: Array.from(have) },
  })
    .sort({ order: 1, createdAt: 1 })
    .limit(need)
    .lean<IGame[]>();

  return [...primary, ...backfill].map(toGameDTO);
}

/** Aggregated payload for the homepage (1 request for the frontend SSR). */
export async function getHomePayload() {
  await connectDB();
  const setting = await SiteSetting.findOne({ key: "default" }).lean();

  let defaultGame: GameDTO | null = null;
  if (setting?.homeDefaultGameId) {
    const g = await Game.findOne({
      _id: setting.homeDefaultGameId,
      status: "published",
    }).lean<IGame>();
    if (g) defaultGame = toGameDTO(g);
  }
  if (!defaultGame) defaultGame = await getGameBySlug("lua-va-nuoc-1");

  const mainGames = await getPublishedGames("lua-va-nuoc");
  const related = await resolveRelatedGames({
    mode: setting?.homeRelated?.mode ?? "auto",
    limit: setting?.homeRelated?.limit ?? 8,
    manualIds: (setting?.homeRelated?.gameIds ?? []).map(String),
    preferredGroup: "tuong-tu",
  });

  return {
    h1: setting?.homeH1 || "Trò chơi Lửa và Nước",
    seo: {
      title: setting?.seoTitle,
      description: setting?.seoDescription,
      ogImage: setting?.ogImage,
    },
    seoContentHtml: setting?.homeSeoContentHtml ?? null,
    defaultGame,
    mainGames,
    related,
  };
}

/** Aggregated payload for a game page, or null if the slug is not a game. */
export async function getGamePagePayload(slug: string) {
  await connectDB();
  const game = await getGameBySlug(slug);
  if (!game) return null;

  const doc = await Game.findOne({ slug, status: "published" })
    .select("related")
    .lean();

  const related = await resolveRelatedGames({
    mode: doc?.related?.mode ?? "auto",
    limit: doc?.related?.limit ?? 8,
    manualIds: (doc?.related?.gameIds ?? []).map(String),
    excludeSlug: slug,
    preferredGroup: "tuong-tu",
  });

  const mainGames = (await getPublishedGames("lua-va-nuoc")).filter(
    (g) => g.slug !== slug
  );

  return { game, mainGames, related };
}

export async function getStaticPage(slug: string) {
  await connectDB();
  const page = await StaticPage.findOne({ slug, status: "published" }).lean();
  if (!page) return null;
  return {
    slug: page.slug,
    title: page.title,
    contentHtml: page.contentHtml ?? null,
    seo: page.seo ?? null,
  };
}

/** Site chrome (header/footer/branding) used on every public page. */
export async function getSiteChrome() {
  await connectDB();
  const s = await SiteSetting.findOne({ key: "default" }).lean();
  const headerPages = await StaticPage.find({
    status: "published",
    showInHeader: true,
  })
    .sort({ headerOrder: 1 })
    .select("slug title headerLabel")
    .lean();

  return {
    headerTitle: s?.headerTitle || "Lửa và Nước",
    logoUrl: s?.logoUrl || null,
    faviconUrl: s?.faviconUrl || null,
    footerText: s?.footerText || null,
    footerLinks: s?.footerLinks ?? [],
    headerLinks: s?.headerLinks ?? [],
    headerPages: headerPages.map((p) => ({
      slug: p.slug,
      label: p.headerLabel || p.title,
    })),
  };
}

/** Data for XML sitemap (spec §8). */
export async function getSitemapData() {
  await connectDB();
  const games = await Game.find({
    status: "published",
    "seo.robots": { $ne: "noindex" },
  })
    .select("slug updatedAt")
    .lean();
  const pages = await StaticPage.find({
    status: "published",
    "seo.robots": { $ne: "noindex" },
  })
    .select("slug updatedAt")
    .lean();
  return {
    games: games.map((g) => ({ slug: g.slug, updatedAt: g.updatedAt })),
    pages: pages.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt })),
  };
}

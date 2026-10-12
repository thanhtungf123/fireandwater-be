import type { Request, Response } from "express";
import {
  getHomePayload,
  getGamePagePayload,
  getStaticPage,
  getPublishedGames,
  getSitemapData,
  getSiteChrome,
} from "../services/game.service";
import type { GameGroup } from "../models/Game";
import { Redirect } from "../models/Redirect";

export async function home(_req: Request, res: Response) {
  res.json(await getHomePayload());
}

export async function listGames(req: Request, res: Response) {
  const group = req.query.group as GameGroup | undefined;
  res.json(await getPublishedGames(group));
}

export async function gamePage(req: Request, res: Response) {
  const payload = await getGamePagePayload(req.params.slug);
  if (!payload) return res.status(404).json({ error: "game_not_found" });
  res.json(payload);
}

export async function staticPage(req: Request, res: Response) {
  const page = await getStaticPage(req.params.slug);
  if (!page) return res.status(404).json({ error: "page_not_found" });
  res.json(page);
}

export async function sitemap(_req: Request, res: Response) {
  res.json(await getSitemapData());
}

export async function siteChrome(_req: Request, res: Response) {
  res.json(await getSiteChrome());
}

export async function redirectLookup(req: Request, res: Response) {
  const r = await Redirect.findOne({ from: req.params.slug }).lean();
  if (!r) return res.status(404).json({ error: "not_found" });
  res.json({ to: r.to });
}

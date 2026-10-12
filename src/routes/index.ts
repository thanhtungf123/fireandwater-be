import { Router } from "express";
import multer from "multer";
import * as pub from "../controllers/public.controller";
import * as admin from "../controllers/admin.controller";
import { requireAuth } from "../lib/auth";

const router = Router();

/** Wrap async handlers so rejected promises reach the error middleware. */
const h =
  (fn: (req: any, res: any) => Promise<any>) =>
  (req: any, res: any, next: any) =>
    fn(req, res).catch(next);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// ---- Public read API (consumed by the Next.js frontend via SSR) ----
router.get("/home", h(pub.home));
router.get("/games", h(pub.listGames));
router.get("/games/:slug", h(pub.gamePage));
router.get("/pages/:slug", h(pub.staticPage));
router.get("/sitemap", h(pub.sitemap));
router.get("/site-chrome", h(pub.siteChrome));
router.get("/redirects/:slug", h(pub.redirectLookup));

// ---- Admin auth ----
router.post("/admin/login", h(admin.login));
router.get("/admin/me", requireAuth, h(admin.me));

// ---- Admin: games ----
router.get("/admin/games", requireAuth, h(admin.listGames));
router.post("/admin/games", requireAuth, h(admin.createGame));
router.put("/admin/games/reorder", requireAuth, h(admin.reorderGames));
router.get("/admin/games/:id", requireAuth, h(admin.getGame));
router.put("/admin/games/:id", requireAuth, h(admin.updateGame));
router.delete("/admin/games/:id", requireAuth, h(admin.deleteGame));

// ---- Admin: site settings ----
router.get("/admin/settings", requireAuth, h(admin.getSettings));
router.put("/admin/settings", requireAuth, h(admin.updateSettings));

// ---- Admin: static pages ----
router.get("/admin/pages", requireAuth, h(admin.listPages));
router.post("/admin/pages", requireAuth, h(admin.createPage));
router.put("/admin/pages/reorder", requireAuth, h(admin.reorderPages));
router.get("/admin/pages/:slug", requireAuth, h(admin.getPage));
router.put("/admin/pages/:slug", requireAuth, h(admin.updatePage));
router.delete("/admin/pages/:slug", requireAuth, h(admin.deletePage));

// ---- Admin: image upload (Cloudinary) ----
router.post("/admin/upload", requireAuth, upload.single("file"), h(admin.uploadImage));

export default router;

/**
 * Seed script: populates the 7 official games, a default SiteSetting pointing
 * the homepage player at game #1, the 3 static pages, and the iframe domain
 * whitelist. Idempotent — upserts by slug / key.
 *
 * Run with:  npm run seed
 */
import "dotenv/config";
import { connectDB } from "../lib/db";
import mongoose from "mongoose";
import { Game } from "../models/Game";
import { SiteSetting } from "../models/SiteSetting";
import { StaticPage } from "../models/StaticPage";
import { AllowedIframeDomain } from "../models/AllowedIframeDomain";
import { User } from "../models/User";
import { hashPassword } from "../lib/auth";
import {
  GAME_SEEDS,
  HIDDEN_SLUGS,
  iframeUrlFor,
  thumbnailFor,
} from "../config/games.seed";

async function main() {
  await connectDB();
  console.log("Connected. Seeding...");

  // 1) Games (official Lửa và Nước versions)
  for (const g of GAME_SEEDS) {
    await Game.findOneAndUpdate(
      { slug: g.slug },
      {
        $set: {
          name: g.name,
          slug: g.slug,
          iframeUrl: iframeUrlFor(g.gameId),
          thumbnail: g.thumbnail ?? thumbnailFor(g.gameId),
          frameWidth: g.frameWidth,
          frameHeight: g.frameHeight,
          group: "lua-va-nuoc",
          order: g.order,
          status: "published",
        },
        $setOnInsert: {
          related: { mode: "auto", limit: 8, gameIds: [] },
        },
      },
      { upsert: true, returnDocument: "after" }
    );
    console.log(`  game: ${g.slug}`);
  }

  // 1b) Hide games that were removed from the catalogue (e.g. broken thumbnail).
  if (HIDDEN_SLUGS.length) {
    await Game.updateMany(
      { slug: { $in: HIDDEN_SLUGS } },
      { $set: { status: "hidden" } }
    );
    console.log(`  hidden: ${HIDDEN_SLUGS.join(", ")}`);
  }

  // 2) Homepage settings -> default player = game #1
  const first = await Game.findOne({ slug: "lua-va-nuoc-1" }).lean();
  await SiteSetting.findOneAndUpdate(
    { key: "default" },
    {
      $set: {
        homeDefaultGameId: first?._id,
        homeH1: "Trò chơi Lửa và Nước",
        homeRelated: { mode: "auto", limit: 8, gameIds: [] },
        seoTitle: "Trò chơi Lửa và Nước – Chơi ngay trên trình duyệt",
        seoDescription:
          "Chơi Lửa và Nước (Fireboy and Watergirl) trực tiếp trên trang chủ. Đủ 7 phần: Forest, Light, Ice, Crystal, Elements, Fairy Tales, And Friends.",
      },
      // Branding/footer defaults: only on first insert so admin edits persist.
      $setOnInsert: {
        headerTitle: "Lửa và Nước",
        footerText: "© Game thuộc về nhà phát triển tương ứng.",
        footerLinks: [
          { label: "Giới thiệu", url: "/gioi-thieu/" },
          { label: "Liên hệ", url: "/lien-he/" },
          { label: "Chính sách bảo mật", url: "/chinh-sach-bao-mat/" },
        ],
        headerLinks: [],
      },
    },
    { upsert: true }
  );
  console.log("  site settings: ok");

  // 3) Static pages
  const staticPages = [
    { slug: "gioi-thieu", title: "Giới thiệu" },
    { slug: "lien-he", title: "Liên hệ" },
    { slug: "chinh-sach-bao-mat", title: "Chính sách bảo mật" },
  ];
  for (const p of staticPages) {
    await StaticPage.findOneAndUpdate(
      { slug: p.slug },
      { $set: { title: p.title, status: "published" } },
      { upsert: true }
    );
    console.log(`  static page: ${p.slug}`);
  }

  // 4) Iframe domain whitelist
  for (const domain of ["html5.gamedistribution.com", "gamedistribution.com"]) {
    await AllowedIframeDomain.findOneAndUpdate(
      { domain },
      { $set: { domain } },
      { upsert: true }
    );
  }
  console.log("  iframe whitelist: ok");

  // 5) Admin user (admin / admin123 by default; override via env).
  const adminUsername = (process.env.ADMIN_USERNAME || "admin").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const existingAdmin = await User.findOne({ username: adminUsername });
  if (!existingAdmin) {
    await User.create({
      username: adminUsername,
      passwordHash: await hashPassword(adminPassword),
      role: "admin",
    });
    console.log(`  admin user created: ${adminUsername}`);
  } else {
    console.log(`  admin user exists: ${adminUsername} (unchanged)`);
  }

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});

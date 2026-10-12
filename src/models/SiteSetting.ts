import mongoose, { Schema, model, models, type Model } from "mongoose";
import type { RelatedConfig } from "./Game";

export interface ISiteSetting {
  _id: mongoose.Types.ObjectId;
  /** Singleton key so there is always exactly one settings document. */
  key: "default";
  homeDefaultGameId?: mongoose.Types.ObjectId;
  homeH1: string;
  /** Show the default game's name above the player on the homepage. */
  homeShowGameTitle: boolean;
  homeSeoContentHtml?: string;
  homeMainGameIds: mongoose.Types.ObjectId[];
  homeRelated: RelatedConfig;
  seoTitle?: string;
  seoDescription?: string;
  ogImage?: string;
  // ---- Branding / header / footer (Appearance) ----
  headerTitle?: string; // text shown next to the logo
  logoUrl?: string; // optional image logo (replaces the emoji)
  faviconUrl?: string;
  footerText?: string;
  footerLinks: { label: string; url: string }[];
  headerLinks: { label: string; url: string }[]; // optional custom header links
  createdAt: Date;
  updatedAt: Date;
}

const LinkSchema = new Schema(
  { label: { type: String, required: true }, url: { type: String, required: true } },
  { _id: false }
);

const RelatedSchema = new Schema(
  {
    mode: { type: String, enum: ["manual", "auto"], default: "auto" },
    limit: { type: Number, default: 8 },
    gameIds: [{ type: Schema.Types.ObjectId, ref: "Game" }],
  },
  { _id: false }
);

const SiteSettingSchema = new Schema<ISiteSetting>(
  {
    key: { type: String, enum: ["default"], default: "default", unique: true },
    homeDefaultGameId: { type: Schema.Types.ObjectId, ref: "Game" },
    homeH1: { type: String, default: "Trò chơi Lửa và Nước" },
    homeShowGameTitle: { type: Boolean, default: true },
    homeSeoContentHtml: String,
    homeMainGameIds: [{ type: Schema.Types.ObjectId, ref: "Game" }],
    homeRelated: {
      type: RelatedSchema,
      default: () => ({ mode: "auto", limit: 8, gameIds: [] }),
    },
    seoTitle: String,
    seoDescription: String,
    ogImage: String,
    headerTitle: { type: String, default: "Lửa và Nước" },
    logoUrl: String,
    faviconUrl: String,
    footerText: String,
    footerLinks: { type: [LinkSchema], default: [] },
    headerLinks: { type: [LinkSchema], default: [] },
  },
  { timestamps: true }
);

export const SiteSetting: Model<ISiteSetting> =
  (models.SiteSetting as Model<ISiteSetting>) ||
  model<ISiteSetting>("SiteSetting", SiteSettingSchema);

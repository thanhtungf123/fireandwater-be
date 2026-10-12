import mongoose, { Schema, model, models, type Model } from "mongoose";

export type GameGroup = "lua-va-nuoc" | "tuong-tu";
export type GameStatus = "draft" | "published" | "hidden";
export type RelatedMode = "manual" | "auto";

export interface SeoFields {
  title?: string;
  metaDescription?: string;
  canonical?: string;
  robots?: "index" | "noindex";
  ogImage?: string;
}

export interface RelatedConfig {
  mode: RelatedMode;
  limit: number;
  gameIds: mongoose.Types.ObjectId[];
}

export interface IGame {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  thumbnail?: string;
  /** Base embed URL, e.g. https://html5.gamedistribution.com/<GAME_ID>/ */
  iframeUrl: string;
  /** Optional aspect ratio from the provider embed (width/height). */
  frameWidth?: number;
  frameHeight?: number;
  group: GameGroup;
  order: number;
  status: GameStatus;
  seoContentHtml?: string;
  seo?: SeoFields;
  related?: RelatedConfig;
  createdAt: Date;
  updatedAt: Date;
}

const SeoSchema = new Schema<SeoFields>(
  {
    title: String,
    metaDescription: String,
    canonical: String,
    robots: { type: String, enum: ["index", "noindex"], default: "index" },
    ogImage: String,
  },
  { _id: false }
);

const RelatedSchema = new Schema<RelatedConfig>(
  {
    mode: { type: String, enum: ["manual", "auto"], default: "auto" },
    limit: { type: Number, default: 8 },
    gameIds: [{ type: Schema.Types.ObjectId, ref: "Game" }],
  },
  { _id: false }
);

const GameSchema = new Schema<IGame>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    thumbnail: String,
    iframeUrl: { type: String, required: true, trim: true },
    frameWidth: { type: Number, default: 900 },
    frameHeight: { type: Number, default: 510 },
    group: {
      type: String,
      enum: ["lua-va-nuoc", "tuong-tu"],
      required: true,
      index: true,
    },
    order: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["draft", "published", "hidden"],
      default: "draft",
      index: true,
    },
    seoContentHtml: String,
    seo: SeoSchema,
    related: RelatedSchema,
  },
  { timestamps: true }
);

// Unique slug enforced at the DB layer (spec §2, §5).
GameSchema.index({ slug: 1 }, { unique: true });
// Common query path for grids + sitemap (spec §8, §9).
GameSchema.index({ status: 1, group: 1, order: 1 });

export const Game: Model<IGame> =
  (models.Game as Model<IGame>) || model<IGame>("Game", GameSchema);

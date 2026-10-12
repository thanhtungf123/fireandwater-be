import mongoose, { Schema, model, models, type Model } from "mongoose";
import type { SeoFields } from "./Game";

export interface IStaticPage {
  _id: mongoose.Types.ObjectId;
  slug: string; // e.g. gioi-thieu, lien-he, chinh-sach-bao-mat
  title: string; // H1 / display title
  headerLabel?: string; // short label on the header menu (falls back to title)
  showInHeader: boolean; // whether this page appears in the header menu
  headerOrder: number; // sort order within the header menu
  contentHtml?: string;
  seo?: SeoFields;
  status: "published" | "hidden";
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

const StaticPageSchema = new Schema<IStaticPage>(
  {
    slug: { type: String, required: true, lowercase: true, trim: true },
    title: { type: String, required: true },
    headerLabel: String,
    showInHeader: { type: Boolean, default: false },
    headerOrder: { type: Number, default: 0 },
    contentHtml: String,
    seo: SeoSchema,
    status: {
      type: String,
      enum: ["published", "hidden"],
      default: "published",
    },
  },
  { timestamps: true }
);

StaticPageSchema.index({ slug: 1 }, { unique: true });

export const StaticPage: Model<IStaticPage> =
  (models.StaticPage as Model<IStaticPage>) ||
  model<IStaticPage>("StaticPage", StaticPageSchema);

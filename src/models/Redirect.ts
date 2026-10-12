import mongoose, { Schema, model, models, type Model } from "mongoose";

/** 301 redirect created when a game/page slug changes (spec §2, §8). */
export interface IRedirect {
  _id: mongoose.Types.ObjectId;
  from: string; // old slug (no slashes), e.g. "lua-va-nuoc-cu"
  to: string; // new slug
  createdAt: Date;
}

const RedirectSchema = new Schema<IRedirect>(
  {
    from: { type: String, required: true, lowercase: true, trim: true },
    to: { type: String, required: true, lowercase: true, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

RedirectSchema.index({ from: 1 }, { unique: true });

export const Redirect: Model<IRedirect> =
  (models.Redirect as Model<IRedirect>) ||
  model<IRedirect>("Redirect", RedirectSchema);

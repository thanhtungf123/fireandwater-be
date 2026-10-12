import mongoose, { Schema, model, models, type Model } from "mongoose";

export interface IAllowedIframeDomain {
  _id: mongoose.Types.ObjectId;
  domain: string; // e.g. html5.gamedistribution.com
  createdAt: Date;
}

const AllowedIframeDomainSchema = new Schema<IAllowedIframeDomain>(
  {
    domain: { type: String, required: true, lowercase: true, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AllowedIframeDomainSchema.index({ domain: 1 }, { unique: true });

export const AllowedIframeDomain: Model<IAllowedIframeDomain> =
  (models.AllowedIframeDomain as Model<IAllowedIframeDomain>) ||
  model<IAllowedIframeDomain>("AllowedIframeDomain", AllowedIframeDomainSchema);

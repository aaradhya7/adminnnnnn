import mongoose from 'mongoose';

const MindfulnessMoodSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    displayName: { type: String, required: false },
    date: { type: Date, required: true, index: true },
    angry: { type: Number, required: false, default: 0 },
    sad: { type: Number, required: false, default: 0 },
    happy: { type: Number, required: false, default: 0 },
    calm: { type: Number, required: false, default: 0 },
    tired: { type: Number, required: false, default: 0 },
    // Some datasets store a single categorical mood per record
    mood: { type: String, required: false, enum: ['angry','sad','happy','calm','tired', 'neutral', 'other'], index: true }
  },
  { timestamps: true, collection: 'mindfulnessmoods' }
);

export default mongoose.model('MindfulnessMood', MindfulnessMoodSchema);

import mongoose from 'mongoose';

const DashboardLoginHistorySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    userName: { type: String },
    email: { type: String },
    loginAt: { type: Date },
  },
  { timestamps: true, collection: 'dashboardloginhistories' }
);

export default mongoose.model('DashboardLoginHistory', DashboardLoginHistorySchema);

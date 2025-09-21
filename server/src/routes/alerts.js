import express from 'express';
import dotenv from 'dotenv';
import twilio from 'twilio';
import MindfulnessMood from '../models/MindfulnessMood.js';

dotenv.config();

const router = express.Router();

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

async function fetchUserName(userId) {
  const doc = await MindfulnessMood.findOne({ userId }).sort({ date: -1 }).lean();
  if (!doc) return userId;
  return (
    doc.userName ||
    doc.displayName ||
    doc.name ||
    doc.fullName ||
    `${doc.firstName || ''} ${doc.lastName || ''}`.trim() ||
    doc.email ||
    userId
  );
}

// POST /api/alerts/check?userId=...&phone=9354401130
// Checks for 5+ consecutive 'sad' entries (case-insensitive). If threshold met, sends SMS.
router.post('/check', async (req, res) => {
  try {
    const { userId, phone } = { ...req.query, ...req.body };
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const records = await MindfulnessMood.find({ userId })
      .select({ mood: 1, sad: 1, date: 1 })
      .sort({ date: 1 }) // ascending to compute consecutive runs
      .lean();

    let current = 0;
    let maxRun = 0;
    for (const r of records) {
      const m = (r.mood || '').toString().toLowerCase();
      const isSad = m === 'sad' || (typeof r.sad === 'number' && r.sad > 0);
      if (isSad) {
        current += 1;
        if (current > maxRun) maxRun = current;
      } else {
        current = 0;
      }
    }

    const name = await fetchUserName(userId);

    const threshold = Number(process.env.SAD_ALERT_STREAK || 5);
    const shouldAlert = maxRun >= threshold;

    let sms = null;
    if (shouldAlert) {
      const client = getTwilioClient();
      const toNumber = phone || process.env.ALERT_PHONE || '';
      const fromNumber = process.env.TWILIO_FROM || '';
      if (!client || !fromNumber || !toNumber) {
        return res.status(200).json({
          userId,
          name,
          maxConsecutiveSad: maxRun,
          alerted: false,
          reason: 'Twilio not configured or phone numbers missing',
        });
      }

      const body = `Mind Saathi Alert: ${name} has reported feeling sad for ${maxRun} consecutive entries. Please check in.`;
      sms = await client.messages.create({ body, to: toNumber, from: fromNumber });
    }

    res.json({ userId, name, maxConsecutiveSad: maxRun, alerted: !!sms, smsSid: sms?.sid || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check/send alert' });
  }
});

export default router;

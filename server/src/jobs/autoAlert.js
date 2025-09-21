import dotenv from 'dotenv';
import twilio from 'twilio';
import MindfulnessMood from '../models/MindfulnessMood.js';

dotenv.config();

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

function getUserDisplayName(doc, userId) {
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

async function fetchSadCountForUser(userId, lookbackDays) {
  const match = { userId };
  if (lookbackDays && Number(lookbackDays) > 0) {
    const from = new Date(Date.now() - Number(lookbackDays) * 24 * 60 * 60 * 1000);
    match.date = { $gte: from };
  }
  // Prefer categorical mood (case-insensitive), else numeric sad>0
  const categorical = await MindfulnessMood.aggregate([
    { $match: { ...match, mood: { $type: 'string' } } },
    { $project: { m: { $toLower: '$mood' } } },
    { $match: { m: { $eq: 'sad' } } },
    { $count: 'count' }
  ]);
  if (categorical.length > 0) return categorical[0].count;

  const numeric = await MindfulnessMood.aggregate([
    { $match: match },
    { $match: { sad: { $gt: 0 } } },
    { $count: 'count' }
  ]);
  return numeric[0]?.count || 0;
}

async function fetchUserDoc(userId) {
  return MindfulnessMood.findOne({ userId }).sort({ date: -1 }).lean();
}

// In-memory cooldown so we don't spam the same user repeatedly
const lastAlertAt = new Map(); // userId -> timestamp

export function startAutoAlert() {
  const enabled = process.env.AUTO_ALERT_ENABLED === 'true';
  if (!enabled) {
    console.log('[AutoAlert] Disabled (set AUTO_ALERT_ENABLED=true to enable)');
    return;
  }

  const client = getTwilioClient();
  if (!client) {
    console.warn('[AutoAlert] Twilio not configured; cannot send SMS');
  }

  const intervalMinutes = Number(process.env.AUTO_ALERT_INTERVAL_MIN || 10);
  const threshold = Number(process.env.SAD_ALERT_STREAK || 5);
  const lookbackDays = process.env.SAD_ALERT_LOOKBACK_DAYS; // optional
  const cooldownHours = Number(process.env.SCHEDULER_ALERT_COOLDOWN_HOURS || 24);
  const toNumber = process.env.ALERT_PHONE || '';
  const fromNumber = process.env.TWILIO_FROM || '';

  const timer = setInterval(async () => {
    try {
      // Get distinct users
      const users = await MindfulnessMood.distinct('userId');
      for (const userId of users) {
        // Cooldown check
        const last = lastAlertAt.get(userId) || 0;
        if (Date.now() - last < cooldownHours * 3600 * 1000) continue;

        const sadCount = await fetchSadCountForUser(userId, lookbackDays);
        if (sadCount >= threshold) {
          const doc = await fetchUserDoc(userId);
          const name = getUserDisplayName(doc, userId);

          if (!client || !toNumber || !fromNumber) {
            console.warn('[AutoAlert] Missing Twilio config or phone numbers; skip send', { userId, name, sadCount });
            lastAlertAt.set(userId, Date.now());
            continue;
          }

          const body = `Mind Saathi Alert: ${name} has ${sadCount} sad entries${lookbackDays ? ` in last ${lookbackDays} days` : ''}. Please check in.`;
          await client.messages.create({ body, to: toNumber, from: fromNumber });
          console.log('[AutoAlert] SMS sent', { userId, name, sadCount });
          lastAlertAt.set(userId, Date.now());
        }
      }
    } catch (err) {
      console.error('[AutoAlert] Error in scheduler:', err);
    }
  }, intervalMinutes * 60 * 1000);

  // Run immediately once at startup
  (async () => {
    try {
      const users = await MindfulnessMood.distinct('userId');
      for (const userId of users) {
        const sadCount = await fetchSadCountForUser(userId, lookbackDays);
        if (sadCount >= threshold) {
          const doc = await fetchUserDoc(userId);
          const name = getUserDisplayName(doc, userId);
          if (client && toNumber && fromNumber) {
            const body = `Mind Saathi Alert: ${name} has ${sadCount} sad entries${lookbackDays ? ` in last ${lookbackDays} days` : ''}. Please check in.`;
            await client.messages.create({ body, to: toNumber, from: fromNumber });
            console.log('[AutoAlert] Startup SMS sent', { userId, name, sadCount });
            lastAlertAt.set(userId, Date.now());
          } else {
            console.warn('[AutoAlert] Startup skipped SMS (config missing)', { userId, name, sadCount });
          }
        }
      }
    } catch (e) {
      console.error('[AutoAlert] Startup run error:', e);
    }
  })();

  console.log(`[AutoAlert] Enabled. Interval ${intervalMinutes}m, threshold >= ${threshold}, cooldown ${cooldownHours}h, lookbackDays=${lookbackDays || 'all'}`);
  return timer;
}

import dotenv from 'dotenv';
import twilio from 'twilio';
import DashboardLoginHistory from '../models/DashboardLoginHistory.js';

dotenv.config();

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

function getDisplayName(doc) {
  if (!doc) return 'Unknown User';
  return (
    doc.userName ||
    doc.displayName ||
    doc.name ||
    doc.fullName ||
    `${doc.firstName || ''} ${doc.lastName || ''}`.trim() ||
    doc.email ||
    doc.userId ||
    'Unknown User'
  );
}

// Build a window covering "last night" between 00:00 and 06:00 local time for the provided timezone
function buildNightWindow(timezone) {
  const now = new Date();
  // We'll evaluate for the current calendar day in the given timezone
  // Create strings like YYYY-MM-DD in timezone using Intl
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const [{ value: y }, , { value: m }, , { value: d }] = fmt.formatToParts(now);
  const startLocal = new Date(`${y}-${m}-${d}T00:00:00`);
  const endLocal = new Date(`${y}-${m}-${d}T06:00:00`);
  return { startLocal, endLocal };
}

export function startNightLoginAlert() {
  const enabled = process.env.NIGHT_ALERT_ENABLED === 'true';
  if (!enabled) {
    console.log('[NightLoginAlert] Disabled (set NIGHT_ALERT_ENABLED=true to enable)');
    return;
  }

  const client = getTwilioClient();
  if (!client) console.warn('[NightLoginAlert] Twilio not configured; cannot send SMS');

  const tz = process.env.TIMEZONE || 'Asia/Kolkata';
  const intervalMin = Number(process.env.NIGHT_ALERT_INTERVAL_MIN || 15);
  const threshold = Number(process.env.NIGHT_ALERT_THRESHOLD || 5);
  const toNumber = process.env.ALERT_PHONE || '';
  const fromNumber = process.env.TWILIO_FROM || '';

  // prevent spamming: remember whom we alerted today
  const alertedToday = new Set();

  const runCheck = async () => {
    try {
      const { startLocal, endLocal } = buildNightWindow(tz);
      // Fetch records for last 24h to be safe
      const fromWindow = new Date(startLocal.getTime() - 24 * 60 * 60 * 1000);
      const records = await DashboardLoginHistory.find({ loginAt: { $gte: fromWindow } }).lean();

      // Filter to window 00:00-06:00 in given tz
      const inWindow = records.filter(r => {
        if (!r.loginAt) return false;
        const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hour12: false, hour: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(r.loginAt));
        const obj = Object.fromEntries(parts.map(p => [p.type, p.value]));
        const dateStr = `${obj.year}-${obj.month}-${obj.day}`;
        const hour = parseInt(obj.hour, 10);
        return hour >= 0 && hour < 6 && dateStr === new Intl.DateTimeFormat('en-CA', { timeZone: tz }).formatToParts(startLocal).map(p=>p.value).join('').replace(/(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3');
      });

      // Count logins per userId
      const counts = new Map(); // userId -> { count, sampleDoc }
      for (const r of inWindow) {
        const key = r.userId || 'unknown';
        const entry = counts.get(key) || { count: 0, sampleDoc: r };
        entry.count += 1;
        entry.sampleDoc = entry.sampleDoc || r;
        counts.set(key, entry);
      }

      for (const [userId, { count, sampleDoc }] of counts.entries()) {
        if (count > threshold) {
          // Avoid re-alerting multiple times a day
          const alertKey = `${new Date().toDateString()}|${userId}`;
          if (alertedToday.has(alertKey)) continue;

          const name = getDisplayName(sampleDoc);
          if (client && toNumber && fromNumber) {
            const body = `Mind Saathi Alert: ${name} is awakening a lot at night (logins ${count} between 12–6 AM).`;
            await client.messages.create({ body, to: toNumber, from: fromNumber });
            console.log('[NightLoginAlert] SMS sent', { userId, name, count });
            alertedToday.add(alertKey);
          } else {
            console.warn('[NightLoginAlert] Missing Twilio config or phone numbers; skip send', { userId, name, count });
          }
        }
      }
    } catch (err) {
      console.error('[NightLoginAlert] Error:', err);
    }
  };

  // Run immediately and then on interval
  runCheck();
  const timer = setInterval(runCheck, intervalMin * 60 * 1000);
  console.log(`[NightLoginAlert] Enabled. Interval ${intervalMin}m, threshold > ${threshold}, timezone ${tz}`);
  return timer;
}

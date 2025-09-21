import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import moodsRouter from './routes/moods.js';
import alertsRouter from './routes/alerts.js';
import { startAutoAlert } from './jobs/autoAlert.js';
import { startNightLoginAlert } from './jobs/nightLoginAlert.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('Missing MONGO_URI in .env');
}

mongoose
  .connect(MONGO_URI, { dbName: process.env.MONGO_DB_NAME || 'unified-mind-app' })
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      // Start background jobs if enabled via .env flags
      try { startAutoAlert(); } catch (e) { console.error('AutoAlert start error:', e); }
      try { startNightLoginAlert(); } catch (e) { console.error('NightLoginAlert start error:', e); }
    });
  })
  .catch((err) => {
    console.error('Mongo connection error:', err);
    process.exit(1);
  });

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Mind Saathi Admin API' });
});

app.use('/api/moods', moodsRouter);
app.use('/api/alerts', alertsRouter);

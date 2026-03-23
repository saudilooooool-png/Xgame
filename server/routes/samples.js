import { Router } from 'express';
import { appendSamples, saveSession, getAllSamples, computeStats } from '../storage/store.js';

const router = Router();

// POST /api/samples — receive batch of training samples from client
router.post('/samples', (req, res) => {
  const { samples, session } = req.body;

  if (!Array.isArray(samples) || samples.length === 0) {
    return res.status(400).json({ error: 'samples must be a non-empty array' });
  }

  try {
    const totalCount = appendSamples(samples);
    if (session) saveSession({ ...session, sampleCount: samples.length });
    res.json({ ok: true, received: samples.length, totalStored: totalCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/samples — download full dataset
router.get('/samples', (_req, res) => {
  const samples = getAllSamples();
  res.json(samples);
});

// GET /api/stats — live stats for dashboard
router.get('/stats', (_req, res) => {
  res.json(computeStats());
});

export default router;

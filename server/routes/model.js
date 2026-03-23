import { Router } from 'express';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dir = dirname(fileURLToPath(import.meta.url));
const MODEL_DIR = join(__dir, '..', 'model');

const router = Router();
let trainingProcess = null;
let trainingLog = [];
let trainingStatus = 'idle'; // idle | running | done | error

// GET /api/model/status
router.get('/model/status', (_req, res) => {
  const modelExists = existsSync(join(MODEL_DIR, 'model.json'));
  res.json({ status: trainingStatus, modelExists, log: trainingLog.slice(-30) });
});

// POST /api/model/train — kick off training in background
router.post('/model/train', (req, res) => {
  if (trainingProcess) {
    return res.status(409).json({ error: 'Training already running' });
  }

  const epochs = req.body?.epochs ?? 40;
  const lr = req.body?.lr ?? 0.002;

  trainingLog = [];
  trainingStatus = 'running';

  trainingProcess = spawn('node', [
    join(__dir, '..', 'ai', 'train.js'),
    '--epochs', String(epochs),
    '--lr', String(lr),
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  trainingProcess.stdout.on('data', (d) => {
    const lines = d.toString().split('\n').filter(Boolean);
    trainingLog.push(...lines);
  });
  trainingProcess.stderr.on('data', (d) => {
    // TF prints info to stderr — only log non-TF lines
    const lines = d.toString().split('\n').filter(l => l && !l.startsWith('20') && !l.includes('tensorflow'));
    if (lines.length) trainingLog.push(...lines);
  });
  trainingProcess.on('close', (code) => {
    trainingStatus = code === 0 ? 'done' : 'error';
    trainingProcess = null;
  });

  res.json({ ok: true, message: `Training started (${epochs} epochs, lr=${lr})` });
});

// GET /api/model/logs — stream training log
router.get('/model/logs', (_req, res) => {
  res.json({ status: trainingStatus, log: trainingLog });
});

// GET /api/model/* — serve saved TF.js model files
router.get('/model/:file(*)', (req, res) => {
  const filePath = join(MODEL_DIR, req.params.file);
  if (!existsSync(filePath)) return res.status(404).json({ error: 'Model not found' });
  res.sendFile(filePath);
});

export default router;

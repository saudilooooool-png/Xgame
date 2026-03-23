import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dir, '..', 'data');
const SAMPLES_FILE = join(DATA_DIR, 'samples.json');
const SESSIONS_FILE = join(DATA_DIR, 'sessions.json');

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readJSON(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJSON(file, data) {
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// ── Samples ──────────────────────────────────────────────────────────────────

export function appendSamples(newSamples) {
  ensureDir();
  const existing = readJSON(SAMPLES_FILE, []);
  const merged = existing.concat(newSamples);
  writeJSON(SAMPLES_FILE, merged);
  return merged.length;
}

export function getAllSamples() {
  return readJSON(SAMPLES_FILE, []);
}

// ── Sessions ─────────────────────────────────────────────────────────────────

export function saveSession(session) {
  ensureDir();
  const sessions = readJSON(SESSIONS_FILE, []);
  sessions.push({ ...session, savedAt: Date.now() });
  writeJSON(SESSIONS_FILE, sessions);
  return sessions.length;
}

export function getAllSessions() {
  return readJSON(SESSIONS_FILE, []);
}

// ── Stats ────────────────────────────────────────────────────────────────────

export function computeStats() {
  const samples = getAllSamples();
  const sessions = getAllSessions();

  const total = samples.length;
  const withOutcome = samples.filter((s) => s.outcome !== null);

  const outcomeMap = { reached: 0, missed: 0, unknown: 0 };
  withOutcome.forEach((s) => { outcomeMap[s.outcome] = (outcomeMap[s.outcome] ?? 0) + 1; });

  const formationMap = {};
  samples.forEach((s) => {
    const f = s.action?.formation ?? 'unknown';
    formationMap[f] = (formationMap[f] ?? 0) + 1;
  });

  const actionTypes = {};
  samples.forEach((s) => {
    const t = s.action?.type ?? 'unknown';
    actionTypes[t] = (actionTypes[t] ?? 0) + 1;
  });

  const waveMap = {};
  samples.forEach((s) => {
    const w = s.action?.wave ?? 0;
    waveMap[w] = (waveMap[w] ?? 0) + 1;
  });

  return {
    totalSamples: total,
    totalSessions: sessions.length,
    withOutcome: withOutcome.length,
    outcomes: outcomeMap,
    formations: formationMap,
    actionTypes,
    byWave: waveMap,
    lastUpdated: Date.now(),
  };
}

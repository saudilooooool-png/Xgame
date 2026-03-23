import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import samplesRouter from './routes/samples.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API routes
app.use('/api', samplesRouter);

// Dashboard static files
app.use('/dashboard', express.static(join(__dir, 'public')));

// Redirect root to dashboard
app.get('/', (_req, res) => res.redirect('/dashboard'));

app.listen(PORT, () => {
  console.log(`\n  SwarmCommand Data Server`);
  console.log(`  → API:       http://localhost:${PORT}/api/stats`);
  console.log(`  → Dashboard: http://localhost:${PORT}/dashboard\n`);
});

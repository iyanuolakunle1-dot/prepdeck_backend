import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import questionsRouter from './routes/questions.js';
import attemptsRouter from './routes/attempts.js';
import subjectsRouter from './routes/subjects.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json());

// Basic protection against abuse of the public API proxy
const limiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
app.use('/api', limiter);

app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'PrepDeck API', time: new Date().toISOString() });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', questionsRouter);
app.use('/api', attemptsRouter);
app.use('/api', subjectsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Central error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`PrepDeck API listening on http://localhost:${PORT}`);
});

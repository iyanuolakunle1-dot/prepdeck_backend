import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { shuffle } from '../lib/decodeHtml.js';
import { fetchAlocQuestions } from '../lib/aloc.js';

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const QUESTIONS_DIR = path.join(DATA_DIR, 'questions');

const manifest = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'subjects.json'), 'utf-8'));

// Cache each subject's question bank in memory after first read.
const bankCache = new Map();

function loadBank(slug) {
  if (bankCache.has(slug)) return bankCache.get(slug);
  const meta = manifest.find((m) => m.slug === slug);
  if (!meta) return null;
  const raw = fs.readFileSync(path.join(QUESTIONS_DIR, meta.file), 'utf-8');
  const parsed = JSON.parse(raw);
  bankCache.set(slug, parsed);
  return parsed;
}

// GET /api/subjects — list every Nigerian subject with a live question count
router.get('/subjects', (_req, res) => {
  const subjects = manifest.map((m) => {
    const bank = loadBank(m.slug);
    return {
      slug: m.slug,
      name: m.name,
      icon: m.icon,
      description: m.description,
      questionCount: bank ? bank.questions.length : 0,
    };
  });
  res.json({ subjects });
});

// GET /api/subjects/:slug/topics — unique topics for a subject (for filtering)
router.get('/subjects/:slug/topics', (req, res) => {
  const bank = loadBank(req.params.slug);
  if (!bank) return res.status(404).json({ error: 'Subject not found' });
  const topics = [...new Set(bank.questions.map((q) => q.topic))];
  res.json({ topics });
});

// GET /api/subjects/:slug/questions?amount=&difficulty=&topic=
router.get('/subjects/:slug/questions', async (req, res) => {
  const bank = loadBank(req.params.slug);
  if (!bank) return res.status(404).json({ error: 'Subject not found' });

  const amount = Math.min(Math.max(Number(req.query.amount) || 10, 1), bank.questions.length);
  const { difficulty, topic } = req.query;

  // ALOC (real past-question archive) doesn't support topic or difficulty
  // filtering, so we only reach for it on plain, unfiltered requests — and
  // only when the site owner has actually configured an ALOC_ACCESS_TOKEN.
  // Anything filtered, or any failure, transparently falls back to the
  // local hand-written bank below.
  if (!difficulty && !topic) {
    const alocQuestions = await fetchAlocQuestions(req.params.slug, amount);
    if (alocQuestions) {
      return res.json({ questions: alocQuestions, source: 'aloc' });
    }
  }

  let pool = bank.questions;
  if (difficulty) pool = pool.filter((q) => q.difficulty === difficulty);
  if (topic) pool = pool.filter((q) => q.topic === topic);

  if (pool.length === 0) {
    return res.json({ questions: [] });
  }

  const picked = shuffle(pool).slice(0, Math.min(amount, pool.length));

  const questions = picked.map((q) => ({
    id: q.id,
    category: bank.subject,
    topic: q.topic,
    difficulty: q.difficulty,
    type: 'multiple',
    question: q.question,
    correct_answer: q.correct_answer,
    options: shuffle(q.options),
  }));

  res.json({ questions, source: 'local' });
});

export default router;

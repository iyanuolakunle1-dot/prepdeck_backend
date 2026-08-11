import { Router } from 'express';
import axios from 'axios';
import { decodeHtml, shuffle } from '../lib/decodeHtml.js';

const router = Router();

// Open Trivia DB — https://opentdb.com — is a free, open, no-API-key-required
// question bank. We proxy it server-side so we can normalize the payload
// (decode HTML entities, shuffle answer order, unify field names) and so the
// client never depends on a third party's CORS policy.
const OPENTDB_BASE = 'https://opentdb.com';

let categoryCache = { data: null, fetchedAt: 0 };
const CATEGORY_TTL_MS = 1000 * 60 * 60; // 1 hour

router.get('/categories', async (_req, res, next) => {
  try {
    const now = Date.now();
    if (categoryCache.data && now - categoryCache.fetchedAt < CATEGORY_TTL_MS) {
      return res.json({ categories: categoryCache.data });
    }

    const { data } = await axios.get(`${OPENTDB_BASE}/api_category.php`, { timeout: 8000 });
    const categories = data.trivia_categories.map((c) => ({ id: c.id, name: c.name }));

    categoryCache = { data: categories, fetchedAt: now };
    res.json({ categories });
  } catch (err) {
    // Fall back to a static list so the app still works if opentdb.com is briefly down.
    const fallback = [
      { id: 9, name: 'General Knowledge' },
      { id: 17, name: 'Science & Nature' },
      { id: 18, name: 'Science: Computers' },
      { id: 19, name: 'Science: Mathematics' },
      { id: 21, name: 'Sports' },
      { id: 22, name: 'Geography' },
      { id: 23, name: 'History' },
      { id: 24, name: 'Politics' },
      { id: 25, name: 'Art' },
      { id: 27, name: 'Animals' },
    ];
    res.json({ categories: fallback });
    console.error('Category fetch failed, served fallback list:', err.message);
  }
});

router.get('/questions', async (req, res, next) => {
  try {
    const amount = Math.min(Math.max(Number(req.query.amount) || 10, 1), 50);
    const { category, difficulty, type } = req.query;

    const params = { amount };
    if (category) params.category = category;
    if (difficulty) params.difficulty = difficulty;
    if (type) params.type = type;

    const { data } = await axios.get(`${OPENTDB_BASE}/api.php`, { params, timeout: 8000 });

    if (data.response_code !== 0) {
      // response_code 1 = not enough questions for that combination
      return res.json({ questions: [] });
    }

    const questions = data.results.map((q, i) => {
      const correct = decodeHtml(q.correct_answer);
      const incorrect = q.incorrect_answers.map(decodeHtml);
      const options = shuffle([correct, ...incorrect]);

      return {
        id: `${Date.now()}-${i}`,
        category: decodeHtml(q.category),
        difficulty: q.difficulty,
        type: q.type,
        question: decodeHtml(q.question),
        correct_answer: correct,
        options,
      };
    });

    res.json({ questions });
  } catch (err) {
    next(err);
  }
});

export default router;

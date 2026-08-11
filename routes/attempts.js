import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// The service role key lets the backend write attempts on the user's behalf
// and read across users for the leaderboard, bypassing row-level security
// safely because this code runs only on the server, never in the browser.
const supabase = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

function requireSupabase(_req, res, next) {
  if (!supabase) {
    return res.status(503).json({
      error: 'Backend is not connected to Supabase yet. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env.',
    });
  }
  next();
}

router.post('/attempts', requireSupabase, async (req, res, next) => {
  try {
    const { user_id, category, difficulty, score, total_questions, time_taken_seconds } = req.body;

    if (!user_id || total_questions == null || score == null) {
      return res.status(400).json({ error: 'Missing required attempt fields.' });
    }

    const { data, error } = await supabase
      .from('quiz_attempts')
      .insert({
        user_id,
        category: category || 'Mixed',
        difficulty: difficulty || 'mixed',
        score,
        total_questions,
        time_taken_seconds: time_taken_seconds || 0,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ attempt: data });
  } catch (err) {
    next(err);
  }
});

router.get('/leaderboard', requireSupabase, async (req, res, next) => {
  try {
    const { category } = req.query;

    let query = supabase
      .from('quiz_attempts')
      .select('id, score, total_questions, category, difficulty, created_at, profiles(full_name)')
      .order('score', { ascending: false })
      .limit(50);

    if (category) query = query.eq('category', category);

    const { data, error } = await query;
    if (error) throw error;

    const leaderboard = (data || [])
      .map((row) => ({
        id: row.id,
        score: row.score,
        total_questions: row.total_questions,
        category: row.category,
        difficulty: row.difficulty,
        full_name: row.profiles?.full_name,
      }))
      .sort((a, b) => b.score / b.total_questions - a.score / a.total_questions)
      .slice(0, 20);

    res.json({ leaderboard });
  } catch (err) {
    next(err);
  }
});

// Permanently deletes a user's auth account (and, via ON DELETE CASCADE,
// their profile/attempts/bookmarks). Requires the service role key, which
// is why this lives on the backend rather than being callable from the browser.
router.delete('/account/:userId', requireSupabase, async (req, res, next) => {
  try {
    const { error } = await supabase.auth.admin.deleteUser(req.params.userId);
    if (error) throw error;
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;

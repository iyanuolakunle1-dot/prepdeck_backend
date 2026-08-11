import axios from 'axios';

const ALOC_BASE = 'https://questions.aloc.com.ng/api/v2';

// Our subject slugs -> ALOC's subject query values. ALOC doesn't cover every
// subject we have locally (notably no Agricultural Science), and it has no
// concept of "topic" or "difficulty" — only subject, exam type, and year.
export const ALOC_SUBJECT_MAP = {
  mathematics: 'mathematics',
  english: 'english',
  physics: 'physics',
  chemistry: 'chemistry',
  biology: 'biology',
  economics: 'economics',
  government: 'government',
  geography: 'geography',
  literature: 'englishlit',
  commerce: 'commerce',
  accounting: 'accounting',
  crs: 'crk',
  // agriculture: not available on ALOC — always falls back to the local bank.
};

function hasAlocToken() {
  return Boolean(process.env.ALOC_ACCESS_TOKEN);
}

/**
 * Fetch `amount` questions for a subject from ALOC and normalize them into
 * this app's question shape. Returns null (never throws) if ALOC isn't
 * configured, the subject isn't supported, or the request fails for any
 * reason — callers should fall back to the local question bank in that case.
 *
 * NOTE: the exact field names in ALOC's JSON response (option.a/b/c/d,
 * `answer` as a letter, etc.) are based on ALOC's publicly documented shape
 * as of when this was written. If ALOC's actual response looks different
 * once you have a real token, adjust the mapping in `normalize()` below —
 * this couldn't be verified live without a token and network access to
 * questions.aloc.com.ng from the build environment.
 */
export async function fetchAlocQuestions(subjectSlug, amount = 10) {
  if (!hasAlocToken()) return null;
  const alocSubject = ALOC_SUBJECT_MAP[subjectSlug];
  if (!alocSubject) return null;

  try {
    const limit = Math.min(Math.max(amount, 1), 40); // ALOC caps at 40 per call
    const { data } = await axios.get(`${ALOC_BASE}/q/${limit}`, {
      params: { subject: alocSubject },
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        AccessToken: process.env.ALOC_ACCESS_TOKEN,
      },
      timeout: 8000,
    });

    // ALOC has been observed wrapping results under different keys
    // depending on endpoint/version — handle the common shapes.
    const raw = Array.isArray(data) ? data : data?.data || data?.questions || [];
    if (!Array.isArray(raw) || raw.length === 0) return null;

    const questions = raw.map(normalize).filter(Boolean);
    return questions.length > 0 ? questions : null;
  } catch (err) {
    console.error(`ALOC fetch failed for ${subjectSlug}:`, err.message);
    return null;
  }
}

function normalize(q) {
  const options = q.option || q.options || {};
  const optionList = [options.a, options.b, options.c, options.d].filter(Boolean);
  if (optionList.length === 0 || !q.question) return null;

  // `answer` from ALOC is typically a single letter (a/b/c/d); resolve it
  // to the actual option text so it matches this app's { options, correct_answer } shape.
  const answerLetter = String(q.answer || '').trim().toLowerCase();
  const correctAnswer = options[answerLetter] || optionList[0];

  return {
    id: `aloc-${q.id || Math.random().toString(36).slice(2)}`,
    category: q.subject || '',
    topic: q.examyear ? `${(q.examtype || '').toUpperCase()} ${q.examyear}` : 'Past Question',
    difficulty: 'mixed',
    type: 'multiple',
    question: q.question,
    correct_answer: correctAnswer,
    options: optionList,
  };
}

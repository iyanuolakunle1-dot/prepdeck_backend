// Open Trivia DB returns HTML-entity-encoded text (e.g. &quot;, &amp;, &#039;).
// This is a small, dependency-free decoder covering the entities that
// actually show up in that API's responses.
const ENTITY_MAP = {
  '&quot;': '"',
  '&#039;': "'",
  '&apos;': "'",
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&rsquo;': '\u2019',
  '&lsquo;': '\u2018',
  '&rdquo;': '\u201d',
  '&ldquo;': '\u201c',
  '&ndash;': '\u2013',
  '&mdash;': '\u2014',
  '&hellip;': '\u2026',
  '&eacute;': '\u00e9',
  '&uuml;': '\u00fc',
  '&ouml;': '\u00f6',
  '&auml;': '\u00e4',
  '&nbsp;': ' ',
  '&shy;': '',
  '&frac12;': '\u00bd',
  '&frac14;': '\u00bc',
  '&frac34;': '\u00be',
};

export function decodeHtml(str = '') {
  return str.replace(/&[a-zA-Z#0-9]+;/g, (entity) => ENTITY_MAP[entity] ?? entity);
}

export function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

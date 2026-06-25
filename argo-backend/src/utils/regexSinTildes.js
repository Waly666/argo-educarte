/** Regex que tolera tildes (medellin → MEDELLÍN) */
function regexSinTildes(q) {
  const safe = String(q || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const map = {
    a: '[aáÁàÀäÄ]',
    e: '[eéÉèÈëË]',
    i: '[iíÍìÌïÏ]',
    o: '[oóÓòÒöÖ]',
    u: '[uúÚùÙüÜ]',
    n: '[nñÑ]',
  };
  const pattern = safe.replace(/[aeioun]/gi, (c) => map[c.toLowerCase()] || c);
  return new RegExp(pattern, 'i');
}

module.exports = { regexSinTildes };

/**
 * Parse industry-style SKILL.md: YAML-ish frontmatter + markdown body.
 * Minimal parser (no deps) for extension + Node.
 *
 * ---
 * name: ...
 * description: ...
 * libraries: a, b
 * ---
 * instructions body
 */

/**
 * @param {string} raw
 * @returns {{ meta: Record<string, string>, body: string }}
 */
export function parseSkillMd(raw) {
  const text = String(raw || '').replace(/^\uFEFF/, '');
  if (!text.startsWith('---')) {
    return { meta: {}, body: text.trim() };
  }
  const end = text.indexOf('\n---', 3);
  if (end < 0) {
    return { meta: {}, body: text.trim() };
  }
  const fm = text.slice(3, end).trim();
  const body = text.slice(end + 4).replace(/^\r?\n/, '').trim();
  /** @type {Record<string, string>} */
  const meta = {};
  for (const line of fm.split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line.trim());
    if (!m) continue;
    meta[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return { meta, body };
}

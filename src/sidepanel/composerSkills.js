/**
 * Composer `/` skill picker — same shape as @ mentions, catalog-only.
 */

export function buildSkillCandidates(catalog, query) {
  const q = String(query || '')
    .trim()
    .replace(/^\/+/, '')
    .toLowerCase();
  const list = Array.isArray(catalog) ? catalog : [];
  const out = [];
  for (const s of list) {
    if (!s?.id) continue;
    const hay = `${s.id} ${s.name || ''} ${s.description || ''}`.toLowerCase();
    if (q && !hay.includes(q)) continue;
    out.push({
      kind: 'skill',
      id: s.id,
      groupId: '__skills__',
      label: s.name || s.id,
      handle: s.id,
      bound: false,
      itemCount: 0,
      itemKind: 'skill',
      parentName: '',
      kicker: s.origin === 'packaged' ? 'packaged' : s.origin || 'local',
      description: String(s.description || '').slice(0, 160)
    });
  }
  return out.slice(0, 40);
}

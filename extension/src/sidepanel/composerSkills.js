/**
 * Composer `/` picker — slash commands first, then catalog skills.
 * /plan is a host command, not a skill.
 */

export const PLAN_SLASH_COMMAND = {
  kind: 'command',
  id: 'plan',
  groupId: '__commands__',
  label: 'plan',
  handle: 'plan',
  bound: false,
  itemCount: 0,
  itemKind: 'command',
  parentName: '',
  kicker: 'command'
};

function planCommandCandidate(lang = 'zh') {
  const en = String(lang || '').toLowerCase().startsWith('en');
  return {
    ...PLAN_SLASH_COMMAND,
    kicker: en ? 'command' : '指令',
    description: en
      ? 'Propose a pinned plan before changing anything'
      : '先出计划，批准后再动手'
  };
}

export function buildSkillCandidates(catalog, query, lang = 'zh') {
  const q = String(query || '')
    .trim()
    .replace(/^\/+/, '')
    .toLowerCase();
  const out = [];
  if (!q || 'plan'.startsWith(q) || '计划'.startsWith(q)) {
    out.push(planCommandCandidate(lang));
  }
  const list = Array.isArray(catalog) ? catalog : [];
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

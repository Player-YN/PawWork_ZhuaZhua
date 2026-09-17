/**
 * Composer `/` picker — slash commands first, then catalog skills.
 * /plan and /learn are host commands, not skills.
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

export const LEARN_SLASH_COMMAND = {
  ...PLAN_SLASH_COMMAND,
  id: 'learn',
  label: 'learn',
  handle: 'learn'
};

function commandCandidate(base, lang, descriptionZh, descriptionEn) {
  const en = String(lang || '').toLowerCase().startsWith('en');
  return {
    ...base,
    kicker: en ? 'command' : '指令',
    description: en ? descriptionEn : descriptionZh
  };
}

function planCommandCandidate(lang = 'zh') {
  return commandCandidate(
    PLAN_SLASH_COMMAND,
    lang,
    '先出计划，批准后再动手',
    'Propose a pinned plan before changing anything'
  );
}

function learnCommandCandidate(lang = 'zh') {
  return commandCandidate(
    LEARN_SLASH_COMMAND,
    lang,
    '从上一轮成功轨迹提炼方法论，确认后才写入 skill',
    'Draft a methodology skill from the last successful turn; save only after you confirm'
  );
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
  if (!q || 'learn'.startsWith(q) || '学习'.startsWith(q) || '学会'.startsWith(q)) {
    out.push(learnCommandCandidate(lang));
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

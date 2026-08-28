/**
 * Narrow exported-PPTX object entrance. Markup is copied from a PowerPoint-
 * generated fade entrance (COM AddEffect msoAnimEffectFade=10,
 * msoAnimTriggerAfterPrevious) and checked against ECMA-376 / ISO 29500.
 *
 * Sources:
 * - ISO/IEC 29500-1 §19.5 timing / tnLst / animEffect / CT_SlideTiming
 *   (Microsoft Learn: DocumentFormat.OpenXml.Presentation.Timing,
 *   AnimateEffect; filter/transition from pml-animationInfo.xsd)
 * - ECMA-376 animEffect: transition="in"|"out"|"none", filter string
 *   (http://webapp.docx4java.org/OnlineDemo/ecma376/PresentationML/animEffect.html)
 * - ST_TLTimeNodeType: clickEffect|withEffect|afterEffect|mainSeq|tmRoot
 * - PowerPoint COM sample (this repo): artifacts/pptx-e2e/ppt-com-fade-reference.pptx
 *   tree: timing→tnLst→par→cTn tmRoot→seq mainSeq→one click-group
 *   (indefinite + onBegin tn=2) → per-beat par → presetID=10 entr fade
 */

export const PPTX_ENTRANCE_FADE_MS = 350;
export const PPTX_STAGGER_MS = 80;
export const PPTX_MAX_ANIM_GROUPS = 12;

export const PPTX_ANIMATION_SUPPORT = Object.freeze({
  slideTransitions: ['fade', 'push', 'wipe', 'none'],
  objectEntrance: true,
  presets: ['stagger-fade', 'fade', 'none'],
  fadeMs: PPTX_ENTRANCE_FADE_MS,
  staggerMs: PPTX_STAGGER_MS,
  maxGroups: PPTX_MAX_ANIM_GROUPS,
  note: 'entrance-only fade / stagger-fade via p:animEffect transition="in" filter="fade"; no exit, motion path, or model-authored timing'
});

const NEVER_ROLES = new Set(['bg', 'paper', 'decoration']);
const NEVER_SLOTS = new Set(['_paper', '_rule', 'rule']);
const TITLE_KEYS = new Set(['title', 'kicker']);

export function listDrawableCnvPrIds(slideXml) {
  const xml = String(slideXml || '');
  const ids = [];
  const re = /<p:(?:sp|pic|cxnSp|graphicFrame)\b[\s\S]*?<p:cNvPr\b[^>]*\bid="(\d+)"/g;
  let m;
  while ((m = re.exec(xml))) ids.push(Number(m[1]));
  return ids;
}

export function listAllCnvPrIds(slideXml) {
  return [...String(slideXml || '').matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g)].map((m) => Number(m[1]));
}

/**
 * Classify exported objects into animation beats. Backgrounds / decorations
 * never animate. Title/kicker first; cards and body groups follow source order.
 */
export function planSlideEntrance(objects, shapeIds, preset) {
  const warnings = [];
  const p = String(preset || 'none').toLowerCase();
  if (p === 'none') {
    return { preset: 'none', groups: [], targets: [], warnings };
  }
  if (p !== 'stagger-fade' && p !== 'fade') {
    warnings.push(`unsupported animation preset "${preset}"`);
    return { preset: 'none', groups: [], targets: [], warnings };
  }
  if (!Array.isArray(objects) || !Array.isArray(shapeIds) || objects.length !== shapeIds.length) {
    warnings.push('shape id count does not match exported objects; timing skipped');
    return { preset: 'none', groups: [], targets: [], warnings };
  }

  const buckets = new Map();
  objects.forEach((obj, i) => {
    const spid = Number(shapeIds[i]);
    if (!Number.isFinite(spid) || spid < 2) return;
    const cls = classifyObject(obj);
    if (!cls.animate) return;
    let bucket = buckets.get(cls.key);
    if (!bucket) {
      bucket = {
        key: cls.key,
        phase: cls.phase,
        rank: cls.rank,
        role: cls.role,
        slot: cls.slot,
        members: []
      };
      buckets.set(cls.key, bucket);
    }
    bucket.members.push({
      spid,
      role: cls.role,
      slot: cls.slot,
      sourceOrder: Number(obj?.meta?.sourceOrder) || i
    });
  });

  const groups = [...buckets.values()].sort((a, b) => {
    if (a.phase !== b.phase) return a.phase - b.phase;
    if (a.rank !== b.rank) return a.rank - b.rank;
    const ao = a.members[0]?.sourceOrder || 0;
    const bo = b.members[0]?.sourceOrder || 0;
    return ao - bo;
  });

  if (groups.length > PPTX_MAX_ANIM_GROUPS) {
    const head = groups.slice(0, PPTX_MAX_ANIM_GROUPS - 1);
    const tail = groups.slice(PPTX_MAX_ANIM_GROUPS - 1);
    const merged = {
      key: tail[0].key,
      phase: tail[0].phase,
      rank: tail[0].rank,
      role: tail[0].role,
      slot: tail[0].slot,
      members: tail.flatMap((g) => g.members)
    };
    groups.length = 0;
    groups.push(...head, merged);
    warnings.push(`capped animation groups at ${PPTX_MAX_ANIM_GROUPS}`);
  }

  const targets = groups.flatMap((g) =>
    g.members.map((m) => ({
      spid: m.spid,
      role: m.role,
      slot: m.slot,
      group: g.key
    }))
  );
  if (!targets.length) {
    warnings.push('no animatable objects for entrance preset');
    return { preset: 'none', groups: [], targets: [], warnings };
  }
  return { preset: p, groups, targets, warnings };
}

export function classifyObject(obj) {
  const role = norm(obj?.meta?.pawRole);
  const slot = norm(obj?.meta?.pawSlot);
  if (NEVER_ROLES.has(role) || NEVER_SLOTS.has(slot)) {
    return { animate: false, reason: 'decoration', role, slot };
  }
  if (obj?.kind === 'line' && (role === 'accent' || /rule/.test(slot))) {
    return { animate: false, reason: 'rule', role, slot };
  }
  if (TITLE_KEYS.has(role) || TITLE_KEYS.has(slot)) {
    const which = TITLE_KEYS.has(slot) ? slot : role;
    return {
      animate: true,
      phase: 1,
      key: `p1:${which}`,
      rank: which === 'kicker' ? 0 : 1,
      role: which,
      slot: slot || which
    };
  }
  const item = itemKey(obj?.meta?.sourceId, slot);
  const slotKey = slot || role || 'body';
  return {
    animate: true,
    phase: 2,
    key: `p2:${item || slotKey}`,
    rank: 100 + (Number(obj?.meta?.sourceOrder) || 0),
    role: role || slotKey,
    slot: slotKey
  };
}

export function buildSlideTimingXml(plan) {
  if (!plan || plan.preset === 'none' || !plan.groups?.length) return '';
  const fadeMs = PPTX_ENTRANCE_FADE_MS;
  const staggerMs = PPTX_STAGGER_MS;
  let id = 3;
  const next = () => {
    id += 1;
    return id;
  };

  const together = plan.preset === 'fade';
  let cursor = 0;
  const beats = plan.groups
    .map((group, gi) => {
      const wrapperDelay = together ? 0 : cursor;
      const effectDelay = together || gi === 0 ? 0 : staggerMs;
      const xml = emitBeat(group.members, {
        wrapperDelay,
        effectDelay,
        fadeMs,
        together,
        next
      });
      if (!together) cursor += fadeMs + effectDelay;
      return xml;
    })
    .join('');

  const bld = uniqueSpids(plan.groups)
    .map((spid) => `<p:bldP spid="${spid}" grpId="0"/>`)
    .join('');

  return (
    `<p:timing><p:tnLst><p:par>` +
    `<p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>` +
    `<p:seq concurrent="1" nextAc="seek">` +
    `<p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>` +
    `<p:par><p:cTn id="3" fill="hold">` +
    `<p:stCondLst>` +
    `<p:cond delay="indefinite"/>` +
    `<p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond>` +
    `</p:stCondLst>` +
    `<p:childTnLst>${beats}</p:childTnLst>` +
    `</p:cTn></p:par>` +
    `</p:childTnLst></p:cTn>` +
    `<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>` +
    `<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>` +
    `</p:seq>` +
    `</p:childTnLst></p:cTn></p:par></p:tnLst>` +
    `<p:bldLst>${bld}</p:bldLst></p:timing>`
  );
}

export function insertSlideMotionXml(xml, { transitionXml = '', timingXml = '' } = {}) {
  let out = String(xml || '')
    .replace(/<p:transition[\s\S]*?<\/p:transition>/g, '')
    .replace(/<p:timing[\s\S]*?<\/p:timing>/g, '');
  const chrome = `${transitionXml || ''}${timingXml || ''}`;
  if (!chrome) return out;
  if (out.includes('</p:clrMapOvr>')) return out.replace('</p:clrMapOvr>', `</p:clrMapOvr>${chrome}`);
  if (out.includes('</p:cSld>')) return out.replace('</p:cSld>', `</p:cSld>${chrome}`);
  return out.replace('</p:sld>', `${chrome}</p:sld>`);
}

function emitBeat(members, { wrapperDelay, effectDelay, fadeMs, together, next }) {
  const wrapId = next();
  const children = members
    .map((m, i) => {
      const nodeType = together || i > 0 ? 'withEffect' : 'afterEffect';
      const delay = i === 0 ? effectDelay : 0;
      return emitFadeEntrance(m.spid, nodeType, delay, fadeMs, next);
    })
    .join('');
  return (
    `<p:par><p:cTn id="${wrapId}" fill="hold">` +
    `<p:stCondLst><p:cond delay="${wrapperDelay}"/></p:stCondLst>` +
    `<p:childTnLst>${children}</p:childTnLst>` +
    `</p:cTn></p:par>`
  );
}

function emitFadeEntrance(spid, nodeType, delay, fadeMs, next) {
  const effectId = next();
  const setId = next();
  const fadeId = next();
  return (
    `<p:par><p:cTn id="${effectId}" presetID="10" presetClass="entr" presetSubtype="0" fill="hold" grpId="0" nodeType="${nodeType}">` +
    `<p:stCondLst><p:cond delay="${delay}"/></p:stCondLst>` +
    `<p:childTnLst>` +
    `<p:set><p:cBhvr>` +
    `<p:cTn id="${setId}" dur="${fadeMs}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>` +
    `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl>` +
    `<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst>` +
    `</p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>` +
    `<p:animEffect transition="in" filter="fade"><p:cBhvr>` +
    `<p:cTn id="${fadeId}" dur="${fadeMs}"/>` +
    `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl>` +
    `</p:cBhvr></p:animEffect>` +
    `</p:childTnLst></p:cTn></p:par>`
  );
}

function uniqueSpids(groups) {
  const seen = new Set();
  const out = [];
  for (const g of groups) {
    for (const m of g.members) {
      if (seen.has(m.spid)) continue;
      seen.add(m.spid);
      out.push(m.spid);
    }
  }
  return out;
}

function itemKey(sourceId, slot) {
  const id = String(sourceId || '');
  const numbered = /(?:item|step|cell|stat|panel)-(\d+)/i.exec(id);
  if (numbered) return `${slot || 'item'}:${numbered[1]}`;
  const side = /(?:^|[-_:])(left|right)(?:[-_]|$)/i.exec(id);
  if (side) return side[1].toLowerCase();
  return '';
}

function norm(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

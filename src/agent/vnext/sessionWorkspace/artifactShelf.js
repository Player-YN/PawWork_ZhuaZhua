/**
 * Deliverable-rail folders. Host infers a default; the model may override
 * per artifact (`folder`) or replace the layout (`session.shelf`).
 */

export const SHELF_FOLDER_IDS = ['images', 'design', 'slides', 'sheets', 'docs', 'sites', 'files'];

const FOLDER_ALIASES = {
  images: 'images',
  image: 'images',
  图片: 'images',
  photos: 'images',
  design: 'design',
  画板: 'design',
  poster: 'design',
  canvas: 'design',
  slides: 'slides',
  幻灯: 'slides',
  deck: 'slides',
  sheets: 'sheets',
  sheet: 'sheets',
  表格: 'sheets',
  excel: 'sheets',
  docs: 'docs',
  doc: 'docs',
  文档: 'docs',
  document: 'docs',
  sites: 'sites',
  site: 'sites',
  网站: 'sites',
  web: 'sites',
  files: 'files',
  file: 'files',
  其他: 'files',
  other: 'files'
};

const DEFAULT_LABELS = {
  images: { zh: '图片', en: 'Images' },
  design: { zh: '画板', en: 'Design' },
  slides: { zh: '幻灯', en: 'Slides' },
  sheets: { zh: '表格', en: 'Sheets' },
  docs: { zh: '文档', en: 'Documents' },
  sites: { zh: '网站', en: 'Sites' },
  files: { zh: '其他', en: 'Files' }
};

export function normalizeShelfFolderId(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const hit = FOLDER_ALIASES[s] || FOLDER_ALIASES[s.toLowerCase()];
  if (hit) return hit;
  return s.replace(/[^\w\u4e00-\u9fff.\-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

export function inferArtifactShelfFolder(rec = {}) {
  const explicit = normalizeShelfFolderId(rec.folder || rec.shelf);
  if (explicit) return explicit;
  const mime = String(rec.mimeType || rec.mime || '').toLowerCase();
  const name = String(rec.name || rec.primaryPath || '').toLowerCase();
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return 'images';
  if (mime.includes('spreadsheet') || /\.(xlsx?|csv|tsv)$/i.test(name)) return 'sheets';
  if (/\.docx?$/i.test(name) || mime.includes('wordprocessing')) return 'docs';
  if (/\.pptx?$/i.test(name) || mime.includes('presentation')) return 'slides';
  if (mime.includes('html') || /\.html?$/i.test(name)) {
    if (/site|web/i.test(name)) return 'sites';
    return 'files';
  }
  if (/\.json$/i.test(name) || mime.includes('json')) {
    if (/slide|deck/i.test(name)) return 'slides';
    return 'design';
  }
  return 'files';
}

export function shelfFolderLabel(folderId, lang = 'zh', labels = {}) {
  const id = normalizeShelfFolderId(folderId) || 'files';
  if (labels[id]) return String(labels[id]);
  const pack = DEFAULT_LABELS[id];
  if (pack) return lang === 'en' ? pack.en : pack.zh;
  return id;
}

/**
 * @param {object[]} arts
 * @param {{ labels?: Record<string,string>, layout?: Array<{id:string,label?:string,items?:string[]}> }|null} shelf
 */
export function buildShelfView(arts = [], shelf = null) {
  const list = Array.isArray(arts) ? arts.filter((a) => a && a.artifactId) : [];
  const labels = shelf && typeof shelf.labels === 'object' && shelf.labels ? shelf.labels : {};
  const layout = Array.isArray(shelf?.layout) ? shelf.layout : null;
  const used = new Set();
  /** @type {Array<{id:string,label?:string,items:object[]}>} */
  const folders = [];

  if (layout && layout.length) {
    for (const row of layout) {
      const id = normalizeShelfFolderId(row?.id || row?.folder || row?.label);
      if (!id) continue;
      const items = [];
      for (const rawId of Array.isArray(row.items) ? row.items : []) {
        const rec = list.find((a) => a.artifactId === rawId);
        if (rec) {
          items.push(rec);
          used.add(rec.artifactId);
        }
      }
      folders.push({ id, label: row.label || labels[id] || '', items });
    }
  }

  for (const rec of list) {
    if (used.has(rec.artifactId)) continue;
    const id = inferArtifactShelfFolder(rec);
    let bucket = folders.find((f) => f.id === id);
    if (!bucket) {
      bucket = { id, label: labels[id] || '', items: [] };
      folders.push(bucket);
    }
    bucket.items.push(rec);
  }

  const order = new Map(SHELF_FOLDER_IDS.map((id, i) => [id, i]));
  folders.sort((a, b) => {
    const ia = order.has(a.id) ? order.get(a.id) : 80;
    const ib = order.has(b.id) ? order.get(b.id) : 80;
    if (ia !== ib) return ia - ib;
    return a.id.localeCompare(b.id);
  });
  return folders.filter((f) => f.items.length);
}

export function compactShelfSnapshot(arts = [], shelf = null, lang = 'zh') {
  return buildShelfView(arts, shelf).map((f) => ({
    id: f.id,
    label: shelfFolderLabel(f.id, lang, shelf?.labels || {}),
    n: f.items.length,
    items: f.items.map((a) => a.artifactId)
  }));
}

export function setArtifactFolder(store, sessionId, artifactId, folder) {
  const rec = store.get('artifacts', artifactId);
  if (!rec || rec.sessionId !== sessionId) {
    return { ok: false, code: 'AUTH_DENIED', error: 'artifact not owned by session' };
  }
  const nextFolder = normalizeShelfFolderId(folder);
  const next = { ...rec, folder: nextFolder, updatedAt: Date.now() };
  store.put('artifacts', artifactId, next);
  return { ok: true, artifact: next };
}

export function setShelfMeta(store, sessionId, patch = {}) {
  const sess = store.get('sessions', sessionId) || { sessionId };
  const prev = sess.shelf && typeof sess.shelf === 'object' ? sess.shelf : {};
  const shelf = { ...prev };
  if (patch.labels && typeof patch.labels === 'object') {
    shelf.labels = { ...(prev.labels || {}), ...patch.labels };
  }
  if (Array.isArray(patch.layout)) {
    shelf.layout = patch.layout
      .map((row) => ({
        id: normalizeShelfFolderId(row?.id || row?.folder || row?.label),
        label: row?.label != null ? String(row.label) : undefined,
        items: Array.isArray(row?.items) ? row.items.map(String) : []
      }))
      .filter((row) => row.id);
  }
  store.put('sessions', sessionId, { ...sess, shelf, updatedAt: Date.now() });
  return { ok: true, shelf };
}

export function folderCollapsedByDefault(folderId) {
  return normalizeShelfFolderId(folderId) === 'images';
}

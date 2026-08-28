/**
 * Test-only harness: mounts the bundled tldraw Design canvas on seeded pawCanvas snapshots.
 * Hydration matches src/preview/design.js: schema snapshot if present, else assets + shapes.
 */
import { mountDesignCanvas, applyPawThemePalette } from '/src/preview/vendor/design-runtime.js';
import { createSlidesPresenter } from '/src/preview/slidesPresent.js';

const params = new URLSearchParams(location.search);
const snapName = params.get('snap') === 'after' ? 'deck-after-replace.json' : 'deck.json';
const frameId = params.get('frame') || '';
const view = params.get('view') || (frameId ? 'page' : 'overview');

const meta = document.getElementById('meta');
const engine = document.getElementById('engine');
window.__pawQa = Object.assign(window.__pawQa || {}, {
  mounted: false,
  errors: [],
  themeId: '',
  frameId,
  snapName,
  view
});

function fail(err) {
  const msg = err instanceof Error ? err.message : String(err);
  window.__pawQa.errors.push(msg);
  if (meta) meta.textContent = `error: ${msg}`;
  console.error(err);
}

window.addEventListener('error', (e) => fail(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => fail(e.reason));

function snapshotHasSchema(snap) {
  return !!(snap && (snap.schema || snap.document?.schema || (snap.store && snap.schema)));
}

/** Same createShape / createAssets payloads as engineCanvas.recordsFromPawCanvas. */
function recordsFromPawCanvas(doc) {
  const store = doc?.tldraw?.document?.store || doc?.tldraw?.store || {};
  const rawShapes = Object.values(store).filter((r) => r && r.typeName === 'shape' && r.type);
  const frames = rawShapes.filter((s) => s.type === 'frame').sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const rest = rawShapes.filter((s) => s.type !== 'frame');
  const toPayload = (rec) => {
    const payload = {
      id: rec.id,
      type: rec.type,
      x: Number(rec.x) || 0,
      y: Number(rec.y) || 0,
      rotation: Number(rec.rotation) || 0,
      props: rec.props && typeof rec.props === 'object' ? { ...rec.props } : {},
      meta: rec.meta && typeof rec.meta === 'object' ? { ...rec.meta } : {}
    };
    if (rec.parentId && String(rec.parentId).startsWith('shape:')) payload.parentId = rec.parentId;
    return payload;
  };
  const shapes = [...frames, ...rest].map(toPayload);
  const assets = [];
  const seen = new Set();
  for (const rec of Object.values(store)) {
    if (rec && rec.typeName === 'asset' && rec.id && !seen.has(rec.id)) {
      seen.add(rec.id);
      assets.push({
        id: rec.id,
        typeName: 'asset',
        type: rec.type || 'image',
        props: { ...(rec.props || {}) },
        meta: { ...(rec.meta || {}) }
      });
    }
  }
  const outShapes = [];
  for (const payload of shapes) {
    if (payload.type !== 'image') {
      outShapes.push(payload);
      continue;
    }
    const src = String(payload.meta?.src || payload.props?.url || payload.props?.src || '').trim();
    let assetId = payload.props?.assetId;
    if (!assetId && src) assetId = `asset:${String(payload.id || 'img').replace(/^shape:/, '')}`;
    if (assetId && !seen.has(assetId)) {
      seen.add(assetId);
      assets.push({
        id: assetId,
        typeName: 'asset',
        type: 'image',
        props: {
          w: Number(payload.props?.w) || 320,
          h: Number(payload.props?.h) || 200,
          name: String(payload.meta?.pawId || assetId),
          isAnimated: false,
          mimeType: 'image/svg+xml',
          src
        },
        meta: {}
      });
    }
    outShapes.push({
      ...payload,
      props: {
        w: Number(payload.props?.w) || 320,
        h: Number(payload.props?.h) || 200,
        playing: true,
        url: '',
        assetId: assetId || null,
        crop: payload.props?.crop ?? null,
        flipX: false,
        flipY: false,
        altText: String(payload.props?.altText || '')
      }
    });
  }
  return { assets, shapes: outShapes };
}

async function boot() {
  if (!engine) throw new Error('missing #engine');
  const res = await fetch(`/artifacts/qa-semantic-deck/${snapName}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`snapshot ${snapName} ${res.status}`);
  const doc = await res.json();
  const snap = doc?.tldraw;
  const themeId = String(doc?.themeId || params.get('theme') || 'ink-rose');
  const hasSchema = snapshotHasSchema(snap);
  const recs = recordsFromPawCanvas(doc);
  window.__pawQa.themeId = themeId;
  window.__pawQa.hasSchema = hasSchema;
  window.__pawQa.shapeCount = recs.shapes.length;
  window.__pawQa.assetCount = recs.assets.length;
  window.__pawQa.spreadFrames = false;
  if (meta) meta.textContent = `${snapName} · ${themeId} · ${view}${frameId ? ` · ${frameId}` : ''}`;
  const mounted = mountDesignCanvas(engine, {
    shell: 'slides',
    snapshot: hasSchema ? snap : undefined,
    themeId,
    doc,
    assets: recs.assets,
    shapes: recs.shapes,
    onHydrated(editor, api) {
      try {
        applyPawThemePalette(editor, engine, themeId);
        window.__pawQa.api = api;
        window.__pawQa.editor = editor;
        const presenter = createSlidesPresenter({ getHostApi: () => api });
        window.__pawQa.presenter = presenter;
        window.addEventListener('keydown', (e) => {
          if (!presenter.isActive()) return;
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            void presenter.step(1);
          }
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            void presenter.step(-1);
          }
          if (e.key === 'Escape') presenter.exit();
        });
        window.__pawQa.mounted = !!(editor && engine.querySelector('.tl-container'));
        window.__pawQa.tldrawThemeId = editor.getCurrentThemeId?.() || '';
        const frames = api.getLayerModel?.()?.frames || [];
        window.__pawQa.frameIds = frames.map((f) => f.id);
        const editorFrames = (editor.getCurrentPageShapesSorted?.() || []).filter((s) => s.type === 'frame');
        window.__pawQa.frameBoxes = editorFrames.map((s) => ({
          id: s.id,
          x: s.x,
          y: s.y,
          w: s.props?.w,
          h: s.props?.h,
          name: s.props?.name || ''
        }));
        if (frameId) {
          api.pinSlide?.(frameId, { view: 'page', animate: false });
        } else if (view === 'overview') {
          api.setSlideView?.('overview');
          api.fitContent?.({ animate: false });
        } else if (frames[0]?.id) {
          api.pinSlide?.(frames[0].id, { view: 'page', animate: false });
        }
        if (meta) meta.textContent += window.__pawQa.mounted ? ' · mounted' : ' · not-mounted';
      } catch (e) {
        fail(e);
      }
    }
  });
  window.__pawQa.license = mounted.license || null;
}

boot().catch(fail);

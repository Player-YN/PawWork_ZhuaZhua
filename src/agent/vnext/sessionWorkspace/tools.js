/**
 * Always-on tools for Session Workspace general agent.
 * inspect / acquire / run — host-enforced auth + real code runtime.
 *
 * HARD: SelectionGroups / WebItems / sessionBindings are NOT mutable via tools.
 * Only user/UI RPC (createGroup, bindGroups, syncTabSelection, …) may change them.
 * Guest run(code) has guest FS only — no store, no chrome, no group APIs.
 */

import { acquireLease } from './execution.js';
import {
  createArtifact,
  updateArtifactContent,
  listArtifacts,
  registerWrittenArtifacts
} from './artifacts.js';
import { getBoundGroupsCompact, listGroupItems } from './groups.js';
import {
  assertGroupReadable,
  assertItemReadable,
  assertArtifactOwned,
  isItemBoundToSession
} from './auth.js';
import { run as runCodePrimitive } from '../primitives/run.js';
import { acquire as acquirePrimitive } from '../primitives/acquire.js';
import { generateSessionImage } from './imageGen.js';
import { guessMimeFromName } from './artifactValidate.js';
import { coerceToUint8Array } from './fs.js';
import { readHtmlPreviewKind } from './htmlPreviewMarker.js';
import {
  getSkill,
  listPackagedSkillCatalog,
  loadSkillInstructions,
  loadSkillResource,
  resolveSkillId,
  skillIdAliases
} from '../skills/registry.js';
import {
  getDurableSkillStore,
  mergeSkillCatalog,
  mergeSkillRecord,
  skillRecordFromMarkdown,
  importSkillFromUrl,
  normalizeDurableSkill,
  writeSkillPackToGuest
} from './skillStore.js';
import { ensureItemPixels, looksLikeImageItem } from './itemPixels.js';
import { ensureItemLabel, labeledItemView, resolveBoundItemRef } from './itemLabel.js';
import { resolveAcquireFetch } from './pageItems.js';
import {
  newClarifyId,
  normalizeClarifyQuestions,
  waitForClarifyAnswer
} from './clarifyGate.js';
import {
  applyCommandsToWorkbookData,
  capRangeRead,
  inspectSheetSelection,
  overviewFromWorkbookData,
  sheetsToWorkbookData,
  workbookDataToSheets,
  normalizeCommands,
  classifySheetImageSrc
} from './sheetApply.js';
import { extractWorkbookSnapshot } from '../../../preview/sheetModel.js';
import { inspectHtml } from './htmlApply.js';
import { createScene, isSceneCreateCommand, unwrapSceneCreateInput } from './sceneCompile.js';
import { gateCompiledScene, qaFailurePayload } from './canvasQaGate.js';
import { htmlWritePolicy } from './htmlWritePolicy.js';
import {
  isOwnedPawCanvas,
  kindFromOwnedCanvas,
  rememberVisualCreation,
  resolveVisualCreateTarget,
  resolveWorkbookCreateTarget
} from './visualCreationLedger.js';
import { stampSiteHtml, listSiteNodes, pinnedSiteIds, siteSelectionsFromIds } from './siteApply.js';
import { SITE_MOTION_CAPABILITY } from './siteMotionSchema.js';
import { applyRasterCrops, isRasterCompileInput, rasterItemRef } from './rasterCompile.js';
import { rasterPixelsFromSrc, resolveRasterScanNodes, shouldAutoScan } from './rasterScan.js';
import {
  hydratePawCanvasImages,
  isPawCanvasDoc,
  listEngineNodes,
  parsePawCanvas,
  summarizeImageSrc,
  unresolvedEngineImages
} from './engineCanvas.js';
import { guestPathToDataUrl, isGuestArtifactPath, rewriteGuestImageSrcs } from './htmlMedia.js';
import { applyDocCommands, emptyDocSnapshot } from './docsApply.js';
import { pdfBytesToHtml, looksLikePdf, PDF_RECONSTRUCTION_WARNING } from './pdfIngest.js';
import { classifyOpenArtifact, isUtf8OpenKind } from './openClassify.js';
import { resolveHtmlUpsertTarget } from './htmlArtboard.js';
import { createOfficeTools } from './officeTools.js';
import {
  attachCanvasPreview,
  requestCanvasPreview,
  sessionToolToModelOutput
} from './canvasPreview.js';
import {
  compactShelfSnapshot,
  setArtifactFolder,
  setShelfMeta
} from './artifactShelf.js';
import { hydrateOfficeImageCommands, hydrateSheetImageCommands, HTML_IMAGE_OPS, officeImageRef, resolveOfficeAsset } from './sheetImageHydrate.js';
import {
  aoaToCsv,
  bytesToUtf8,
  isSheetArtifact,
  parseDelimited,
  sheetKindFromArtifact
} from '../../../preview/sheetCodec.js';
import { pageBytes, pageTextByCodePoint } from './textPage.js';

/**
 * @param {object} env
 * @param {import('./store.js').SessionWorkspaceStore} env.store
 * @param {object} env.execution
 * @param {ReturnType<import('./fs.js').createSessionGuestFs>} env.fs
 * @param {string} env.sessionId
 * @param {AbortSignal} [env.signal]
 * @param {typeof fetch} [env.fetchImpl]
 */
export function createSessionTools(env) {
  const { store, execution, fs, sessionId } = env;
  const signal = env.signal || execution?.abortSignal;
  const fetchImpl = env.fetchImpl || globalThis.fetch;
  const onEvent = typeof env.onEvent === 'function' ? env.onEvent : null;

  async function hydrateSceneImageNodes(store, sessionId, fs, sceneCmd, env = {}) {
    const next = { ...sceneCmd };
    const resolve = (ref) => resolveOfficeAsset(store, sessionId, ref, { fs, ...env });
    const one = async (n) => {
      if (!n || typeof n !== 'object') return n;
      const src = officeImageRef(n, { allowValue: false });
      if (!src) return n;
      const hit = await resolve(src);
      return hit.ok ? { ...n, src: hit.src } : n;
    };
    if (Array.isArray(next.nodes)) next.nodes = await Promise.all(next.nodes.map(one));
    if (Array.isArray(next.frames)) {
      next.frames = await Promise.all(
        next.frames.map(async (fr) => ({
          ...fr,
          nodes: Array.isArray(fr.nodes) ? await Promise.all(fr.nodes.map(one)) : fr.nodes
        }))
      );
    }
    return next;
  }

  function canvasArtifactName(name, kind) {
    const raw = String(name || '').trim();
    if (/\.json$/i.test(raw)) return raw;
    const stem = raw.replace(/\.(html?|htm)$/i, '') || (kind === 'deck' ? 'slides' : 'design');
    return `${stem}.json`;
  }

  function emitCanvasPreview(rec, built) {
    if (!onEvent || !rec) return;
    try {
      onEvent({
        type: 'artifact_preview',
        sessionId,
        artifactId: rec.artifactId,
        kind: 'design',
        shell: built?.kind === 'deck' ? 'slides' : 'design',
        name: rec.name,
        path: rec.primaryPath
      });
    } catch {
      /* UI listener must not fail the tool */
    }
  }

  function emitLiveCanvasUpdated(artifactId) {
    if (!onEvent || !artifactId) return;
    try {
      onEvent({ type: 'html_canvas_updated', sessionId, artifactId });
    } catch {
      /* UI listener must not fail the tool */
    }
  }

  function htmlPreviewKind(content) {
    const head =
      typeof content === 'string'
        ? content.slice(0, 8000)
        : content instanceof Uint8Array
          ? new TextDecoder().decode(content.slice(0, 8000))
          : String(content || '').slice(0, 8000);
    if (/data-paw-kind\s*=\s*["'](site|web)["']/i.test(head)) return 'site';
    return readHtmlPreviewKind(content);
  }

  function emitHtmlPreviewIfMarked(rec, content) {
    if (!onEvent || !rec || !execution) return;
    let bytes = content;
    if (bytes == null && rec.primaryPath) {
      try {
        bytes = fs.readFileBytes(rec.primaryPath);
      } catch {
        return;
      }
    }
    const kind = htmlPreviewKind(bytes);
    if (kind !== 'blocks' && kind !== 'site') return;
    if (!execution.htmlPreviewEmitted) {
      execution.htmlPreviewEmitted = true;
      try {
        onEvent({
          type: 'artifact_preview',
          sessionId,
          artifactId: rec.artifactId,
          kind,
          name: rec.name,
          path: rec.primaryPath
        });
      } catch {
        /* UI listener must not fail the tool */
      }
      return;
    }
    emitHtmlCanvasUpdated(rec);
  }

  function emitHtmlCanvasUpdated(rec) {
    if (!onEvent || !rec) return;
    try {
      onEvent({
        type: 'html_canvas_updated',
        sessionId,
        artifactId: rec.artifactId
      });
    } catch {
      /* UI listener must not fail the tool */
    }
  }

  function executeShelfOp(input = {}) {
    const commands = Array.isArray(input.commands) ? input.commands : [];
    const applied = [];
    if (input.artifactId && (input.folder || input.shelf)) {
      const one = setArtifactFolder(store, sessionId, String(input.artifactId), input.folder || input.shelf);
      if (!one.ok) return { ok: false, op: 'shelf', error: one.error, code: one.code };
      applied.push({ op: 'setFolder', artifactId: String(input.artifactId), folder: one.artifact.folder });
    }
    for (const cmd of commands) {
      if (!cmd || typeof cmd !== 'object') continue;
      const cop = String(cmd.op || cmd.act || '');
      if (cop === 'setFolder' || cop === 'set') {
        const one = setArtifactFolder(store, sessionId, String(cmd.artifactId || ''), cmd.folder || cmd.shelf || cmd.label);
        if (!one.ok) return { ok: false, op: 'shelf', error: one.error, code: one.code, applied };
        applied.push({ op: 'setFolder', artifactId: one.artifact.artifactId, folder: one.artifact.folder });
      } else if (cop === 'renameFolder') {
        const id = String(cmd.folder || cmd.id || '');
        const label = String(cmd.label || cmd.name || '').trim();
        if (!id || !label) continue;
        setShelfMeta(store, sessionId, { labels: { [id]: label } });
        applied.push({ op: 'renameFolder', folder: id, label });
      } else if (cop === 'setLayout') {
        const layout = Array.isArray(cmd.folders) ? cmd.folders : cmd.layout;
        if (!Array.isArray(layout)) continue;
        setShelfMeta(store, sessionId, { layout });
        applied.push({ op: 'setLayout', n: layout.length });
      }
    }
    const arts = listArtifacts(store, sessionId);
    const sess = store.get('sessions', sessionId) || {};
    const shelf = compactShelfSnapshot(arts, sess.shelf);
    if (onEvent) {
      try {
        onEvent({ type: 'artifact_shelf_updated', sessionId, shelf });
      } catch {
        /* UI listener must not fail the tool */
      }
    }
    return {
      ok: true,
      op: 'shelf',
      applied,
      shelf
    };
  }

  const hostSheet = typeof env.hostSheet === 'function' ? env.hostSheet : null;
  const hostCanvas = typeof env.hostCanvas === 'function' ? env.hostCanvas : null;

  async function callSheetHost(payload) {
    if (!hostSheet) return null;
    try {
      const promptId = String(env.promptId || execution?.executionId || '');
      return await hostSheet({ ...payload, promptId });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  function loadWorkbookFromArtifact(artifactId) {
    const gate = assertArtifactOwned(store, sessionId, artifactId);
    if (!gate.ok) return { ok: false, error: gate.error, code: gate.code };
    const rec = gate.record;
    if (!isSheetArtifact(rec)) {
      return {
        ok: false,
        error: 'artifact is not a spreadsheet',
        code: 'NOT_SHEET',
        hint: 'pass a sheet artifactId, or create one with run createWorkbook'
      };
    }
    const bytes = fs.readFileBytes(rec.primaryPath);
    const kind = sheetKindFromArtifact(rec);
    if (kind === 'xlsx') {
      const snap = extractWorkbookSnapshot(bytes);
      if (snap) {
        return {
          ok: true,
          rec,
          kind,
          sheets: workbookDataToSheets(snap),
          data: snap
        };
      }
      return {
        ok: false,
        error: 'xlsx inspect needs the live sheet tab',
        code: 'NEED_TAB',
        hint: 'open the live sheet tab and retry inspect',
        rec
      };
    }
    const text = bytesToUtf8(bytes);
    const sheets = [{ name: 'Sheet1', rows: parseDelimited(text, kind) }];
    return { ok: true, rec, kind, sheets, data: sheetsToWorkbookData(sheets, rec.name) };
  }

  const inspect = {
    name: 'inspect',
    description:
      'Read session context: bound page captures, workspace files, skill playbooks, workbook/range samples, and HTML/canvas structure. Views: groups, group, item, artifacts, files, skill, workbook, range, html. File reads (view=files + path to a file): offset is a Unicode code-point offset and maxChars bounds the returned slice; response includes offset, nextOffset, totalChars, eof. Listing pagination (directories) still uses offset/limit.',
    parameters: {
      type: 'object',
      properties: {
        view: { type: 'string', description: 'groups | group | item | artifacts | files | skill | workbook | range | html' },
        plateId: { type: 'string', description: 'HTML plate id (view=html)' },
        slotId: { type: 'string', description: 'HTML slot id (view=html)' },
        a1: { type: 'string', description: 'A1 range (view=range)' },
        sheet: { type: 'string', description: 'Sheet name (view=range)' },
        artifactId: { type: 'string', description: 'Artifact id; workbook/range default to the focused workbook' },
        groupId: { type: 'string' },
        itemId: { type: 'string', description: 'Item id or sticky handle (image1 / 图片1)' },
        skillId: { type: 'string', description: 'Skill catalog id (view=skill)' },
        path: { type: 'string' },
        offset: {
          type: 'number',
          description:
            'Directory listing offset, or Unicode code-point offset when reading a file (binary files: byte offset)'
        },
        limit: { type: 'number', description: 'Listing page size' },
        maxChars: {
          type: 'number',
          description: 'Returned text bound for file reads (Unicode code points; default 12000, max 50000)'
        },
        includeMedia: { type: 'boolean', description: 'Include image bytes for multimodal item inspect' }
      }
    },
    async execute(input = {}) {
      const view = String(input.view || 'groups');
      if (view === 'groups') {
        return { ok: true, view, groups: getBoundGroupsCompact(store, sessionId) };
      }
      if (view === 'group') {
        const groupId = String(input.groupId || '');
        const gate = assertGroupReadable(store, sessionId, groupId);
        if (!gate.ok) return { ok: false, error: gate.error, code: gate.code };
        const offset = Math.max(0, Number(input.offset) || 0);
        const limit = Math.max(1, Math.min(Number(input.limit) || 50, 100));
        const all = listGroupItems(store, groupId);
        const page = all.slice(offset, offset + limit).map((it) => {
          const labeled = ensureItemLabel(store, it, { groupId }).item;
          const handle = labeledItemView(labeled);
          return {
            webItemId: labeled.webItemId,
            kindHint: labeled.kindHint,
            handle: handle?.handle || '',
            label: handle?.label || '',
            preview: summarizeCapture(labeled.capture)
          };
        });
        for (const it of page) acquireLease(store, execution, it.webItemId);
        return {
          ok: true,
          view,
          groupId,
          items: page,
          total: all.length,
          offset,
          limit,
          hasMore: offset + limit < all.length
        };
      }
      if (view === 'item') {
        const itemRef = input.itemId || input.item || input.handle || '';
        const itemId = resolveBoundItemRef(store, sessionId, itemRef) || String(itemRef || '');
        const gate = assertItemReadable(store, sessionId, itemId);
        if (!gate.ok) return { ok: false, error: gate.error, code: gate.code };
        const item = store.get('items', itemId);
        acquireLease(store, execution, itemId);
        const media = await materializeItemMedia(store, item, input.includeMedia !== false, {
          fetchImpl,
          signal,
          onEvent
        });
        // modelParts live only at top level (toModelOutput input) — duplicating
        // them inside `item` doubles every image payload downstream.
        const { modelParts: itemModelParts, ...mediaMeta } = media;
        const labeled = ensureItemLabel(store, item).item;
        const handle = labeledItemView(labeled);
        return {
          ok: true,
          view,
          item: {
            webItemId: labeled.webItemId,
            kindHint: labeled.kindHint,
            handle: handle?.handle || '',
            label: handle?.label || '',
            capture: stripHeavyCapture(labeled.capture),
            text: labeled.capture?.text || labeled.capture?.preview?.textSnippet || null,
            src: compactSrc(labeled.capture?.src) || null,
            ...mediaMeta
          },
          /** Model-facing multimodal parts when pixels available */
          modelParts: itemModelParts || []
        };
      }
      if (view === 'workbook' || view === 'range') {
        const sess = store.get('sessions', sessionId) || {};
        const artifactId =
          String(input.artifactId || sess.activeWorkbook?.artifactId || '').trim();
        if (hostSheet && artifactId) {
          const res = await callSheetHost({
            method: view === 'range' ? 'range' : 'overview',
            artifactId,
            a1: input.a1 || 'A1:Z20',
            sheet: input.sheet
          });
          const body = res?.result || res;
          if (body && body.ok !== false) {
            // Host already capRangeRead'd the live book at the requested A1.
            // Do not wrap values as a new sheet at A1 — that recaps H58 as A1.
            return { ok: true, view, artifactId, ...body };
          }
        }
        if (!artifactId) {
          return {
            ok: true,
            view,
            overview: sess.activeWorkbook?.overview || null,
            note: 'no live workbook yet; run op=sheet createWorkbook to create one'
          };
        }
        const loaded = loadWorkbookFromArtifact(artifactId);
        if (!loaded.ok) return loaded;
        if (view === 'range') {
          const read = inspectSheetSelection(loaded.data, input.a1 || 'A1:Z20', input.sheet);
          return {
            ok: true,
            view,
            artifactId,
            overview: overviewFromWorkbookData(loaded.data),
            ...read
          };
        }
        return {
          ok: true,
          view,
          artifactId,
          overview: overviewFromWorkbookData(loaded.data)
        };
      }
      if (view === 'html') {
        const sess = store.get('sessions', sessionId) || {};
        const artifactId = String(
          input.artifactId || sess.activeHtml?.artifactId || sess.activeWorkbook?.artifactId || ''
        ).trim();
        if (!artifactId) return { ok: false, view, error: 'no html artifact' };
        const gate = assertArtifactOwned(store, sessionId, artifactId);
        if (!gate.ok) return { ok: false, error: gate.error, code: gate.code };
        const rec = listArtifacts(store, sessionId).find((a) => a.artifactId === artifactId);
        if (!rec) return { ok: false, view, error: 'artifact not found' };
        let html = '';
        try {
          html = bytesToUtf8(fs.readFileBytes(rec.primaryPath));
        } catch (e) {
          return { ok: false, view, error: e instanceof Error ? e.message : String(e) };
        }
        const selected = pinnedSiteIds(sess.activeHtml?.selections);
        if (isPawCanvasDoc(html)) {
          const doc = parsePawCanvas(html);
          const nodes = listEngineNodes(doc);
          const hit =
            nodes.find((n) => n.nodeId === input.nodeId || n.nodeId === input.slotId) ||
            nodes.find((n) => selected.includes(n.nodeId)) ||
            null;
          return {
            ok: true,
            view,
            artifactId,
            kind: doc.shell === 'slides' ? 'deck' : 'poster',
            nodes: nodes.map((n) => ({
              id: n.nodeId,
              slotId: n.nodeId,
              type: n.type,
              text: n.text,
              src: summarizeImageSrc(n.src)
            })),
            nodeId: hit?.nodeId,
            slotId: hit?.nodeId,
            slot: hit,
            selected
          };
        }
        if (/data-paw-kind\s*=\s*["']site["']/i.test(html)) {
          const nodes = listSiteNodes(html);
          return {
            ok: true,
            view,
            artifactId,
            kind: 'site',
            nodes,
            available: nodes.map((n) => n.nodeId),
            selected,
            selections: siteSelectionsFromIds(html, selected),
            motion: SITE_MOTION_CAPABILITY
          };
        }
        const inspected = inspectHtml(html, { plateId: input.plateId, slotId: input.slotId });
        return { ok: inspected.ok !== false, view, artifactId, selected, ...inspected };
      }
      if (view === 'artifacts') {
        return {
          ok: true,
          view,
          artifacts: listArtifacts(store, sessionId).map((a) => ({
            id: a.artifactId,
            name: a.name,
            path: a.primaryPath,
            mimeType: a.mimeType,
            size: a.size,
            folder: a.folder || ''
          })),
          shelf: compactShelfSnapshot(
            listArtifacts(store, sessionId),
            (store.get('sessions', sessionId) || {}).shelf
          )
        };
      }
      if (view === 'files') {
        const path = String(input.path || '/artifacts');
        const maxChars = Math.max(500, Math.min(Number(input.maxChars) || 12000, 50000));
        if (path === '/scratch' || path.startsWith('/scratch/skills')) {
          await hydrateSkillScriptsIntoGuest(fs);
        }
        try {
          if (fs.exists(path) && !path.endsWith('/')) {
            try {
              const bytes = fs.readFileBytes(path);
              const textLike = isProbablyText(path, bytes);
              const offset = Math.max(0, Number(input.offset) || 0);
              if (textLike) {
                const text = new TextDecoder().decode(bytes);
                const page = pageTextByCodePoint(text, offset, maxChars);
                return {
                  ok: true,
                  view,
                  path,
                  content: page.content,
                  truncated: page.truncated,
                  offset: page.offset,
                  nextOffset: page.nextOffset,
                  totalChars: page.totalChars,
                  eof: page.eof,
                  unit: page.unit,
                  size: bytes.byteLength
                };
              }
              const bin = pageBytes(bytes, offset, Math.min(maxChars, 4096));
              return {
                ok: true,
                view,
                path,
                content: null,
                truncated: bin.truncated,
                offset: bin.offset,
                nextOffset: bin.nextOffset,
                totalChars: bin.totalBytes,
                eof: bin.eof,
                unit: bin.unit,
                bytes: bin.bytes,
                size: bytes.byteLength
              };
            } catch (e) {
              if (!/ENOENT/i.test(e instanceof Error ? e.message : String(e))) throw e;
            }
          }
          const listing = fs.list(path);
          const offset = Math.max(0, Number(input.offset) || 0);
          const limit = Math.max(1, Math.min(Number(input.limit) || 100, 200));
          return {
            ok: true,
            view,
            path,
            listing: listing.slice(offset, offset + limit),
            total: listing.length,
            offset,
            limit,
            hasMore: offset + limit < listing.length
          };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
      }
      if (view === 'skill' || view === 'skills') {
        const requestedId = String(input.skillId || input.id || '').trim();
        if (!requestedId) {
          return {
            ok: true,
            view: 'skills',
            catalog: mergeSkillCatalog(
              listPackagedSkillCatalog(),
              await getDurableSkillStore().list()
            ).map((s) => ({ id: s.id, name: s.name, description: s.description }))
          };
        }
        const skillId = resolveSkillId(requestedId);
        const packed = getSkill(skillId);
        const durable = await getDurableSkillStore().get(requestedId);
        const skill = mergeSkillRecord(packed, durable);
        if (!skill) {
          return {
            ok: false,
            error: `unknown skill ${requestedId}`,
            code: 'NOT_FOUND',
            hint: 'inspect view=skill without skillId to list the catalog'
          };
        }
        const resourcePath = String(input.path || '').trim();
        const playbookRaw =
          durable?.instructions || loadSkillInstructions(skillId, { sessionId }) || skill.instructions || '';
        const playbook = typeof playbookRaw === 'function' ? playbookRaw() : playbookRaw;
        if (resourcePath) {
          const resolved = resolveSkillGuestResource(requestedId, resourcePath);
          if (resolved.kind === 'playbook') {
            return { ok: true, view: 'skill', skillId, path: resolved.path, content: playbook };
          }
          const fromDurable = durable?.resources?.[resolved.path];
          const content = fromDurable != null ? fromDurable : loadSkillResource(skillId, resolved.path);
          if (content == null) {
            return {
              ok: false,
              error: `unknown skill resource ${resourcePath}`,
              code: 'NOT_FOUND',
              hint: 'inspect view=skill without path to list resourcePaths'
            };
          }
          return { ok: true, view: 'skill', skillId, path: resolved.path, content };
        }
        return {
          ok: true,
          view: 'skill',
          skillId,
          name: skill.name,
          description: skill.description,
          origin: skill.origin || 'packaged',
          playbook,
          resources: Object.keys(skill.resources || {}),
          guestRoot: `/scratch/skills/${skillId}`
        };
      }
      return {
        ok: false,
        error: `unknown view ${view}`,
        code: 'BAD_INPUT',
        hint: 'use inspect view=groups|item|files|workbook|range|skill|html'
      };
    },
    /**
     * Prefer multimodal parts when inspect returned image bytes.
     * @param {{ output?: any }} opts
     */
    toModelOutput(opts = {}) {
      const o = opts.output || {};
      if (Array.isArray(o.modelParts) && o.modelParts.length) {
        const value = [];
        for (const p of o.modelParts) {
          if (!p || typeof p !== 'object') continue;
          if (p.type === 'text' && p.text) {
            value.push({ type: 'text', text: String(p.text) });
            continue;
          }
          if ((p.type === 'file' || p.type === 'file-data') && (p.data || p.image)) {
            const raw = typeof p.data === 'object' && p.data?.data != null ? p.data.data : p.data ?? p.image;
            const data = typeof raw === 'string' ? raw : bytesToBase64(raw);
            if (data) {
              value.push({
                type: 'file',
                data: { type: 'data', data },
                mediaType: p.mediaType || 'image/png'
              });
            }
            continue;
          }
          if (p.type === 'image') {
            const raw = p.image ?? p.data;
            const data = typeof raw === 'string' ? raw : bytesToBase64(raw);
            if (data) {
              value.push({
                type: 'file',
                data: { type: 'data', data },
                mediaType: p.mediaType || 'image/png'
              });
            }
          }
        }
        if (value.length) return { type: 'content', value };
      }
      const json = { ...o };
      delete json.modelParts;
      delete json.imageBase64;
      return { type: 'json', value: json };
    }
  };

  const acquire = {
    name: 'acquire',
    description:
      'Bring external information or generated images into the session. Actions: search, fetch, map, crawl, image, note. action=fetch url accepts a public http(s) URL or a bound page alias (页面N / pageN / wi_…).',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['search', 'fetch', 'map', 'crawl', 'note', 'image'] },
        query: {
          type: 'string',
          description: 'Search string; optional in-site filter for map'
        },
        url: {
          type: 'string',
          description: 'Public http(s) URL for fetch, map, or crawl'
        },
        text: { type: 'string', description: 'Note body' },
        filename: { type: 'string' },
        limit: { type: 'number', description: 'Hit cap for search/map; crawl page count is host-capped' },
        prompt: { type: 'string', description: 'Image generation prompt' },
        itemIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Bound image handles or WebItem ids for image-to-image'
        },
        allowText: {
          type: 'boolean',
          description: 'Image only. When true, generation may include lettering. Default false.'
        },
        aspect_ratio: { type: 'string' },
        model: { type: 'string', description: 'Optional image-model override' }
      },
      required: ['action']
    },
    async execute(input = {}) {
      if (signal?.aborted) return { ok: false, error: 'aborted' };
      const action = String(input.action || 'note');
      fs.mkdirp('/scratch/sources');

      if (action === 'image') {
        const prompt = String(input.prompt || '').trim();
        if (!prompt) {
          return {
            ok: false,
            action: 'image',
            code: 'MISSING_PROMPT',
            error: 'image needs prompt',
            hint: 'retry acquire action=image with prompt'
          };
        }
        return generateSessionImage({
          store,
          fs,
          sessionId,
          prompt,
          filename: input.filename,
          itemIds: input.itemIds,
          allowText: input.allowText === true,
          aspectRatio: input.aspect_ratio || input.aspectRatio,
          model: input.model,
          fetchImpl: fetchImpl || globalThis.fetch,
          signal,
          onEvent,
          settings: env.settings
        });
      }

      if (action === 'note') {
        const body = JSON.stringify(
          { action: 'note', text: input.text || null, at: Date.now() },
          null,
          2
        );
        const path = `/scratch/sources/note_${Date.now().toString(36)}.json`;
        fs.writeFile(path, body, { mimeType: 'application/json' });
        return { ok: true, action, path };
      }

      // Real search/fetch via shared primitive; map /work/sources → /scratch/sources
      const codeFs = createCodeFsBridge(fs);
      let fetchUrl = input.url;
      let fetchMeta = null;
      if (action === 'fetch') {
        const resolved = await resolveAcquireFetch(
          {
            store,
            sessionId,
            fs,
            hostFindTab: env.hostFindTab,
            hostPageCapture: env.hostPageCapture
          },
          input
        );
        if (!resolved.ok) return resolved;
        if (resolved.pathUsed === 'content-script' && !resolved.deferFetch) {
          return resolved;
        }
        fetchUrl = resolved.url;
        fetchMeta = resolved;
      }
      const result = await acquirePrimitive(
        {
          fs: codeFs,
          signal,
          fetchImpl: fetchImpl || globalThis.fetch,
          webAcquire: env.webAcquire
        },
        {
          action,
          query: input.query,
          url: fetchUrl,
          filename: input.filename,
          limit: input.limit
        }
      );
      // Remap reported path for session guest
      if (result?.path && String(result.path).startsWith('/work/sources/')) {
        result.path = '/scratch/sources/' + String(result.path).slice('/work/sources/'.length);
      }
      if (result && typeof result === 'object') {
        const out = { ...result };
        delete out.provider;
        if (out.source && out.source !== 'http') out.source = 'scrape';
        if (fetchMeta) {
          out.pathUsed = 'fetch';
          if (fetchMeta.itemId) out.itemId = fetchMeta.itemId;
          if (fetchMeta.via) out.via = fetchMeta.via;
        }
        return out;
      }
      return result;
    }
  };

  const run = {
    name: 'run',
    description:
      'Execute sandboxed JS/TS and create durable session artifacts: files, workbooks, Design/Slides canvases, documents, sites, and PDF ingest. Guest code reads session files with await fs.readFile(path) (/context ro, /artifacts, /scratch). createScene / fromPage / fromRaster compile a canvas. Default is fail-closed reuse: an open/selected/explicit deck is updated; with no deck the first createScene may create one; further same-kind creates in this turn bind to that artifact. Two or more matching canvases and no target returns AMBIGUOUS_CANVAS — pass artifactId. createWorkbook reuses the open or only workbook (artifactMode:"new" is the only way to create a second book; two books and no target returns AMBIGUOUS_WORKBOOK). artifactMode:"new" is the only way to create a second same-kind visual (at most one extra per kind per turn). write_artifact cannot create pawCanvas. Empty createScene is rejected. Visual scenes prefer themeId + frames[{layoutId,slots}] (host compiles geometry); slots.visual accepts {kind:icon|motif|chart|image} without x/y/w/h. Search icons via deck act=read catalog="icons". Image brief via deck act=read catalog="image-brief" layoutId themeId subject — then acquire action=image; compile does not generate images. raw frames[].nodes remains a freeform escape hatch. Daily field edits use deck. op=shelf sets deliverable-rail folders the user sees.',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'JavaScript/TypeScript source to execute in sandbox' },
        entry: { type: 'string' },
        entryFile: { type: 'string' },
        files: { type: 'object', additionalProperties: { type: 'string' } },
        timeoutMs: { type: 'number' },
        op: {
          type: 'string',
          enum: RUN_OPS,
          description:
            'write_artifact | update_artifact | write_scratch | read | write_package_file | sheet | html | createScene | fromPage | fromSelection | fromRaster | fromImage | page | raster | doc | ingestPdf | skill | shelf | createWorkbook | createDocument'
        },
        scan: {
          type: 'string',
          description: 'fromRaster: "auto" runs host quantize+CCA; omit or false to skip'
        },
        size: {
          type: 'object',
          description: 'fromRaster/createScene paper size {w,h} in pixels; defaults to source image or kind paper',
          properties: {
            w: { type: 'number' },
            h: { type: 'number' }
          }
        },
        name: { type: 'string' },
        artifactId: { type: 'string' },
        path: { type: 'string' },
        content: { type: 'string' },
        mimeType: { type: 'string' },
        themeId: { type: 'string', description: 'Semantic canvas theme: hanbai | ink-rose | midnight-cyan | forest | studio-amber | editorial | cobalt | mono' },
        variant: { type: 'string', description: 'Optional page variant inside the theme: paper | surface | accent | dark' },
        kind: { type: 'string', description: 'deck | poster | design' },
        artifactMode: {
          type: 'string',
          description:
            'Omit to reuse/fail-close. "new" creates at most one extra same-kind Design/Slides/workbook artifact in this turn, then reuses it. Explicit artifactId always wins.'
        },
        title: { type: 'string' },
        frames: {
          type: 'array',
          description: 'Semantic plates: [{layoutId,slots}] or raw nodes. Host owns geometry.',
          items: { type: 'object' }
        },
        html: { type: 'string' },
        nodes: { type: 'array', items: { type: 'object' } },
        fragments: { type: 'array', items: { type: 'object' } },
        item: { type: 'string' },
        regions: { type: 'array', items: { type: 'object' } },
        layoutId: { type: 'string' },
        slots: { type: 'object' },
        commands: {
          type: 'array',
          description:
            'Host ops: createWorkbook, createScene, fromPage, fromSelection, fromRaster, createDocument',
          items: { type: 'object' }
        }
      }
    },
    async execute(input = {}) {
      if (signal?.aborted) return { ok: false, error: 'aborted' };

      const opEarly = String(input.op || '');
      if (opEarly === 'skill') {
        return executeSkillOp(input, { fetchImpl, signal });
      }
      if (opEarly === 'shelf') {
        return executeShelfOp(input);
      }
      const sceneFirst = isSceneRunInput(input, opEarly);
      const sheetFirst =
        !sceneFirst &&
        (opEarly === 'sheet' ||
          opEarly === 'createWorkbook' ||
          (Array.isArray(input.commands) &&
            input.commands.length > 0 &&
            !['write_scratch', 'html', 'doc', 'ingestPdf', 'skill'].includes(opEarly)));

      // ── Code execution path (product coding runtime) ──
      if (!sheetFirst && input.code != null && String(input.code).trim() !== '') {
        await hydrateSkillScriptsIntoGuest(fs);
        const codeText = String(input.code);
        if (codeText.length > 8000) {
          return {
            ok: false,
            op: 'code',
            error:
              'code exceeds 8000 chars. For spreadsheet transforms use the sheet tool (reshapeSplit / applyGrid); do not embed the grid in code.'
          };
        }
        const codeFs = createCodeFsBridge(fs);
        const result = await runCodePrimitive(
          { fs: codeFs, signal, timeoutMs: input.timeoutMs },
          {
            code: String(input.code),
            entry: input.entry,
            entryFile: input.entryFile,
            files: input.files,
            timeoutMs: input.timeoutMs
          }
        );
        const written = Array.isArray(result.writtenFiles) ? result.writtenFiles : [];
        const guestWritten = written.map(mapHostToGuest).filter(Boolean);
        const { created, rejected } = registerWrittenArtifacts(store, fs, sessionId, guestWritten);
        for (const rec of created) emitHtmlPreviewIfMarked(rec);
        const truthFail = rejected.length > 0;
        return {
          ok: result.exitStatus === 0 && !result.error && !truthFail,
          op: 'code',
          exitStatus: result.exitStatus,
          stdout: result.stdout,
          stderr: result.stderr,
          writtenFiles: guestWritten.length ? guestWritten : written,
          duration: result.duration,
          error:
            result.error ||
            (truthFail
              ? `artifact truth rejected: ${rejected.map((r) => `${r.path}: ${r.error}`).join('; ')}`
              : null),
          runtime: result.runtime || null,
          rejected,
          artifacts: created.map((a) => ({
            id: a.artifactId,
            name: a.name,
            path: a.primaryPath
          }))
        };
      }

      let op = String(input.op || '') || (sheetFirst ? 'sheet' : sceneFirst ? 'html' : '');
      if (SCENE_RUN_OPS.has(op) && op !== 'html') op = 'html';
      if (op === 'createWorkbook') op = 'sheet';
      if (op === 'createDocument') op = 'doc';
      if (op === 'sheet') {
        if (signal?.aborted) return { ok: false, op, error: 'aborted' };
        const resolveApplyGrid = (list) =>
          list.map((cmd) => {
            if (cmd.op !== 'applyGrid' || Array.isArray(cmd.values)) return cmd;
            const p = String(cmd.scratchPath || cmd.path || '');
            if (!p) return cmd;
            try {
              const text = bytesToUtf8(fs.readFileBytes(p));
              const parsed = JSON.parse(text);
              const values = Array.isArray(parsed) ? parsed : parsed?.values;
              if (!Array.isArray(values)) return cmd;
              return { ...cmd, values };
            } catch {
              return cmd;
            }
          });
        const emitSheetThought = (body, creating) => {
          if (!onEvent) return;
          const mark = body?.readback;
          const text =
            mark?.sheet && mark?.a1
              ? `已写入 ${mark.sheet}!${mark.a1}`
              : creating
                ? '正在创建表格…'
                : '正在写入草稿…';
          try {
            onEvent({ type: 'thought', text });
          } catch {
            /* ignore */
          }
        };
        let commands = await hydrateSheetImageCommands(
          store,
          sessionId,
          resolveApplyGrid(normalizeCommands(input.commands || input.ops)),
          { fetchImpl, onEvent }
        );
        if (!commands.length && (opEarly === 'createWorkbook' || Array.isArray(input.sheets))) {
          commands = [
            {
              op: 'createWorkbook',
              name: input.name,
              sheets: input.sheets,
              kind: input.kind
            }
          ];
        }
        if (!commands.length) {
          return { ok: false, op, error: 'sheet requires commands[]' };
        }
        const sess = store.get('sessions', sessionId) || {};
        const creating = commands.some((c) => c.op === 'createWorkbook');
        if (!creating) {
          return {
            ok: false,
            op,
            code: 'USE_OFFICE_TOOL',
            error:
              'Daily sheet edits use the sheet tool after a workbook artifact exists. run op=sheet is createWorkbook only.'
          };
        }
        const seed = commands.find((c) => c.op === 'createWorkbook') || {};
        const rest = commands.filter((c) => c.op !== 'createWorkbook');
        const artifactMode = readArtifactMode(input, seed, commands);
        const resolved = resolveWorkbookCreateTarget(store, fs, sessionId, execution, {
          explicitId: String(input.artifactId || seed.artifactId || '').trim(),
          focusedId: String(sess.activeWorkbook?.artifactId || '').trim(),
          artifactMode
        });
        if (!resolved.ok) {
          return {
            ok: false,
            op,
            code: resolved.code,
            error: resolved.error,
            ...(resolved.candidates ? { candidates: resolved.candidates } : {})
          };
        }
        const applyWorkbook = async (artifactId, cmds, extra = {}) => {
          const rec =
            extra.artifact ||
            (listArtifacts(store, sessionId) || []).find((a) => a.artifactId === artifactId) ||
            null;
          if (hostSheet) {
            if (cmds.length) {
              const applied = await callSheetHost({
                method: 'apply',
                artifactId,
                commands: cmds,
                statusText: '正在写入草稿…'
              });
              const appliedBody = applied?.result || applied;
              emitSheetThought(appliedBody, false);
              return {
                ok: applied?.ok !== false && appliedBody?.ok !== false,
                op,
                artifact: rec,
                artifactId,
                ...(appliedBody || {}),
                error: applied?.error || appliedBody?.error,
                ...extra
              };
            }
            // Open the silent work tab so the user can watch; apply path does this too.
            await callSheetHost({
              method: 'overview',
              artifactId,
              statusText: extra.reused ? '正在打开表格…' : '正在创建表格…'
            });
            return { ok: true, op, artifact: rec, artifactId, ...extra };
          }
          if (!cmds.length) {
            return { ok: true, op, artifact: rec, artifactId, ...extra };
          }
          const loaded = loadWorkbookFromArtifact(artifactId);
          if (!loaded.ok) return { ok: false, op, ...loaded };
          const applied = applyCommandsToWorkbookData(loaded.data, cmds, {
            selections: sess.activeWorkbook?.overview?.selections
          });
          if (applied.ok === false) return { ok: false, op, error: applied.error, code: applied.code };
          const delim = loaded.kind === 'tsv' ? '\t' : ',';
          updateArtifactContent(store, fs, sessionId, artifactId, aoaToCsv(applied.sheets[0].rows, delim), {
            mimeType: loaded.rec.mimeType
          });
          emitSheetThought(applied, false);
          return {
            ok: true,
            op,
            artifact: loaded.rec,
            artifactId,
            applied: applied.applied,
            readback: applied.readback,
            overview: overviewFromWorkbookData(applied.data),
            ...extra
          };
        };
        if (resolved.applyId && !resolved.create) {
          rememberVisualCreation(execution, 'workbook', resolved.applyId, {
            explicitNew: resolved.markExplicitNew === true
          });
          if (!rest.length) {
            emitSheetThought({ readback: { sheet: seed.sheets?.[0]?.name, a1: 'A1' } }, true);
          }
          return applyWorkbook(resolved.applyId, rest, { reused: true });
        }
        if (hostSheet) {
          const res = await callSheetHost({
            method: 'create',
            name: seed.name || input.name,
            sheets: seed.sheets,
            kind: seed.kind || 'csv',
            statusText: '正在创建表格…'
          });
          const body = res?.result || res;
          if (res?.ok === false && !body?.artifact) {
            return { ok: false, op, error: res.error || body?.error || 'create failed' };
          }
          const artifact = body?.artifact || body?.result?.artifact;
          const createdId = String(artifact?.artifactId || '');
          if (createdId) {
            rememberVisualCreation(execution, 'workbook', createdId, {
              explicitNew: resolved.markExplicitNew === true
            });
          }
          if (rest.length && createdId) {
            return applyWorkbook(createdId, rest, { artifact });
          }
          emitSheetThought({ readback: { sheet: seed.sheets?.[0]?.name, a1: 'A1' } }, true);
          return { ok: true, op, artifact, artifactId: createdId, readback: seed.sheets?.[0] || null };
        }
        const sheets =
          Array.isArray(seed.sheets) && seed.sheets.length
            ? seed.sheets
            : [{ name: 'Sheet1', rows: [['列1']] }];
        let fileName = String(seed.name || input.name || 'workbook.csv').replace(/[^\w.\u4e00-\u9fff-]+/g, '_');
        if (!/\.(csv|tsv)$/i.test(fileName)) fileName += '.csv';
        const rec = createArtifact(store, fs, {
          sessionId,
          name: fileName,
          content: aoaToCsv(sheets[0].rows || []),
          mimeType: 'text/csv'
        });
        rememberVisualCreation(execution, 'workbook', rec.artifactId, {
          explicitNew: resolved.markExplicitNew === true
        });
        if (!rest.length) {
          emitSheetThought({ readback: { sheet: sheets[0]?.name, a1: 'A1' } }, true);
          return { ok: true, op, artifact: rec, artifactId: rec.artifactId, readback: { values: sheets[0].rows } };
        }
        return applyWorkbook(rec.artifactId, rest, { artifact: rec });
      }
      if (op === 'html') {
        const sess = store.get('sessions', sessionId) || {};
        const commands = Array.isArray(input.commands) ? input.commands : [];
        const rawAid = String(input.artifactId || firstCommandArtifactId(commands) || '').trim();
        const canvasId = rawAid && isOwnedPawCanvas(store, fs, sessionId, rawAid) ? rawAid : '';
        const foundScene = commands.find((c) => isSceneCreateCommand(c));
        const fallbackInput =
          canvasId && String(input.artifactId || '').trim() === canvasId
            ? stripMatchingArtifactId(input, canvasId)
            : input;
        let sceneCmd = foundScene
          ? unwrapSceneCreateInput(foundScene)
          : sceneInputFallback(fallbackInput, commands);
        if (sceneCmd && rawAid && !canvasId && !rasterItemRef(sceneCmd)) {
          sceneCmd = { ...sceneCmd, item: rawAid };
        }
        const sceneKind = String(sceneCmd?.kind || input.kind || '').trim();
        const artifactMode = readArtifactMode(input, sceneCmd, commands);
        const resolved = resolveVisualCreateTarget(store, fs, sessionId, execution, {
          canvasId,
          focusedId: String(sess.activeHtml?.artifactId || '').trim(),
          kind: sceneKind,
          artifactMode
        });
        if (!resolved.ok) {
          return {
            ok: false,
            op,
            code: resolved.code,
            error: resolved.error,
            ...(resolved.candidates ? { candidates: resolved.candidates } : {})
          };
        }
        const applyId = String(resolved.applyId || '').trim();
        if (sceneCmd && applyId) {
          sceneCmd = stripMatchingArtifactId(sceneCmd, applyId);
          if (!sceneCmd.kind && !input.kind) {
            const liveKind = kindFromOwnedCanvas(store, fs, sessionId, applyId);
            if (liveKind) sceneCmd = { ...sceneCmd, kind: liveKind };
          }
        }
        const sceneReady = sceneCmd && isSceneCreateCommand(sceneCmd);
        if (sceneReady) {
          if (!hasSceneCompilePayload(sceneCmd)) {
            return {
              ok: false,
              op,
              error: applyId
                ? `createScene needs frames[], nodes, html, or fragments. A live ${kindFromOwnedCanvas(store, fs, sessionId, applyId) === 'deck' ? 'Slides' : 'Design'} canvas is already open (${applyId}) — compile onto that artifact; do not emit a second file.`
                : 'createScene needs html, fragments, or nodes'
            };
          }
          const withFiles = attachSceneFilePayload(fs, sceneCmd);
          const withItems = await attachSelectionItemFragments(store, sessionId, fs, withFiles, {
            fetchImpl,
            onEvent,
            signal
          });
          const withItemSrc = attachRasterItemSrc(withItems);
          let hydratedCmd = await hydrateSceneImageNodes(store, sessionId, fs, withItemSrc, {
            fetchImpl,
            onEvent,
            signal
          });
          const raster = isRasterCompileInput(hydratedCmd);
          if (raster && shouldAutoScan(hydratedCmd)) {
            const item = rasterItemRef(hydratedCmd);
            const hit = await resolveOfficeAsset(store, sessionId, item, {
              fs,
              fetchImpl,
              onEvent,
              signal
            });
            if (hit.ok && hit.src) {
              const imageData = await rasterPixelsFromSrc(hit.src);
              if (imageData) {
                const scanned = resolveRasterScanNodes({ ...hydratedCmd, item: hit.src, imageData }, { imageData });
                hydratedCmd = {
                  ...hydratedCmd,
                  item: hit.src,
                  nodes: scanned.regions,
                  size: hydratedCmd.size || scanned.size || undefined
                };
              }
            }
          }
          if (Array.isArray(hydratedCmd.nodes)) {
            hydratedCmd.nodes = await applyRasterCrops(hydratedCmd.nodes, { raster });
          }
          if (Array.isArray(hydratedCmd.frames)) {
            hydratedCmd.frames = await Promise.all(
              hydratedCmd.frames.map(async (fr) => ({
                ...fr,
                nodes: Array.isArray(fr.nodes) ? await applyRasterCrops(fr.nodes, { raster }) : fr.nodes
              }))
            );
          }
          const inferredKind =
            hydratedCmd.kind ||
            input.kind ||
            resolved.kind ||
            (applyId ? kindFromOwnedCanvas(store, fs, sessionId, applyId) : '');
          const built = createScene({
            ...hydratedCmd,
            kind: inferredKind,
            title: hydratedCmd.title || input.name
          });
          if (built.ok === false) return { ok: false, op, error: built.error, ...(applyId ? { artifactId: applyId } : {}) };
          if (built.canvas) {
            built.canvas = await hydratePawCanvasImages(built.canvas, (ref) =>
              resolveOfficeAsset(store, sessionId, ref, { fs, fetchImpl, onEvent, signal })
            );
            built.json = JSON.stringify(built.canvas);
            const leftover = unresolvedEngineImages(built.canvas);
            if (leftover.length) {
              return {
                ok: false,
                op,
                error: `image src did not resolve to pixels: ${leftover.map((n) => n.src).join(', ')}`,
                unresolved: leftover.map((n) => ({ nodeId: n.nodeId, src: n.src }))
              };
            }
            const imgNodes = (built.nodes || []).filter((n) => n && (n.type === 'image' || n.src));
            for (const n of imgNodes) {
              const hit = await resolveOfficeAsset(store, sessionId, n.src, { fs, fetchImpl, onEvent, signal });
              if (hit.ok) n.src = hit.src;
            }
          }
          const gated = gateCompiledScene(built, {
            op: String(hydratedCmd.op || input.op || built.source || 'createScene').trim(),
            kind: built.kind || inferredKind,
            source: built.source
          });
          if (!gated.ok) {
            return qaFailurePayload(gated, {
              op,
              ...(applyId ? { artifactId: applyId } : {})
            });
          }
          const payload = built.json || JSON.stringify(built.canvas);
          let rec;
          let reused = false;
          if (applyId) {
            rec = updateArtifactContent(store, fs, sessionId, applyId, payload, {
              mimeType: 'application/json'
            });
            reused = true;
            emitLiveCanvasUpdated(applyId);
          } else {
            const canvasName = canvasArtifactName(input.name, built.kind);
            rec = createArtifact(store, fs, {
              sessionId,
              name: canvasName,
              content: payload,
              mimeType: 'application/json'
            });
            emitCanvasPreview(rec, built);
          }
          rememberVisualCreation(execution, built.kind || inferredKind, rec.artifactId, {
            explicitNew: resolved.markExplicitNew === true
          });
          const created = {
            ok: true,
            op,
            artifact: rec,
            artifactId: rec.artifactId,
            kind: built.kind,
            source: built.source,
            qa: gated.qa,
            ...(reused ? { reused: true } : {}),
            ...(Array.isArray(built.warnings) && built.warnings.length
              ? { warnings: built.warnings, warning: built.warnings[0] }
              : {}),
            nodes: (built.nodes || []).map((n) => ({
              id: n.id,
              type: n.type,
              text: String(n.text || '').slice(0, 160),
              src: summarizeImageSrc(n.src || ''),
              box: n.box || null
            }))
          };
          const prev = await requestCanvasPreview(hostCanvas, { artifactId: rec.artifactId });
          return attachCanvasPreview(created, prev);
        }
        if (!commands.length) return { ok: false, op, error: 'html requires commands[]' };
        const creatingHtml = commands.some((c) => c.op === 'createDocument') && !canvasId;
        if (creatingHtml) {
          return {
            ok: false,
            op,
            code: 'USE_CANVAS',
            error:
              'HTML plates are not a canvas. Visuals use createScene / fromPage / fromRaster. Websites use write_artifact with data-paw-kind=site. Documents use run op=doc.'
          };
        }
        if (canvasId) {
          return {
            ok: false,
            op,
            code: 'USE_OFFICE_TOOL',
            error:
              'Daily visual edits use the deck tool on a Design/Slides canvas. run op=html is create only (createScene / fromPage / fromRaster).'
          };
        }
        return {
          ok: false,
          op,
          error: 'html create needs createScene / fromPage / fromSelection / fromRaster with html, nodes, fragments, or item+regions'
        };
      }
      if (op === 'doc') {
        let commands = Array.isArray(input.commands) ? input.commands : [];
        if (!commands.length && (input.html || input.content || input.title || input.name || opEarly === 'createDocument')) {
          commands = [{ op: 'createDocument', title: input.title || input.name }];
          if (input.html || input.content) {
            commands.push({ op: 'setText', text: String(input.html || input.content) });
          }
        }
        if (!commands.length) return { ok: false, op, error: 'doc requires commands[]' };
        const applied = applyDocCommands(emptyDocSnapshot(input.name || 'Document'), commands);
        if (applied.ok === false) {
          return {
            ok: false,
            op,
            error: applied.error || 'doc apply failed',
            applied: applied.applied
          };
        }
        const rec = createArtifact(store, fs, {
          sessionId,
          name: String(input.name || 'document.html').replace(/[^\w.\u4e00-\u9fff-]+/g, '_') || 'document.html',
          content: applied.html,
          mimeType: 'text/html'
        });
        emitHtmlPreviewIfMarked(rec, applied.html);
        return { ok: true, op, artifact: rec, applied: applied.applied, snapshot: applied.snapshot };
      }
      if (op === 'ingestPdf') {
        const sess = store.get('sessions', sessionId) || {};
        const artifactId = String(input.artifactId || '').trim();
        if (!artifactId) return { ok: false, op, error: 'ingestPdf needs artifactId' };
        const rec = listArtifacts(store, sessionId).find((a) => a.artifactId === artifactId);
        if (!rec) return { ok: false, op, error: 'artifact not found' };
        let bytes;
        try {
          bytes = coerceToUint8Array(fs.readFileBytes(rec.primaryPath));
        } catch (e) {
          return { ok: false, op, error: e instanceof Error ? e.message : String(e) };
        }
        const converted = await pdfBytesToHtml(bytes, { title: rec.name || 'PDF' });
        const out = createArtifact(store, fs, {
          sessionId,
          name: String(rec.name || 'pdf').replace(/\.pdf$/i, '') + '.html',
          content: converted.html,
          mimeType: 'text/html'
        });
        emitHtmlPreviewIfMarked(out, converted.html);
        return {
          ok: true,
          op,
          artifact: out,
          warning: converted.warning,
          pageCount: converted.pageCount,
          pdf: looksLikePdf(bytes)
        };
      }
      if (op === 'write_artifact') {
        try {
          const name =
            input.name || (input.mimeType && /html/i.test(input.mimeType) ? 'result.html' : 'result');
          let content = input.content || '';
          const policy = htmlWritePolicy(content, name);
          if (policy.allow === false) {
            return { ok: false, op, code: policy.code, error: policy.error };
          }
          if (policy.kind === 'site') content = stampSiteHtml(content);
          const sess = store.get('sessions', sessionId) || {};
          const existing = resolveHtmlUpsertTarget(store, sessionId, {
            name,
            content,
            activeId: sess.activeHtml?.artifactId || ''
          });
          if (existing) {
            const rec = updateArtifactContent(store, fs, sessionId, existing.artifactId, content, {
              mimeType: input.mimeType || existing.mimeType
            });
            emitHtmlPreviewIfMarked(rec, content);
            return { ok: true, op, artifact: rec, updated: true };
          }
          const rec = createArtifact(store, fs, {
            sessionId,
            name,
            content,
            mimeType: input.mimeType
          });
          emitHtmlPreviewIfMarked(rec, content);
          return { ok: true, op, artifact: rec };
        } catch (e) {
          return {
            ok: false,
            op,
            error: e instanceof Error ? e.message : String(e),
            code: e?.code || 'WRITE_FAILED'
          };
        }
      }
      if (op === 'update_artifact') {
        try {
          const content = input.content || '';
          const policy = htmlWritePolicy(content, input.name || '');
          if (policy.allow === false) {
            return { ok: false, op, code: policy.code, error: policy.error };
          }
          const rec = updateArtifactContent(
            store,
            fs,
            sessionId,
            String(input.artifactId),
            policy.kind === 'site' ? stampSiteHtml(content) : content,
            { mimeType: input.mimeType }
          );
          return { ok: true, op, artifact: rec };
        } catch (e) {
          return {
            ok: false,
            op,
            error: e instanceof Error ? e.message : String(e),
            code: e?.code || 'UPDATE_FAILED'
          };
        }
      }
      if (op === 'write_scratch') {
        const path = String(input.path || `/scratch/work_${Date.now().toString(36)}.txt`);
        fs.writeFile(path, String(input.content || ''));
        return { ok: true, op, path };
      }
      if (op === 'read') {
        const path = String(input.path || '');
        try {
          // Auth: artifact paths are session-scoped via guest FS jail
          if (path.startsWith('/artifacts/')) {
            // optional: ensure path belongs to an owned artifact package
          }
          return { ok: true, op, path, content: fs.readFile(path) };
        } catch (e) {
          return { ok: false, op, error: e instanceof Error ? e.message : String(e) };
        }
      }
      if (op === 'write_package_file') {
        const gate = assertArtifactOwned(store, sessionId, String(input.artifactId));
        if (!gate.ok) return { ok: false, op, error: gate.error, code: gate.code };
        const packPolicy = htmlWritePolicy(input.content || '', String(input.path || input.name || ''));
        if (packPolicy.allow === false) {
          return { ok: false, op, code: packPolicy.code, error: packPolicy.error };
        }
        const { writePackageFile } = await import('./artifacts.js');
        try {
          const r = writePackageFile(store, fs, {
            sessionId,
            artifactId: String(input.artifactId),
            path: String(input.path),
            content: input.content || '',
            mimeType: input.mimeType
          });
          return { ok: true, op, ...r };
        } catch (e) {
          return { ok: false, op, error: e instanceof Error ? e.message : String(e) };
        }
      }
      if (!op && (input.code == null || String(input.code).trim() === '')) {
        return {
          ok: false,
          error: 'run requires code or op',
          code: 'BAD_INPUT',
          hint: 'pass op (createScene / write_artifact / …) or code'
        };
      }
      return {
        ok: false,
        error: `unknown op ${op}`,
        code: 'BAD_INPUT',
        hint: 'use a documented run op from the tool schema enum'
      };
    },
    toModelOutput: sessionToolToModelOutput
  };

  const waitClarify =
    typeof env.waitForClarify === 'function' ? env.waitForClarify : waitForClarifyAnswer;

  const clarify = {
    name: 'clarify',
    description:
      'Present 1–4 multiple-choice questions to the user and pause the turn until they answer. The host always adds Other.',
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'Shorthand for a single question' },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: 'Shorthand option labels for a single question'
        },
        questions: {
          type: 'array',
          description: '1–4 clarifying questions',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              header: { type: 'string' },
              multiSelect: { type: 'boolean' },
              options: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string' },
                    description: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    },
    async execute(input = {}, opts = {}) {
      const questions = normalizeClarifyQuestions(input);
      if (!questions.length) {
        return {
          ok: false,
          error: 'clarify requires a question',
          code: 'BAD_INPUT',
          hint: 'pass question or questions[]'
        };
      }
      const clarifyId = newClarifyId();
      const sig = opts?.abortSignal || signal;
      const waiting = waitClarify({ clarifyId, sessionId, questions, signal: sig });
      if (onEvent) {
        try {
          onEvent({ type: 'clarify', sessionId, clarifyId, questions });
        } catch {
          /* UI listener must not fail the yield */
        }
      }
      try {
        const answers = await waiting;
        if (onEvent) {
          try {
            onEvent({ type: 'clarify-done', sessionId, clarifyId, answers });
          } catch {
            /* ignore */
          }
        }
        return { ok: true, answers: answers && typeof answers === 'object' ? answers : {}, questions };
      } catch (e) {
        const aborted = e?.name === 'AbortError' || sig?.aborted;
        if (onEvent) {
          try {
            onEvent({ type: 'clarify-done', sessionId, clarifyId, aborted: true });
          } catch {
            /* ignore */
          }
        }
        if (aborted) throw e;
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }
  };

  const office = createOfficeTools({
    store,
    execution,
    fs,
    sessionId,
    signal,
    fetchImpl,
    onEvent,
    hostSheet,
    hostCanvas,
    hostPageCapture: env.hostPageCapture,
    webAcquire: env.webAcquire,
    activeTab: env.activeTab,
    focusPage: env.focusPage,
    promptId: env.promptId
  });
  return { inspect, acquire, run, clarify, ...office };
}

/**
 * Bridge Session guest FS to codeRuntime/acquire async FS shape.
 * Maps legacy /output → /artifacts and /work → /scratch.
 * @param {ReturnType<import('./fs.js').createSessionGuestFs>} guestFs
 */
export function createCodeFsBridge(guestFs) {
  function mapPath(p) {
    let s = String(p || '').replace(/\\/g, '/');
    if (s.startsWith('/output')) s = '/artifacts' + s.slice('/output'.length);
    if (s.startsWith('/work')) s = '/scratch' + s.slice('/work'.length);
    if (!s.startsWith('/')) s = '/' + s;
    return s;
  }
  return {
    readFile(path, encoding) {
      const g = mapPath(path);
      if (encoding === 'binary' || encoding === null) {
        return guestFs.readFileBytes(g);
      }
      return guestFs.readFile(g);
    },
    writeFile(path, data, opts = {}) {
      const g = mapPath(path);
      // Rehydrate QuickJS / bridge dumps (plain object numeric keys, number[])
      // so binary artifacts are never silently written as empty files.
      const payload =
        typeof data === 'string' ? data : coerceToUint8Array(data);
      const mime =
        opts?.mimeType ||
        (typeof payload === 'string' ? 'text/plain' : guessMimeFromName(g.toLowerCase()));
      if (g.startsWith('/artifacts/')) {
        const policy = htmlWritePolicy(payload, g.split('/').pop() || '');
        if (policy.allow === false) {
          const err = new Error(policy.error || policy.code || 'USE_CANVAS');
          err.code = policy.code || 'USE_CANVAS';
          throw err;
        }
      }
      // Ensure parent
      const parent = g.split('/').slice(0, -1).join('/') || '/';
      try {
        guestFs.mkdirp(parent);
      } catch {
        /* ignore */
      }
      return guestFs.writeFile(g, payload, { mimeType: mime });
    },
    exists(path) {
      return guestFs.exists(mapPath(path));
    },
    readdir(path) {
      return guestFs.list(mapPath(path || '/artifacts'));
    },
    mkdir(path) {
      return guestFs.mkdirp(mapPath(path));
    },
    async stat(path) {
      const g = mapPath(path);
      if (!guestFs.exists(g)) throw new Error(`ENOENT: ${g}`);
      try {
        const bytes = guestFs.readFileBytes(g);
        return { size: bytes.byteLength, isFile: true, isDirectory: false };
      } catch {
        return { size: 0, isFile: false, isDirectory: true };
      }
    }
  };
}

function attachRasterItemSrc(cmd = {}) {
  const item = rasterItemRef(cmd) || officeImageRef(cmd, { allowValue: false });
  if (!item) return cmd;
  const one = (n) => {
    if (!n || typeof n !== 'object') return n;
    const image = n.type === 'image' || n.tag === 'img' || n.src || n.path || n.item;
    const empty = !officeImageRef(n, { allowValue: false });
    if (image && empty) return { ...n, src: item };
    return n;
  };
  const next = { ...cmd };
  if (Array.isArray(next.nodes)) next.nodes = next.nodes.map(one);
  if (Array.isArray(next.regions)) next.regions = next.regions.map(one);
  if (Array.isArray(next.frames)) {
    next.frames = next.frames.map((fr) => ({
      ...fr,
      nodes: Array.isArray(fr.nodes) ? fr.nodes.map(one) : fr.nodes
    }));
  }
  return next;
}

function sceneInputFallback(input, commands) {
  const packed = (commands || []).find(
    (c) =>
      c &&
      typeof c === 'object' &&
      String(c.op || '') !== 'createDocument' &&
      (isSceneCreateCommand(c) ||
        c.html ||
        c.content ||
        (Array.isArray(c.nodes) && c.nodes.length) ||
        (Array.isArray(c.frames) && c.frames.length) ||
        c.fragments ||
        c.items ||
        c.createScene)
  );
  const src = packed ? { ...input, ...packed } : input;
  const unwrapped = unwrapSceneCreateInput(src);
  if (isSceneCreateCommand(unwrapped) || isRasterCompileInput(unwrapped) || rasterItemRef(unwrapped)) {
    const source = String(
      unwrapped.source ||
        (unwrapped.fragments || unwrapped.items
          ? 'selection'
          : Array.isArray(unwrapped.nodes) && unwrapped.nodes.length
            ? 'nodes'
            : rasterItemRef(unwrapped)
              ? 'raster'
              : 'page')
    );
    const op = SCENE_CREATE_OPS_LOCAL.has(String(unwrapped.op || ''))
      ? unwrapped.op
      : source === 'selection'
        ? 'fromSelection'
        : source === 'raster'
          ? 'fromRaster'
          : source === 'nodes'
            ? 'createScene'
            : 'fromPage';
    return { ...unwrapped, op, source };
  }
  return null;
}

const SCENE_CREATE_OPS_LOCAL = new Set([
  'createScene',
  'fromPage',
  'fromSelection',
  'fromRaster',
  'fromImage',
  'page',
  'raster'
]);
const SCENE_RUN_OPS = new Set(['html', ...SCENE_CREATE_OPS_LOCAL]);
const RUN_OPS = [
  'write_artifact',
  'update_artifact',
  'write_scratch',
  'read',
  'write_package_file',
  'sheet',
  'html',
  'createScene',
  'fromPage',
  'fromSelection',
  'fromRaster',
  'fromImage',
  'page',
  'raster',
  'doc',
  'ingestPdf',
  'skill',
  'shelf',
  'createWorkbook',
  'createDocument'
];

function isSceneRunInput(input = {}, opEarly = '') {
  if (SCENE_RUN_OPS.has(String(opEarly || ''))) return true;
  if (isSceneCreateCommand(input)) return true;
  const commands = Array.isArray(input.commands) ? input.commands : [];
  return commands.some((c) => isSceneCreateCommand(c));
}

function firstCommandArtifactId(commands) {
  for (const c of commands || []) {
    if (!c || typeof c !== 'object') continue;
    const id = String(c.artifactId || '').trim();
    if (id) return id;
  }
  return '';
}

function firstCommandField(commands, key) {
  for (const c of commands || []) {
    if (!c || typeof c !== 'object') continue;
    if (c[key] != null && String(c[key]).trim()) return c[key];
  }
  return '';
}

function readArtifactMode(input, sceneCmd, commands) {
  const raw = input?.artifactMode ?? sceneCmd?.artifactMode ?? firstCommandField(commands, 'artifactMode');
  return String(raw || '').trim().toLowerCase() === 'new' ? 'new' : '';
}

function stripMatchingArtifactId(cmd, artifactId) {
  if (!cmd || typeof cmd !== 'object') return cmd;
  if (String(cmd.artifactId || '').trim() !== String(artifactId || '').trim()) return cmd;
  const next = { ...cmd };
  delete next.artifactId;
  return next;
}

function hasSceneCompilePayload(cmd = {}) {
  const raw = unwrapSceneCreateInput(cmd) || {};
  if (String(raw.html || raw.content || '').trim()) return true;
  if (Array.isArray(raw.nodes) && raw.nodes.length) return true;
  if (
    Array.isArray(raw.frames) &&
    raw.frames.some(
      (f) =>
        (Array.isArray(f?.nodes) && f.nodes.length) ||
        String(f?.layoutId || '').trim() ||
        (f?.slots && typeof f.slots === 'object' && !Array.isArray(f.slots) && Object.keys(f.slots).length)
    )
  ) {
    return true;
  }
  if (Array.isArray(raw.fragments) && raw.fragments.length) return true;
  if (Array.isArray(raw.items) && raw.items.length) return true;
  if (isRasterCompileInput(raw)) return true;
  return Boolean(rasterItemRef(raw));
}

function attachSceneFilePayload(fs, cmd = {}) {
  const op = String(cmd.op || cmd.source || '');
  if ((op === 'fromPage' || op === 'page') && !String(cmd.html || cmd.content || '').trim()) {
    const p = String(cmd.path || cmd.src || cmd.file || '').trim();
    if (p && typeof fs?.exists === 'function' && fs.exists(p)) {
      try {
        return { ...cmd, html: bytesToUtf8(fs.readFileBytes(p)) };
      } catch {
        return cmd;
      }
    }
  }
  return cmd;
}

async function attachSelectionItemFragments(store, sessionId, fs, cmd = {}, env = {}) {
  const op = String(cmd.op || cmd.source || '');
  if (op !== 'fromSelection' && op !== 'selection') return cmd;
  const hasHtmlFrags = Array.isArray(cmd.fragments)
    ? cmd.fragments.some((f) => f && (typeof f === 'string' ? /</.test(f) : f.html || f.content))
    : false;
  if (hasHtmlFrags) return cmd;
  const refs = [];
  if (cmd.item || cmd.handle) refs.push(cmd.item || cmd.handle);
  const list = Array.isArray(cmd.items) ? cmd.items : [];
  for (const it of list) {
    if (typeof it === 'string') refs.push(it);
    else if (it && typeof it === 'object' && !it.html && !it.content && officeImageRef(it, { allowValue: false })) {
      refs.push(officeImageRef(it, { allowValue: false }));
    }
  }
  if (!refs.length) return cmd;
  const extra = [];
  for (const ref of refs) {
    const hit = await resolveOfficeAsset(store, sessionId, String(ref || ''), { fs, ...env });
    if (hit.ok && hit.src) extra.push({ src: hit.src, type: 'image' });
  }
  if (!extra.length) return cmd;
  return { ...cmd, fragments: [...(cmd.fragments || []), ...extra] };
}

function mapHostToGuest(p) {
  let s = String(p || '');
  if (s.startsWith('/output')) return '/artifacts' + s.slice('/output'.length);
  if (s.startsWith('/work')) return '/scratch' + s.slice('/work'.length);
  if (s.startsWith('/artifacts') || s.startsWith('/scratch') || s.startsWith('/context')) return s;
  // result.path from guest writeFile often already guest path
  if (s.startsWith('/')) return s;
  return null;
}

/**
 * Extract image bytes for multimodal model parts. Fetches on demand into blob:{id}.
 */
async function materializeItemMedia(store, item, includeMedia, opts = {}) {
  if (!includeMedia || !item) return {};
  const src = item.capture?.src || item.capture?.preview?.src || '';
  const isImage = looksLikeImageItem(item);

  let bytes = null;
  let mediaType = 'image/png';

  if (isImage) {
    const ensured = await ensureItemPixels(store, item, opts);
    if (ensured.ok && ensured.bytes?.byteLength) {
      bytes = ensured.bytes;
      mediaType = ensured.mimeType || mediaType;
    }
  }

  if (!bytes) {
    const blob = store.getBlob(`blob:${item.webItemId}`);
    if (blob?.bytes?.byteLength) {
      bytes = blob.bytes;
      mediaType = blob.mimeType || mediaType;
    }
  }

  if (!isImage && !bytes) return {};
  if (!bytes || !bytes.byteLength) {
    return {
      hasImage: Boolean(isImage),
      mediaError: 'image bytes unavailable (only src metadata)',
      mediaType: null,
      modelParts: []
    };
  }

  const base64 = bytesToBase64(bytes);
  const modelParts = [
    {
      type: 'text',
      text: `Image item ${item.webItemId} (${mediaType}, ${bytes.byteLength} bytes)`
    },
    {
      type: 'image',
      image: bytes,
      mediaType
    }
  ];

  return {
    hasImage: true,
    mediaType,
    byteLength: bytes.byteLength,
    /** base64 for transport; tests assert non-empty pixels */
    imageBase64: base64,
    modelParts
  };
}

function stripHeavyCapture(capture = {}) {
  const { dataUrl, bytes, ...rest } = capture;
  if (typeof rest.src === 'string') rest.src = compactSrc(rest.src);
  if (rest.preview && typeof rest.preview.src === 'string') {
    rest.preview = { ...rest.preview, src: compactSrc(rest.preview.src) };
  }
  return rest;
}

/**
 * data: URLs can be megabytes of base64 — as tool-output text they burn tokens
 * without informing the model (pixels travel via multimodal parts instead).
 */
function compactSrc(src) {
  const s = src == null ? '' : String(src);
  if (!s.startsWith('data:')) return s;
  if (s.length <= 96) return s;
  const head = s.slice(0, s.indexOf(',') + 1 || 40).slice(0, 60);
  return `${head}…[data url, ${s.length} chars]`;
}

function summarizeCapture(capture = {}) {
  return {
    tag: capture.preview?.tagName || capture.tag || null,
    textSnippet: String(capture.text || capture.preview?.textSnippet || '').slice(0, 120),
    src: capture.src ? String(capture.src).slice(0, 80) : null,
    kind: capture.kindHint || null
  };
}

function isProbablyText(path, bytes) {
  const lower = String(path).toLowerCase();
  if (/\.(png|jpe?g|gif|webp|pdf|zip|xlsx|pptx|docx)$/i.test(lower)) return false;
  if (/\.(css|js|mjs|ts|json|svg|xml|txt|md)$/i.test(lower)) {
    /* css/js are text for inspect paging even when open-classify has no utf8 kind */
  } else {
    const cls = classifyOpenArtifact({ name: path, bytes });
    if (cls.kind && !isUtf8OpenKind(cls.kind)) return false;
  }
  if (bytes.byteLength === 0) return true;
  let weird = 0;
  const n = Math.min(bytes.byteLength, 512);
  for (let i = 0; i < n; i++) {
    const c = bytes[i];
    if (c === 0) return false;
    if (c < 7 || (c > 14 && c < 32 && c !== 9 && c !== 10 && c !== 13)) weird++;
  }
  return weird / n < 0.1;
}

async function hydrateHtmlImageCommands(store, fs, sessionId, commands, opts = {}) {
  return hydrateOfficeImageCommands(store, sessionId, commands, {
    ...opts,
    fs,
    ops: HTML_IMAGE_OPS
  });
}

async function executeSkillOp(input, env = {}) {
  const store = getDurableSkillStore();
  const cmd = Array.isArray(input.commands) && input.commands[0] ? input.commands[0] : input;
  const act = String(cmd.act || cmd.op || input.act || 'upsert').toLowerCase();
  try {
    if (act === 'import') {
      const url = String(cmd.url || input.url || '').trim();
      if (!url) return { ok: false, op: 'skill', error: 'import needs url' };
      const imported = await importSkillFromUrl(url, env);
      if (!imported.ok) return { ok: false, op: 'skill', ...imported };
      const saved = await store.upsert(imported.skill);
      return { ok: true, op: 'skill', act: 'import', skill: publicDurableSkill(saved) };
    }
    if (act === 'delete' || act === 'remove' || act === 'reset') {
      const id = String(cmd.id || input.id || input.name || '').trim();
      if (!id) return { ok: false, op: 'skill', error: 'delete needs id' };
      await store.remove(id);
      return { ok: true, op: 'skill', act, id };
    }
    const rec = String(cmd.markdown || input.markdown || '').trim()
      ? skillRecordFromMarkdown(cmd.id || input.id || cmd.name, cmd.markdown || input.markdown, {
          origin: 'authored',
          name: cmd.name,
          description: cmd.description
        })
      : normalizeDurableSkill({
          id: cmd.id || input.id || cmd.name,
          name: cmd.name || input.name,
          description: cmd.description || input.description,
          instructions: cmd.instructions || input.instructions || input.content || '',
          resources: cmd.resources,
          origin: 'authored'
        });
    const saved = await store.upsert(rec);
    return { ok: true, op: 'skill', act: 'upsert', skill: publicDurableSkill(saved) };
  } catch (e) {
    return { ok: false, op: 'skill', error: e instanceof Error ? e.message : String(e) };
  }
}

function publicDurableSkill(rec) {
  return {
    id: rec.id,
    name: rec.name,
    description: rec.description,
    origin: rec.origin,
    sourceUrl: rec.sourceUrl || '',
    resources: Object.keys(rec.resources || {})
  };
}

export function resolveSkillGuestResource(skillId, resourcePath) {
  const requested = String(skillId || '').trim();
  const id = resolveSkillId(requested);
  const roots = [...new Set([`/scratch/skills/${requested}`, `/scratch/skills/${id}`])];
  const p = String(resourcePath || '')
    .replace(/\\/g, '/')
    .replace(/\/+$/, '');
  for (const root of roots) {
    if (!p || p === root || p === `${root}/SKILL.md` || p === 'SKILL.md' || p === './SKILL.md') {
      return { kind: 'playbook', path: 'SKILL.md' };
    }
    if (p.startsWith(`${root}/`)) {
      return { kind: 'resource', path: p.slice(root.length + 1) };
    }
  }
  return { kind: 'resource', path: p.replace(/^\.\//, '') };
}

export async function hydrateSkillScriptsIntoGuest(fs) {
  if (!fs || typeof fs.writeFile !== 'function') return;
  for (const s of listPackagedSkillCatalog()) {
    const full = getSkill(s.id);
    if (!full) continue;
    writeSkillPackToGuest(fs, {
      id: s.id,
      instructions: full.instructions,
      resources: full.resources
    });
    for (const alias of skillIdAliases(s.id)) {
      writeSkillPackToGuest(fs, {
        id: alias,
        instructions: full.instructions,
        resources: full.resources
      });
    }
  }
  const durable = await getDurableSkillStore().list();
  for (const rec of durable) writeSkillPackToGuest(fs, rec);
}

function bytesToBase64(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

/**
 * Convert tools map to OpenAI tools array shape (for callModel injection).
 * @param {Record<string, {name:string,description:string,parameters:object}>} tools
 */
export function toOpenAiToolsArray(tools) {
  return Object.values(tools).map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters || { type: 'object', properties: {} }
    }
  }));
}

export { isItemBoundToSession };

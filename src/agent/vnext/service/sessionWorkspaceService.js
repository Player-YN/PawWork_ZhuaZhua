/**
 * Product Session Workspace Service — unified sendMessage path.
 * Durable store (IDB / memory-backend) — not pure ephemeral Maps.
 */

import {
  createSessionWorkspaceRuntime,
  SessionWorkspaceStore
} from '../runSession.product.js';
import {
  createDurableSessionWorkspaceStore,
  DurableSessionWorkspaceStore
} from '../sessionWorkspace/durableStore.js';
import { createSessionGuestFs } from '../sessionWorkspace/fs.js';
import {
  bytesFromRpcContent,
  createArtifact as createArtifactRecord,
  deleteArtifact as deleteArtifactRecord,
  updateArtifactContent,
  revertArtifactContent
} from '../sessionWorkspace/artifacts.js';
import { rewriteGuestImageSrcs } from '../sessionWorkspace/htmlMedia.js';
import { aoaToCsv } from '../../../preview/sheetCodec.js';
import { guessMimeFromName } from '../sessionWorkspace/artifactValidate.js';
import { assertArtifactOwned } from '../sessionWorkspace/auth.js';
import { gcUnreachableWebItems, sweepOrphanScratch } from '../sessionWorkspace/gc.js';
import {
  CLIPBOARD_GROUP_KIND,
  isClipboardGroup,
  ensureClipboardGroup,
  pinClipboardItems,
  groupVisibleToSession,
  readActiveCaptureGroupId,
  writeActiveCaptureGroupId,
  findOrCreateNamedGroup
} from '../sessionWorkspace/groups.js';
import { createPageWandLanguageModel } from '../../provider.js';
import { runSelectionSuggest } from '../sessionWorkspace/selectionSuggest.js';
import {
  findCatalogModel,
  loadCachedModelsForBase,
  resolveContextWindow
} from '../../modelCatalog.js';
import { loadLlmSettings } from '../../llm.js';
import {
  getDurableSkillStore,
  hydrateDurableSkillsFromChrome,
  importSkillFromUrl,
  mergeSkillCatalog,
  mergeSkillRecord,
  normalizeDurableSkill,
  sanitizeSkillId
} from '../sessionWorkspace/skillStore.js';
import { getSkill, listPackagedSkillCatalog } from '../skills/registry.js';
import { answerClarify, abortSessionClarifies } from '../sessionWorkspace/clarifyGate.js';
import { createUserStopError } from '../host/userStop.js';
import {
  allocateLabelN,
  ensureItemLabel,
  formatItemLabel,
  itemHandle,
  normalizeLabelKind
} from '../sessionWorkspace/itemLabel.js';
import { blankArtifactPayload } from '../sessionWorkspace/blankCreate.js';
import { normalizeSessionTitle } from '../sessionWorkspace/taskTitle.js';
import { addPageItems, formatPageAddSummary, isPageItem } from '../sessionWorkspace/pageItems.js';

export class SessionWorkspaceService {
  /**
   * @param {{ store?: SessionWorkspaceStore|DurableSessionWorkspaceStore, callModel?: Function, model?: any }} [opts]
   */
  constructor(opts = {}) {
    const store = opts.store || new SessionWorkspaceStore();
    this.runtime = createSessionWorkspaceRuntime(store);
    this.callModel = opts.callModel || null;
    /** @type {any} AI SDK LanguageModel for ToolLoopAgent */
    this.model = opts.model || null;
    this.activeGroupId = null;
    this.storeKind = store.kind || 'memory';
    /** @type {Map<string, { controller: AbortController, executionId: string|null, sessionId: string }>} */
    this._activeBySession = new Map();
    /** @type {Map<string, AbortController>} */
    this._activeByExecution = new Map();
  }

  /**
   * Product factory — opens durable store. LanguageModel is resolved per turn
   * so configuring API after extension load takes effect (do not freeze null model at boot).
   * @param {{ store?: any, callModel?: Function, model?: any, dbName?: string }} [opts]
   */
  static async create(opts = {}) {
    const store =
      opts.store ||
      (await createDurableSessionWorkspaceStore({
        dbName: opts.dbName || 'pawwork-session-workspace-v1'
      }));
    // Optional eager model for tests; product always re-resolves in sendMessage
    let model = opts.model || null;
    if (!model && !opts.callModel) {
      try {
        const built = await createPageWandLanguageModel();
        model = built.model;
      } catch (e) {
        // Boot without key is OK — user may configure later; sendMessage re-tries
        if (e?.code !== 'NO_API_KEY') {
          console.warn('[SessionWorkspaceService] LanguageModel at create:', e?.message || e);
        }
      }
    }
    await hydrateDurableSkillsFromChrome();
    return new SessionWorkspaceService({ ...opts, store, model, callModel: opts.callModel || null });
  }

  /**
   * Build LanguageModel from latest chrome.storage provider settings.
   * Called every product sendMessage so post-boot API key changes apply.
   * @returns {Promise<any>}
   */
  /**
   * @param {{ reasoning?: { enabled?: boolean, effort?: string } }} [opts]
   */
  async resolveLanguageModel(opts = {}) {
    try {
      const built = await createPageWandLanguageModel({
        reasoning: opts.reasoning || null
      });
      this.model = built.model;
      return built.model;
    } catch (e) {
      this.model = null;
      if (e?.code === 'NO_API_KEY') {
        const err = new Error(
          'NO_API_KEY: 请先在设置中配置 API Key 与模型，然后重新发送。'
        );
        err.code = 'NO_API_KEY';
        throw err;
      }
      const err = new Error(
        `LanguageModel unavailable: ${e instanceof Error ? e.message : String(e)}`
      );
      err.cause = e;
      throw err;
    }
  }

  async _persist() {
    const store = this.runtime.store;
    if (store && typeof store.flush === 'function') {
      await store.flush();
    }
  }

  /**
   * Offscreen → Sidepanel live events (thinking / tokens). Fire-and-forget:
   * chrome.storage is unavailable here; chrome.runtime messaging is the bridge.
   */
  _broadcastUiEvent(event) {
    try {
      if (typeof chrome === 'undefined' || typeof chrome.runtime?.sendMessage !== 'function') {
        return;
      }
      const payload = {
        action: 'session_workspace_event',
        event: stripWorkspaceUiEvent(event)
      };
      const p = chrome.runtime.sendMessage(payload);
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      /* no UI listener (tests / SW-only) */
    }
  }

  ensureSession(sessionId = 'default') {
    const s = this.runtime.ensureSession(sessionId);
    this.activeGroupId = readActiveCaptureGroupId(this.runtime.store);
    return s;
  }

  /**
   * Capture target is ambient (one picker for all tasks). Bind stays per-session.
   */
  _writeSessionActiveGroup(sessionId, groupId) {
    this.activeGroupId = writeActiveCaptureGroupId(this.runtime.store, groupId);
    const s = this.runtime.store.get('sessions', sessionId);
    if (!s) return;
    if (s.activeGroupId === this.activeGroupId) return;
    this.runtime.store.put('sessions', sessionId, {
      ...s,
      activeGroupId: this.activeGroupId,
      updatedAt: Date.now()
    });
  }

  /** Ambient capture target — same group across tasks. */
  _sessionActiveGroupId(_sessionId) {
    return readActiveCaptureGroupId(this.runtime.store);
  }

  /**
   * Runtime-owned session list (source of truth for conversation metadata).
   */
  async listSessions() {
    const ids = this.runtime.store.keys('sessions');
    return ids.map((id) => {
      const s = this.runtime.store.get('sessions', id);
      return {
        sessionId: id,
        title: s?.title || s?.name || id,
        titleLocked: !!s?.titleLocked,
        messageCount: Array.isArray(s?.messages) ? s.messages.length : 0,
        updatedAt: s?.updatedAt || s?.createdAt || 0,
        createdAt: s?.createdAt || 0
      };
    });
  }

  async getSession({ sessionId = 'default' } = {}) {
    this.ensureSession(sessionId);
    const s = this.runtime.getSession(sessionId);
    return {
      sessionId,
      title: s?.title || s?.name || sessionId,
      titleLocked: !!s?.titleLocked,
      messages: Array.isArray(s?.messages) ? s.messages : [],
      updatedAt: s?.updatedAt || 0,
      createdAt: s?.createdAt || 0,
      shelf: s?.shelf && typeof s.shelf === 'object' ? s.shelf : null
    };
  }

  async renameSession({ sessionId = 'default', title, lockTitle = true } = {}) {
    const sid = String(sessionId || '').trim();
    if (!sid) throw new Error('renameSession: sessionId required');
    if (!this.runtime.store.has('sessions', sid)) {
      throw new Error(`renameSession: unknown session ${sid}`);
    }
    const s = this.runtime.store.get('sessions', sid);
    if (!s) throw new Error(`renameSession: unknown session ${sid}`);
    const name = normalizeSessionTitle(title);
    if (!name) throw new Error('renameSession: empty title');
    if (!lockTitle && s.titleLocked) {
      return this.getSession({ sessionId: sid });
    }
    this.runtime.store.put('sessions', sid, {
      ...s,
      title: name,
      name,
      titleLocked: lockTitle ? true : !!s.titleLocked,
      updatedAt: Date.now()
    });
    await this._persist();
    return this.getSession({ sessionId: sid });
  }

  /**
   * Prune sessions not in keepIds — cascade delete durable state (no orphans).
   * Used when UI enforces a max session cap.
   */
  async pruneSessions({ keepSessionIds = [] } = {}) {
    const keep = new Set((keepSessionIds || []).map(String));
    const deleted = [];
    for (const id of [...this.runtime.store.keys('sessions')]) {
      if (keep.has(String(id))) continue;
      this.runtime.deleteSession(id);
      deleted.push(id);
    }
    await this._persist();
    return { deleted, kept: [...keep] };
  }

  /**
   * Product workspace snapshot for Sidepanel selection chrome + bind UI.
   * Default compact=false: returns group items (text/src/…) so selection chips
   * survive refresh. Pass compact=true only for bulk/index RPCs that omit items.
   */
  async getWorkspaceState({ sessionId = 'default', compact = false } = {}) {
    this.ensureSession(sessionId);
    ensureClipboardGroup(this.runtime.store, sessionId);
    let labeledAny = false;
    const boundIds = this.runtime.store.get('sessionBindings', sessionId) || [];
    const groups = this.runtime.store.keys('groups').map((id) => {
      const g = this.runtime.store.get('groups', id);
      if (!g) return null;
      const members = this.runtime.store.get('groupMembers', id) || [];
      /** @type {any[]} */
      let items = [];
      if (!compact) {
        items = members
          .map((mid) => {
            const item = this.runtime.store.get('items', mid);
            if (!item) return null;
            const capture = item.capture || {};
            const source = capture.source || {};
            const preview = capture.preview && typeof capture.preview === 'object'
              ? {
                  tagName: capture.preview.tagName || '',
                  textSnippet: String(capture.preview.textSnippet || '').slice(0, 200),
                  src: capture.preview.src || ''
                }
              : undefined;
            const { item: labeled, assigned } = ensureItemLabel(this.runtime.store, item, {
              groupId: id
            });
            if (assigned) labeledAny = true;
            return {
              webItemId: labeled.webItemId,
              kind: labeled.kindHint,
              kindHint: labeled.kindHint,
              labelKind: labeled.labelKind || '',
              labelN: labeled.labelN || 0,
              handle: labeled.labelN
                ? itemHandle(labeled.labelKind, labeled.labelN)
                : '',
              text: capture.text || preview?.textSnippet || '',
              src: capture.src || preview?.src || '',
              href: capture.href || capture.url || '',
              title: capture.title || source.title || '',
              favicon: capture.favicon || source.favicon || '',
              addedBy: source.addedBy || '',
              selector: capture.selector || capture.locator?.css || '',
              tabId: source.tabId ?? capture.tabId,
              url: capture.url || source.url || capture.href || '',
              pageUrl: capture.url || capture.href || source.url || '',
              preview
            };
          })
          .filter(Boolean);
      }
      return {
        groupId: g.groupId,
        name: g.name,
        kind: g.kind || (isClipboardGroup(g) ? CLIPBOARD_GROUP_KIND : ''),
        ownerSessionId: g.ownerSessionId || g.sessionId || '',
        itemCount: members.length,
        items
      };
    }).filter((row) => {
      if (!row) return false;
      const raw = this.runtime.store.get('groups', row.groupId);
      return groupVisibleToSession(raw, sessionId, boundIds);
    });
    groups.sort((a, b) => {
      const ac = a.kind === CLIPBOARD_GROUP_KIND ? 0 : 1;
      const bc = b.kind === CLIPBOARD_GROUP_KIND ? 0 : 1;
      return ac - bc;
    });
    const bound = boundIds;
    const artifacts = this.runtime.listArtifacts(sessionId);
    if (labeledAny) await this._persist();
    const sess = this.runtime.store.get('sessions', sessionId) || {};
    return {
      groups,
      activeGroupId: readActiveCaptureGroupId(this.runtime.store),
      boundGroupIds: bound,
      artifacts,
      artifactCount: artifacts.length,
      storeKind: this.storeKind,
      compact: !!compact,
      visitedPages: Array.isArray(sess.visitedPages) ? sess.visitedPages : []
    };
  }

  async allocateLabel({ sessionId = 'default', kind = 'image', groupId } = {}) {
    this.ensureSession(sessionId);
    const k = normalizeLabelKind(kind) || 'image';
    const gid = String(groupId || this._sessionActiveGroupId(sessionId) || '');
    const n = allocateLabelN(this.runtime.store, k, gid);
    await this._persist();
    return {
      kind: k,
      n,
      handle: itemHandle(k, n),
      label: formatItemLabel(k, n, 'zh')
    };
  }

  async bindGroups({ sessionId = 'default', groupIds = [] }) {
    this.ensureSession(sessionId);
    this.runtime.bindGroups(sessionId, groupIds);
    await this._persist();
    return this.getWorkspaceState({ sessionId });
  }

  async createGroup({ name, sessionId = 'default', bind = false } = {}) {
    this.ensureSession(sessionId);
    const g = this.runtime.createGroup({ name, sessionId });
    this._writeSessionActiveGroup(sessionId, g.groupId);
    // bind defaults false: selection groups stay ambient until the user binds
    if (bind) {
      const ids = new Set(this.runtime.store.get('sessionBindings', sessionId) || []);
      ids.add(g.groupId);
      this.runtime.bindGroups(sessionId, [...ids]);
    }
    await this._persist();
    return this.getWorkspaceState({ sessionId });
  }

  async renameGroup({ groupId, name, sessionId = 'default' }) {
    this.runtime.renameGroup(groupId, name);
    await this._persist();
    return this.getWorkspaceState({ sessionId });
  }

  async deleteGroup({ groupId, sessionId = 'default' }) {
    this.runtime.deleteGroup(groupId);
    for (const id of this.runtime.store.keys('sessions')) {
      const s = this.runtime.store.get('sessions', id);
      if (s?.activeGroupId === groupId) {
        this.runtime.store.put('sessions', id, {
          ...s,
          activeGroupId: null,
          updatedAt: Date.now()
        });
      }
    }
    if (this.activeGroupId === groupId) this.activeGroupId = null;
    if (readActiveCaptureGroupId(this.runtime.store) === groupId) {
      writeActiveCaptureGroupId(this.runtime.store, null);
    }
    await this._persist();
    return this.getWorkspaceState({ sessionId });
  }

  async setActiveGroup({ groupId, sessionId = 'default' }) {
    if (groupId && !this.runtime.store.has('groups', groupId)) {
      throw new Error(`unknown group ${groupId}`);
    }
    this.ensureSession(sessionId);
    const rec = groupId ? this.runtime.store.get('groups', groupId) : null;
    if (isClipboardGroup(rec)) {
      this._writeSessionActiveGroup(sessionId, null);
      await this._persist();
      return this.getWorkspaceState({ sessionId });
    }
    this._writeSessionActiveGroup(sessionId, groupId || null);
    await this._persist();
    return this.getWorkspaceState({ sessionId });
  }

  async pinClipboard({ sessionId = 'default', items = [] } = {}) {
    this.ensureSession(sessionId);
    pinClipboardItems(this.runtime.store, items, sessionId);
    await this._persist();
    return this.getWorkspaceState({ sessionId });
  }

  async removeClipboardItems({ sessionId = 'default', webItemIds = [] } = {}) {
    this.ensureSession(sessionId);
    const g = ensureClipboardGroup(this.runtime.store, sessionId);
    const ids = Array.isArray(webItemIds) ? webItemIds.map(String) : [];
    for (const id of ids) {
      this.runtime.removeWebItem(g.groupId, id);
    }
    await this._persist();
    return this.getWorkspaceState({ sessionId });
  }

  async clearClipboard({ sessionId = 'default' } = {}) {
    this.ensureSession(sessionId);
    const g = ensureClipboardGroup(this.runtime.store, sessionId);
    const members = [...(this.runtime.store.get('groupMembers', g.groupId) || [])];
    for (const id of members) {
      this.runtime.removeWebItem(g.groupId, id);
    }
    await this._persist();
    return this.getWorkspaceState({ sessionId });
  }

  async removeGroupItem({ sessionId = 'default', groupId, webItemId }) {
    this.runtime.removeWebItem(groupId, webItemId);
    await this._persist();
    return this.getWorkspaceState({ sessionId });
  }

  /**
   * User/UI only: add first-class URL items (页面N) to a capture group.
   * Model tools must never call this.
   */
  async addPageItems({
    sessionId = 'default',
    groupId,
    text = '',
    pages = [],
    url = '',
    title = '',
    favicon = '',
    addedBy = 'paste'
  } = {}) {
    this.ensureSession(sessionId);
    let gid = String(groupId || this._sessionActiveGroupId(sessionId) || '');
    const rec = gid ? this.runtime.store.get('groups', gid) : null;
    if (!gid || isClipboardGroup(rec)) {
      const g = this.runtime.createGroup({ sessionId });
      gid = g.groupId;
      this._writeSessionActiveGroup(sessionId, gid);
    }
    const raw =
      Array.isArray(pages) && pages.length
        ? pages
        : url
          ? [{ url, title, favicon, addedBy }]
          : text;
    const result = addPageItems(this.runtime.store, gid, raw, { addedBy });
    await this._persist();
    const state = await this.getWorkspaceState({ sessionId });
    return {
      ...state,
      pageAdd: {
        groupId: gid,
        addedCount: result.addedCount,
        duplicates: result.duplicates,
        capped: result.capped,
        focusedId: result.focusedId,
        notice: result.notice,
        summary: formatPageAddSummary(result, 'zh'),
        pageCount: result.pageCount
      }
    };
  }

  /** User hit 清空选中: drop every page-capture item in the active group. Clipboard group is untouched. */
  async clearCaptureSelection({ sessionId = 'default' } = {}) {
    this.ensureSession(sessionId);
    const groupId = this._sessionActiveGroupId(sessionId);
    const rec = groupId ? this.runtime.store.get('groups', groupId) : null;
    if (!groupId || isClipboardGroup(rec)) {
      return this.getWorkspaceState({ sessionId });
    }
    const members = [...(this.runtime.store.get('groupMembers', groupId) || [])];
    for (const id of members) {
      this.runtime.removeWebItem(groupId, id);
    }
    await this._persist();
    return this.getWorkspaceState({ sessionId });
  }

  async syncTabSelection({
    sessionId = 'default',
    tabId,
    url,
    origin,
    pageTitle,
    elements = [],
    cleared = false
  } = {}) {
    this.ensureSession(sessionId);
    // Prefer per-session active group (audit H-9)
    let groupId = this._sessionActiveGroupId(sessionId);
    const activeRec = groupId ? this.runtime.store.get('groups', groupId) : null;
    if (isClipboardGroup(activeRec)) groupId = null;
    if (!groupId) {
      const g = this.runtime.createGroup({ sessionId });
      groupId = g.groupId;
    }
    this._writeSessionActiveGroup(sessionId, groupId);

    const { selectionIdentityKey, updateWebItem, addWebItem, removeWebItem, pinClipboardItems, isClipboardTextPick } =
      await import('../sessionWorkspace/groups.js');
    const { gcUnreachableWebItems } = await import('../sessionWorkspace/gc.js');

    const members = /** @type {string[]} */ (
      this.runtime.store.get('groupMembers', groupId) || []
    );
    /** @type {Map<string, string>} identityKey → webItemId for this tab */
    const byKey = new Map();
    for (const id of members) {
      const item = this.runtime.store.get('items', id);
      if (!item) continue;
      if (isPageItem(item)) continue;
      if (String(item.capture?.source?.tabId ?? '') !== String(tabId ?? '')) continue;
      const key = item.identityKey || selectionIdentityKey(item.capture || {});
      byKey.set(key, id);
    }

    const seenKeys = new Set();
    const clipboardTexts = [];
    for (const raw of elements || []) {
      if (
        isClipboardTextPick({
          tag: raw.tag || raw.tagName || '',
          src: raw.src || '',
          href: raw.href || '',
          text: raw.text || raw.textSnippet || '',
          kind: raw.kind || raw.kindHint || '',
          kindHint: raw.kind || raw.kindHint || ''
        })
      ) {
        const snippet = String(raw.text || raw.textSnippet || '').trim();
        if (snippet) clipboardTexts.push(snippet);
        continue;
      }
      const capture = {
        source: { tabId, url, origin, pageTitle },
        locator: { css: raw.selector || raw.css || '' },
        text: raw.text || raw.textSnippet || '',
        src: raw.src || undefined,
        preview: {
          tagName: raw.tag || raw.tagName || '',
          textSnippet: String(raw.text || '').slice(0, 200),
          src: raw.src || undefined
        },
        kindHint: raw.kind || raw.kindHint || undefined,
        href: raw.href || undefined,
        selector: raw.selector
      };
      const key = selectionIdentityKey(capture);
      capture.identityKey = key;
      seenKeys.add(key);
      let item;
      if (byKey.has(key)) {
        // Stable id: update in place (no orphan churn)
        item = updateWebItem(this.runtime.store, byKey.get(key), capture);
      } else {
        item = addWebItem(this.runtime.store, groupId, capture);
      }
      item = ensureItemLabel(this.runtime.store, item, { groupId }).item;
      if (raw.src && String(raw.src).startsWith('data:image')) {
        try {
          const decoded = decodeDataUrl(raw.src);
          this.runtime.store.putBlob(`blob:${item.webItemId}`, decoded.bytes, {
            mimeType: decoded.mimeType
          });
        } catch {
          /* ignore */
        }
      }
    }

    // Drop tab items whose identity disappeared from the new selection.
    // Empty list after a page reload is not a user clear — keep bound items.
    if (cleared === true || (Array.isArray(elements) && elements.length > 0)) {
      for (const [key, id] of byKey) {
        if (seenKeys.has(key)) continue;
        removeWebItem(this.runtime.store, groupId, id);
      }
    }
    gcUnreachableWebItems(this.runtime.store);
    if (clipboardTexts.length) pinClipboardItems(this.runtime.store, clipboardTexts, sessionId);

    await this._persist();
    return this.getWorkspaceState({ sessionId });
  }

  /**
   * Unified product entry — every user message runs general agent.
   */
  async sendMessage({
    sessionId = 'default',
    content,
    role = 'user',
    callModel = null,
    model = null,
    attachments = [],
    mentions = [],
    activeTab = null,
    fetchImpl = undefined,
    onEvent = null,
    reasoning = null
  } = {}) {
    this.ensureSession(sessionId);
    if (role === 'user' && Array.isArray(attachments) && attachments.length) {
      // Attachments: create/bind group so inspect can authorize + multimodal works
      let gid = this._sessionActiveGroupId(sessionId);
      if (!gid) {
        const g = findOrCreateNamedGroup(this.runtime.store, 'Attachments');
        gid = g.groupId;
      }
      this._writeSessionActiveGroup(sessionId, gid);
      for (const att of attachments) {
        const srcKind = String(att.source || '').toLowerCase();
        const isShot =
          srcKind === 'screenshot' ||
          srcKind === 'hotkey' ||
          srcKind === 'button' ||
          srcKind === 'paste';
        const kindHint = isShot ? 'screenshot' : att.isImage ? 'image' : 'text';
        const item = this.runtime.addWebItem(gid, {
          text: att.textContent || att.name || 'attachment',
          src: att.isImage ? att.dataUrl : undefined,
          kindHint,
          preview: { textSnippet: att.name || 'file', mimeType: att.type },
          name: att.name,
          labelKind: att.labelKind,
          labelN: att.labelN,
          sourceKind: isShot ? 'screenshot' : srcKind || 'attachment'
        });
        ensureItemLabel(this.runtime.store, item, {
          source: isShot ? 'screenshot' : '',
          kind: att.labelKind,
          n: att.labelN,
          groupId: gid
        });
        if (att.isImage && att.dataUrl) {
          try {
            const decoded = decodeDataUrl(att.dataUrl);
            this.runtime.store.putBlob(`blob:${item.webItemId}`, decoded.bytes, {
              mimeType: decoded.mimeType || att.type || 'image/png'
            });
          } catch {
            /* ignore */
          }
        }
      }
      // Bind Attachments group to this session
      const bound = new Set(this.runtime.store.get('sessionBindings', sessionId) || []);
      bound.add(gid);
      this.runtime.bindGroups(sessionId, [...bound]);
    }

    const controller = new AbortController();
    this._activeBySession.set(sessionId, {
      controller,
      executionId: null,
      sessionId
    });

    try {
      const injectedCallModel = callModel || this.callModel || null;
      let resolvedModel = model || null;
      // Product path: always re-read API settings (user may configure after offscreen boot)
      if (!injectedCallModel && !resolvedModel) {
        resolvedModel = await this.resolveLanguageModel({ reasoning });
      } else if (!injectedCallModel && resolvedModel) {
        // Prefer fresh settings over a stale boot-time model
        try {
          resolvedModel = await this.resolveLanguageModel({ reasoning });
        } catch {
          // keep existing this.model if re-resolve fails mid-session
          resolvedModel = this.model || resolvedModel;
        }
      }

      let contextWindow;
      try {
        const settings = await loadLlmSettings();
        const cached = await loadCachedModelsForBase(settings.apiBase);
        const hit = findCatalogModel(cached.models || [], settings.model);
        contextWindow = resolveContextWindow(settings.model, hit);
      } catch {
        contextWindow = resolveContextWindow(resolvedModel?.modelId);
      }

      const result = await this.runtime.sendMessage({
        sessionId,
        content,
        role,
        mentions: Array.isArray(mentions) ? mentions : [],
        activeTab:
          activeTab && typeof activeTab === 'object' && activeTab.url ? activeTab : null,
        model: resolvedModel || undefined,
        modelId: resolvedModel?.modelId,
        contextWindow,
        callModel: injectedCallModel || undefined,
        hostSheet: (payload) =>
          chrome.runtime.sendMessage({
            target: 'pawwork-background',
            action: 'sheet_host',
            sessionId,
            ...payload
          }),
        hostCanvas: (payload) =>
          chrome.runtime.sendMessage({
            target: 'pawwork-background',
            action: 'canvas_host',
            sessionId,
            ...payload
          }),
        hostPageCapture: (payload) =>
          chrome.runtime.sendMessage({
            target: 'pawwork-background',
            action: 'workspace_capture_page_blueprint',
            sessionId,
            tabId: payload?.tabId ?? activeTab?.tabId ?? activeTab?.id,
            url: payload?.url || activeTab?.url
          }),
        hostFindTab: (url) =>
          chrome.runtime.sendMessage({
            target: 'pawwork-background',
            action: 'workspace_find_tab',
            sessionId,
            url
          }),
        signal: controller.signal,
        fetchImpl,
        onExecutionBegin: ({ executionId }) => {
          this._activeByExecution.set(executionId, controller);
          const slot = this._activeBySession.get(sessionId);
          if (slot) slot.executionId = executionId;
          this._broadcastUiEvent({
            type: 'execution-start',
            sessionId,
            executionId
          });
        },
        onEvent: (ev) => {
          this._broadcastUiEvent({ sessionId, ...ev });
          if (typeof onEvent === 'function') {
            try {
              onEvent(ev);
            } catch {
              /* test/host listener must not fail the turn */
            }
          }
        }
      });
      await this._persist();
      return result;
    } finally {
      this._activeBySession.delete(sessionId);
      for (const [eid, c] of [...this._activeByExecution.entries()]) {
        if (c === controller) this._activeByExecution.delete(eid);
      }
    }
  }

  /**
   * Real abort — cancels in-flight model/tool/code for session or execution.
   */
  async abortExecution({ sessionId, executionId } = {}) {
    let aborted = false;
    if (executionId && this._activeByExecution.has(executionId)) {
      this._activeByExecution.get(executionId).abort(createUserStopError());
      aborted = true;
    }
    if (sessionId && this._activeBySession.has(sessionId)) {
      this._activeBySession.get(sessionId).controller.abort(createUserStopError());
      aborted = true;
    }
    // Also abort all if neither specified
    if (!sessionId && !executionId) {
      for (const slot of this._activeBySession.values()) {
        slot.controller.abort(createUserStopError());
        aborted = true;
      }
      abortSessionClarifies();
    } else {
      abortSessionClarifies(sessionId);
    }
    return { ok: true, aborted, deprecated: false };
  }

  /** Sidepanel: user answered the clarify card. Resumes the paused tool loop. */
  async answerClarify(params = {}) {
    return answerClarify(params);
  }

  /** Product Stop hook (Sidepanel). */
  async abortTask({ sessionId, executionId, taskId } = {}) {
    return this.abortExecution({
      sessionId: sessionId || undefined,
      executionId: executionId || taskId || undefined
    });
  }

  async listSkills() {
    const durable = await getDurableSkillStore().list();
    return mergeSkillCatalog(listPackagedSkillCatalog(), durable);
  }

  async getSkillDetail({ id } = {}) {
    const packed = getSkill(id);
    const durable = await getDurableSkillStore().get(id);
    const rec = mergeSkillRecord(packed, durable);
    if (!rec) throw new Error(`unknown skill ${id}`);
    const instructions =
      typeof rec.instructions === 'function' ? rec.instructions() : rec.instructions || '';
    return {
      id: rec.id,
      name: rec.name,
      description: rec.description,
      instructions,
      origin: rec.origin || 'packaged',
      sourceUrl: rec.sourceUrl || '',
      resources: Object.keys(rec.resources || {}).map((path) => ({
        path,
        guestPath: `/scratch/skills/${rec.id}/${path}`,
        preview: String(rec.resources[path] || '').slice(0, 400)
      })),
      guestRoot: `/scratch/skills/${rec.id}`
    };
  }

  async upsertSkill(params = {}) {
    const id = sanitizeSkillId(params.id || params.name);
    const existing = id ? await getDurableSkillStore().get(id) : null;
    const saved = await getDurableSkillStore().upsert(
      normalizeDurableSkill({
        ...(existing || {}),
        ...params,
        resources:
          params.resources && Object.keys(params.resources).length
            ? params.resources
            : existing?.resources,
        sourceUrl: params.sourceUrl || existing?.sourceUrl || '',
        origin: params.origin || existing?.origin || 'authored'
      })
    );
    return { ok: true, skill: { id: saved.id, name: saved.name, description: saved.description, origin: saved.origin } };
  }

  async importSkill({ url } = {}) {
    const imported = await importSkillFromUrl(url);
    if (!imported.ok) return imported;
    const saved = await getDurableSkillStore().upsert(imported.skill);
    return { ok: true, skill: { id: saved.id, name: saved.name, description: saved.description, origin: saved.origin } };
  }

  async deleteSkill({ id } = {}) {
    await getDurableSkillStore().remove(id);
    return { ok: true, id };
  }

  async listArtifacts({ sessionId = 'default' } = {}) {
    this.ensureSession(sessionId);
    return this.runtime.listArtifacts(sessionId);
  }

  /**
   * Read durable artifact content for preview / download (binary-safe).
   */
  async readArtifact({ sessionId = 'default', artifactId } = {}) {
    this.ensureSession(sessionId);
    const gate = assertArtifactOwned(this.runtime.store, sessionId, artifactId);
    if (!gate.ok) {
      throw new Error(gate.error || `artifact not found: ${artifactId}`);
    }
    const rec = gate.record;
    // Lazy hydrate OPFS bytes for this session before guest read (H-11)
    if (typeof this.runtime.store.hydrateSessionBlobs === 'function') {
      await this.runtime.store.hydrateSessionBlobs(sessionId);
    }
    const fs = createSessionGuestFs(this.runtime.store, { sessionId, executionId: null });
    let content = '';
    /** @type {Uint8Array|null} */
    let bytes = null;
    try {
      const hostPath = fs._hostPath(rec.primaryPath);
      const nodeKey = fs._nodeKey(hostPath);
      if (typeof this.runtime.store.getBlobAsync === 'function') {
        const blob = await this.runtime.store.getBlobAsync(nodeKey);
        if (blob?.bytes) bytes = blob.bytes;
      }
      if (!bytes) bytes = fs.readFileBytes(rec.primaryPath);
      const textLike = /^text\/|json|xml|javascript|markdown|csv/i.test(rec.mimeType || '');
      content = textLike ? new TextDecoder().decode(bytes) : '';
    } catch (e) {
      throw new Error(
        `artifact content unreadable: ${e instanceof Error ? e.message : String(e)}`
      );
    }
    return {
      artifact: rec,
      content,
      byteLength: bytes?.byteLength || 0,
      mimeType: rec.mimeType || 'application/octet-stream',
      base64: bytes ? bytesToBase64(bytes) : ''
    };
  }

  async createArtifact({ sessionId = 'default', name, content, mimeType, path, base64 } = {}) {
    this.ensureSession(sessionId);
    const fs = createSessionGuestFs(this.runtime.store, { sessionId, executionId: null });
    const rec = createArtifactRecord(this.runtime.store, fs, {
      sessionId,
      name: name || 'stage.html',
      content: bytesFromRpcContent({ content, base64 }),
      mimeType,
      path
    });
    await this._persist();
    return { ok: true, artifact: rec };
  }

  async rewriteGuestMedia({ sessionId = 'default', html } = {}) {
    this.ensureSession(sessionId);
    if (typeof this.runtime.store.hydrateSessionBlobs === 'function') {
      await this.runtime.store.hydrateSessionBlobs(sessionId);
    }
    const fs = createSessionGuestFs(this.runtime.store, { sessionId, executionId: null });
    return { html: rewriteGuestImageSrcs(html, fs, this.runtime.store, sessionId) };
  }

  async revertArtifact({ sessionId = 'default', artifactId } = {}) {
    this.ensureSession(sessionId);
    const fs = createSessionGuestFs(this.runtime.store, { sessionId, executionId: null });
    const out = revertArtifactContent(this.runtime.store, fs, sessionId, artifactId);
    if (!out.ok) {
      const err = new Error(out.error || 'revert failed');
      err.code = out.code;
      throw err;
    }
    await this._persist();
    return out;
  }

  async updateArtifact({ sessionId = 'default', artifactId, content, mimeType, base64, name } = {}) {
    this.ensureSession(sessionId);
    const fs = createSessionGuestFs(this.runtime.store, { sessionId, executionId: null });
    const rec = updateArtifactContent(
      this.runtime.store,
      fs,
      sessionId,
      artifactId,
      bytesFromRpcContent({ content, base64 }),
      { mimeType, name }
    );
    await this._persist();
    return { ok: true, artifact: rec };
  }

  async deleteArtifact({ sessionId = 'default', artifactId } = {}) {
    this.ensureSession(sessionId);
    const fs = createSessionGuestFs(this.runtime.store, { sessionId, executionId: null });
    const result = deleteArtifactRecord(this.runtime.store, fs, sessionId, artifactId);
    if (!result.deleted) {
      throw new Error(result.error || 'delete failed');
    }
    await this._persist();
    return {
      ...result,
      artifacts: this.runtime.listArtifacts(sessionId),
      artifactCount: this.runtime.listArtifacts(sessionId).length
    };
  }

  /**
   * Storage visibility for Session shelf (not OPFS paths).
   * Counts all package files under session artifacts, not only primary size.
   */
  async getStorageStats({ sessionId = 'default' } = {}) {
    this.ensureSession(sessionId);
    const arts = this.runtime.listArtifacts(sessionId);
    let artifactBytes = 0;
    const fs = createSessionGuestFs(this.runtime.store, { sessionId, executionId: null });
    for (const a of arts) {
      const packagePrefix = `/artifacts/${a.packageDir}`;
      for (const guest of fs.list(packagePrefix)) {
        try {
          const b = fs.readFileBytes(guest);
          artifactBytes += b.byteLength;
        } catch {
          artifactBytes += Number(a.size) || 0;
        }
      }
    }
    let blobBytes = 0;
    for (const bk of this.runtime.store.blobs.keys()) {
      if (String(bk).includes(`/${sessionId}/`)) {
        const b = this.runtime.store.getBlob(bk);
        if (b) blobBytes += b.bytes.byteLength;
      }
    }
    let fileCount = 0;
    for (const hp of this.runtime.store.keys('fsNodes')) {
      const node = this.runtime.store.get('fsNodes', hp);
      if (!node || node.sessionId !== sessionId) continue;
      if (node.kind === 'dir') continue;
      const guest = String(node.guestPath || '');
      if (guest.startsWith('/artifacts')) fileCount += 1;
    }
    return {
      sessionId,
      artifactCount: arts.length,
      fileCount,
      artifactBytes,
      blobBytes,
      storeKind: this.storeKind
    };
  }

  async deleteSession({ sessionId }) {
    if (!sessionId) throw new Error('deleteSession: sessionId required');
    // Abort any in-flight work for this session
    await this.abortExecution({ sessionId });
    const result = this.runtime.deleteSession(sessionId);
    await this._persist();
    return result;
  }

  /** Startup / manual orphan scratch cleanup */
  async sweepOrphans() {
    const r = sweepOrphanScratch(this.runtime.store);
    gcUnreachableWebItems(this.runtime.store);
    await this._persist();
    return r;
  }

  /**
   * Audit P1.10 — storage pressure: estimate (when available) + soft disposable GC.
   * Never deletes durable artifacts.
   */
  async applyStoragePressure({ level = 'soft' } = {}) {
    const { applyStoragePressure } = await import('../sessionWorkspace/gc.js');
    const before = await this.estimateStorage();
    const result = applyStoragePressure(this.runtime.store, { level });
    sweepOrphanScratch(this.runtime.store);
    await this._persist();
    const after = await this.estimateStorage();
    return { ...result, before, after, artifactsPreserved: result.artifactsPreserved };
  }

  async estimateStorage() {
    let quota = null;
    let usage = null;
    try {
      if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
        const est = await navigator.storage.estimate();
        quota = est.quota ?? null;
        usage = est.usage ?? null;
      }
    } catch {
      /* ignore */
    }
    let blobBytes = 0;
    for (const bk of this.runtime.store.blobs.keys()) {
      const b = this.runtime.store.getBlob(bk);
      if (b) blobBytes += b.bytes.byteLength;
    }
    return {
      quota,
      usage,
      blobBytes,
      pressure:
        quota && usage != null && quota > 0 ? usage / quota : blobBytes > 50 * 1024 * 1024 ? 1 : 0
    };
  }

  async setActiveWorkbook({ sessionId = 'default', artifactId, overview } = {}) {
    this.ensureSession(sessionId);
    const s = this.runtime.store.get('sessions', sessionId);
    if (!s) throw new Error(`unknown session ${sessionId}`);
    this.runtime.store.put('sessions', sessionId, {
      ...s,
      activeWorkbook: {
        artifactId: String(artifactId || s.activeWorkbook?.artifactId || ''),
        overview: overview || s.activeWorkbook?.overview || null,
        updatedAt: Date.now()
      },
      updatedAt: Date.now()
    });
    return { ok: true };
  }

  async setActiveHtml({ sessionId = 'default', artifactId, overview } = {}) {
    this.ensureSession(sessionId);
    const s = this.runtime.store.get('sessions', sessionId);
    if (!s) throw new Error(`unknown session ${sessionId}`);
    const selections = Array.isArray(overview?.selections)
      ? overview.selections.map((sel) => ({
          plateId: sel.plateId || sel.sheet || '',
          slotId: sel.nodeId || sel.slotId || sel.a1 || '',
          nodeId: sel.nodeId || sel.slotId || '',
          sheet: sel.sheet || sel.plateId || '',
          a1: sel.a1 || sel.slotId || sel.nodeId || '',
          tag: sel.tag || '',
          kind: sel.kind || sel.type || '',
          type: sel.type || sel.kind || '',
          text: sel.text || ''
        }))
      : [];
    this.runtime.store.put('sessions', sessionId, {
      ...s,
      activeHtml: {
        artifactId: String(artifactId || s.activeHtml?.artifactId || ''),
        overview: overview || s.activeHtml?.overview || null,
        selections,
        updatedAt: Date.now()
      },
      updatedAt: Date.now()
    });
    return { ok: true };
  }

  /**
   * Sidepanel 新建 strip — user-initiated blank Design / Slides / Sheet / Doc / Site.
   * Sheet reuses createSheetArtifact (createWorkbook host path).
   */
  async createBlankArtifact({ sessionId = 'default', kind } = {}) {
    this.ensureSession(sessionId);
    const spec = blankArtifactPayload(kind);
    if (spec.kind === 'sheet') {
      const created = await this.createSheetArtifact({
        sessionId,
        name: 'workbook.csv',
        sheets: [{ name: 'Sheet1', rows: [['列1']] }],
        kind: 'csv'
      });
      return { ...created, kind: 'sheet' };
    }
    const fs = createSessionGuestFs(this.runtime.store, { sessionId, executionId: null });
    const rec = createArtifactRecord(this.runtime.store, fs, {
      sessionId,
      name: spec.name,
      content: spec.content,
      mimeType: spec.mimeType,
      folder: spec.folder
    });
    await this._persist();
    return { ok: true, artifact: rec, kind: spec.kind };
  }

  async createSheetArtifact({ sessionId = 'default', name, sheets, kind = 'csv' } = {}) {
    this.ensureSession(sessionId);
    const fs = createSessionGuestFs(this.runtime.store, { sessionId, executionId: null });
    const list = Array.isArray(sheets) && sheets.length ? sheets : [{ name: 'Sheet1', rows: [['列1', '列2', '列3']] }];
    const delim = kind === 'tsv' ? '\t' : ',';
    const body = aoaToCsv(list[0].rows || [], delim);
    let fileName = String(name || 'workbook.csv').replace(/[^\w.\u4e00-\u9fff-]+/g, '_');
    if (!/\.(csv|tsv)$/i.test(fileName)) fileName += kind === 'tsv' ? '.tsv' : '.csv';
    const mimeType = guessMimeFromName(fileName.toLowerCase());
    const rec = createArtifactRecord(this.runtime.store, fs, {
      sessionId,
      name: fileName,
      content: body,
      mimeType
    });
    await this.setActiveWorkbook({
      sessionId,
      artifactId: rec.artifactId,
      overview: {
        name: fileName,
        kind: kind === 'tsv' ? 'tsv' : 'csv',
        sheets: list.map((s) => ({
          name: s.name || 'Sheet1',
          rowCount: (s.rows || []).length,
          columnCount: (s.rows?.[0] || []).length,
          headers: (s.rows?.[0] || []).map((h) => String(h ?? ''))
        }))
      }
    });
    await this._persist();
    return { ok: true, artifact: rec };
  }

  /**
   * Welcome chips after selection settles. One generateText, no tools, not sendMessage.
   */
  async suggestSelectionActions({ sessionId = 'default', selection = {}, lang = 'zh' } = {}) {
    this.ensureSession(sessionId);
    if (this._activeBySession.has(sessionId)) {
      return { chips: [], skipped: 'busy' };
    }
    const model = await this.resolveLanguageModel();
    const chips = await runSelectionSuggest({
      model,
      selection: { ...selection, lang: selection.lang || lang }
    });
    return { chips };
  }

  /** @deprecated — use artifacts */
  async readOutput() {
    return { ok: false, error: 'use session artifacts', deprecated: true };
  }

  /** @deprecated */
  async getTaskResult() {
    return { status: 'unknown', result: null, deprecated: true };
  }

  get supportsLegacyFreezeCommit() {
    return false;
  }
}

const UI_EVENT_DROP_KEYS = new Set(['dataUrl', 'base64', 'bytes', 'imageBase64']);
const UI_EVENT_CLIP_KEYS = new Set(['preview', 'playbook', 'html']);
const UI_EVENT_CLIP_CHARS = 800;

function slimWorkspaceUiValue(value, depth = 0) {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.length > UI_EVENT_CLIP_CHARS ? `${value.slice(0, UI_EVENT_CLIP_CHARS)}…` : value;
  }
  if (depth >= 5) return undefined;
  if (Array.isArray(value)) return value.slice(0, 24).map((v) => slimWorkspaceUiValue(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (UI_EVENT_DROP_KEYS.has(k)) continue;
      if (UI_EVENT_CLIP_KEYS.has(k) && typeof v === 'string') {
        out[k] = slimWorkspaceUiValue(v);
        continue;
      }
      if ((k === 'preview' || k === 'content') && typeof v === 'string' && depth >= 1) {
        out[k] = slimWorkspaceUiValue(v);
        continue;
      }
      const slim = slimWorkspaceUiValue(v, depth + 1);
      if (slim !== undefined) out[k] = slim;
    }
    return out;
  }
  return undefined;
}

/** Chrome runtime messages cannot carry megabyte data URLs; artifacts stay on the shelf. */
export function stripWorkspaceUiEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return event;
  const out = {};
  for (const [k, v] of Object.entries(event)) {
    if (UI_EVENT_DROP_KEYS.has(k)) continue;
    if (k === 'result' || k === 'args' || k === 'output' || k === 'input') {
      out[k] = slimWorkspaceUiValue(v, 1);
      continue;
    }
    out[k] = v;
  }
  return out;
}

function decodeDataUrl(dataUrl) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/i.exec(String(dataUrl || ''));
  if (!m) throw new Error('invalid data url');
  const mimeType = m[1] || 'application/octet-stream';
  const payload = m[3] || '';
  if (m[2]) {
    if (typeof Buffer !== 'undefined') {
      return { bytes: new Uint8Array(Buffer.from(payload, 'base64')), mimeType };
    }
    const bin = atob(payload);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, mimeType };
  }
  return { bytes: new TextEncoder().encode(decodeURIComponent(payload)), mimeType };
}

function bytesToBase64(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

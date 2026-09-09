/**
 * Durable-oriented Session Workspace store.
 * Metadata in maps (IDB-shaped); artifact/scratch bytes as blobs.
 * Supports snapshot/restore for restart durability tests.
 */

export class SessionWorkspaceStore {
  constructor() {
    /** @type {Map<string, any>} */
    this.sessions = new Map();
    /** @type {Map<string, any>} */
    this.groups = new Map();
    /** @type {Map<string, string[]>} */
    this.groupMembers = new Map();
    /** @type {Map<string, any>} */
    this.items = new Map();
    /** @type {Map<string, string[]>} */
    this.sessionBindings = new Map();
    /** @type {Map<string, any>} */
    this.artifacts = new Map();
    /** @type {Map<string, { bytes: Uint8Array, mimeType?: string }>} */
    this.blobs = new Map();
    /** @type {Map<string, any>} */
    this.fsNodes = new Map();
    /** @type {Map<string, any>} */
    this.executions = new Map();
    /** @type {Map<string, Set<string>>} */
    this.leases = new Map();
    /** @type {Map<string, any>} */
    this.meta = new Map();
  }

  put(collection, key, value) {
    const map = this._map(collection);
    map.set(String(key), value);
    return value;
  }

  get(collection, key) {
    return this._map(collection).get(String(key)) ?? null;
  }

  has(collection, key) {
    return this._map(collection).has(String(key));
  }

  delete(collection, key) {
    return this._map(collection).delete(String(key));
  }

  keys(collection) {
    return [...this._map(collection).keys()];
  }

  putBlob(key, bytes, meta = {}) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    this.blobs.set(String(key), { bytes: b, mimeType: meta.mimeType || 'application/octet-stream' });
  }

  getBlob(key) {
    return this.blobs.get(String(key)) || null;
  }

  deleteBlob(key) {
    return this.blobs.delete(String(key));
  }

  /**
   * Snapshot for restart simulation (structured clone of durable state).
   * @returns {object}
   */
  exportSnapshot() {
    return {
      sessions: mapToEntries(this.sessions),
      groups: mapToEntries(this.groups),
      groupMembers: mapToEntries(this.groupMembers),
      items: mapToEntries(this.items),
      sessionBindings: mapToEntries(this.sessionBindings),
      artifacts: mapToEntries(this.artifacts),
      blobs: [...this.blobs.entries()].map(([k, v]) => [
        k,
        { mimeType: v.mimeType, bytes: Array.from(v.bytes) }
      ]),
      fsNodes: mapToEntries(this.fsNodes),
      meta: mapToEntries(this.meta)
      // executions/leases intentionally omitted — ephemeral
    };
  }

  /**
   * @param {object} snap
   */
  importSnapshot(snap) {
    if (!snap || typeof snap !== 'object') throw new Error('importSnapshot: invalid');
    this.sessions = entriesToMap(snap.sessions);
    this.groups = entriesToMap(snap.groups);
    this.groupMembers = entriesToMap(snap.groupMembers);
    this.items = entriesToMap(snap.items);
    this.sessionBindings = entriesToMap(snap.sessionBindings);
    this.artifacts = entriesToMap(snap.artifacts);
    this.fsNodes = entriesToMap(snap.fsNodes);
    this.meta = entriesToMap(snap.meta);
    this.blobs = new Map();
    for (const [k, v] of snap.blobs || []) {
      this.blobs.set(k, {
        mimeType: v.mimeType,
        bytes: new Uint8Array(v.bytes || [])
      });
    }
    this.executions = new Map();
    this.leases = new Map();
  }

  _map(name) {
    const m = this[name];
    if (!(m instanceof Map)) throw new Error(`unknown collection: ${name}`);
    return m;
  }
}

function mapToEntries(map) {
  return [...map.entries()];
}

function entriesToMap(entries) {
  return new Map(Array.isArray(entries) ? entries : []);
}

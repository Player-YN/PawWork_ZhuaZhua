/**
 * Live-tab audio: SW getMediaStreamId → offscreen getUserMedia + MediaRecorder ring.
 * clip writes /scratch. Does not transcribe unless the caller asks.
 */

export const LISTEN_OPS = Object.freeze(['start', 'clip', 'stop', 'wait']);
export const LISTEN_CLIP_DEFAULT_SECONDS = 15;
export const LISTEN_CLIP_MAX_SECONDS = 60;
export const LISTEN_RING_SECONDS = 60;
export const LISTEN_WAIT_DEFAULT_MS = 15000;
export const LISTEN_WAIT_MAX_MS = 60000;
export const LISTEN_SOUND_RMS = 0.012;
export const LISTEN_TIMESLICE_MS = 400;

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg'
];

export function isCaptureGrantError(error) {
  const msg = String(error?.message || error || '').toLowerCase();
  return /user gesture|not been invoked|activetab|must be invoked|extension has not been|gesture requirement|getusermedia/i.test(msg)
    && /gesture|invoked|activetab|permission|notallowed|notallowederror/i.test(msg);
}

export function parseListenOp(value) {
  const listen = String(value || '').trim().toLowerCase();
  return LISTEN_OPS.includes(listen) ? listen : '';
}

export function clampListenSeconds(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return LISTEN_CLIP_DEFAULT_SECONDS;
  return Math.min(LISTEN_CLIP_MAX_SECONDS, Math.max(1, n));
}

export function clampListenWaitMs(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return LISTEN_WAIT_DEFAULT_MS;
  return Math.min(LISTEN_WAIT_MAX_MS, Math.max(200, n));
}

export function parseListenWaitMode(text) {
  const mode = String(text || 'sound').trim().toLowerCase();
  return mode === 'silence' ? 'silence' : mode === 'sound' ? 'sound' : '';
}

export function rmsFromSamples(samples) {
  const list = samples && typeof samples.length === 'number' ? samples : [];
  if (!list.length) return 0;
  let sum = 0;
  for (let i = 0; i < list.length; i++) {
    const v = Number(list[i]) || 0;
    sum += v * v;
  }
  return Math.sqrt(sum / list.length);
}

export function energyFromRms(rms, threshold = LISTEN_SOUND_RMS) {
  const value = Number(rms);
  const n = Number.isFinite(value) ? value : 0;
  return { rms: n, hadSound: n >= threshold };
}

export function pickListenMimeType(isTypeSupported) {
  const check = typeof isTypeSupported === 'function'
    ? isTypeSupported
    : (type) => typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(type);
  for (const type of MIME_CANDIDATES) {
    try {
      if (check(type)) return type;
    } catch {
      /* ignore */
    }
  }
  return 'audio/webm';
}

export function listenExtFromMime(mimeType) {
  return /ogg/i.test(String(mimeType || '')) ? 'ogg' : 'webm';
}

export function tabCaptureMediaConstraints(streamId) {
  const id = String(streamId || '');
  return {
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: id
      }
    }
  };
}

export function sliceRingChunks(chunks, seconds, now) {
  const list = Array.isArray(chunks) ? chunks : [];
  const windowMs = clampListenSeconds(seconds) * 1000;
  const from = Number(now) - windowMs;
  return list.filter((row) => Number(row?.at) >= from);
}

export function concatChunkBytes(chunks) {
  const parts = (Array.isArray(chunks) ? chunks : [])
    .map((row) => (row?.bytes instanceof Uint8Array ? row.bytes : null))
    .filter(Boolean);
  const total = parts.reduce((n, part) => n + part.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

export function meanRms(chunks) {
  const list = (Array.isArray(chunks) ? chunks : []).map((row) => Number(row?.rms)).filter((n) => Number.isFinite(n));
  if (!list.length) return 0;
  return list.reduce((a, b) => a + b, 0) / list.length;
}

/**
 * SW getMediaStreamId first; on NEED_CAPTURE_GRANT run a one-shot grant, then retry.
 * @param {() => Promise<object>} prepareFn
 * @param {(denied: object) => Promise<object>} [grantFn]
 */
export async function resolveListenStreamId(prepareFn, grantFn) {
  const first = await prepareFn();
  if (first?.ok && first.streamId) return first;
  if (first?.code === 'NEED_CAPTURE_GRANT' && typeof grantFn === 'function') {
    const granted = await grantFn(first);
    if (!granted?.ok) return granted;
    if (granted.streamId) {
      return {
        ok: true,
        op: 'listen',
        listen: 'start',
        streamId: String(granted.streamId),
        tabId: granted.tabId ?? first.tabId,
        title: granted.title || first.title || ''
      };
    }
    return prepareFn();
  }
  return first;
}

export async function captureTabAudioStream(streamId, getUserMedia) {
  const id = String(streamId || '');
  if (!id) {
    const err = new Error('streamId required');
    err.code = 'NEED_CAPTURE_GRANT';
    throw err;
  }
  const gum = typeof getUserMedia === 'function'
    ? getUserMedia
    : globalThis.navigator?.mediaDevices?.getUserMedia?.bind(globalThis.navigator.mediaDevices);
  if (typeof gum !== 'function') {
    const err = new Error('getUserMedia unavailable');
    err.code = 'NEED_PAGE';
    throw err;
  }
  const audioOnly = tabCaptureMediaConstraints(id);
  try {
    return await gum(audioOnly);
  } catch (first) {
    try {
      const stream = await gum({
        audio: audioOnly.audio,
        video: {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: id
          }
        }
      });
      for (const track of stream.getVideoTracks?.() || []) {
        try { track.stop(); } catch { /* ignore */ }
      }
      return stream;
    } catch {
      if (isCaptureGrantError(first)) first.code = first.code || 'NEED_CAPTURE_GRANT';
      throw first;
    }
  }
}

function defaultMeasureRms(analyser) {
  if (!analyser || typeof analyser.getFloatTimeDomainData !== 'function') return 0;
  const buf = new Float32Array(analyser.fftSize || 2048);
  analyser.getFloatTimeDomainData(buf);
  return rmsFromSamples(buf);
}

function stopTracks(stream) {
  try {
    for (const track of stream?.getTracks?.() || []) track.stop();
  } catch {
    /* ignore */
  }
}

/**
 * Offscreen listen session. Inject getUserMedia / MediaRecorder / fs for tests.
 */
export function createTabListenRuntime(deps = {}) {
  let session = null;
  const nowFn = typeof deps.now === 'function' ? deps.now : () => Date.now();
  const sleep = typeof deps.sleep === 'function'
    ? deps.sleep
    : (ms, signal) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        signal?.removeEventListener?.('abort', onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(timer);
        const err = new Error('aborted');
        err.code = 'SYS_ABORTED';
        reject(err);
      };
      if (signal?.aborted) {
        clearTimeout(timer);
        onAbort();
        return;
      }
      signal?.addEventListener?.('abort', onAbort, { once: true });
    });

  function measure() {
    if (typeof deps.measureRms === 'function') return Number(deps.measureRms(session)) || 0;
    return defaultMeasureRms(session?.analyser);
  }

  function prune(at) {
    if (!session) return;
    const from = at - LISTEN_RING_SECONDS * 1000;
    session.chunks = session.chunks.filter((row) => row.at >= from);
  }

  async function rememberChunk(data, at, rms) {
    let bytes = null;
    if (data instanceof Uint8Array) bytes = data;
    else if (data && typeof data.arrayBuffer === 'function') {
      bytes = new Uint8Array(await data.arrayBuffer());
    }
    if (!bytes || !bytes.byteLength) return;
    session.chunks.push({ at, bytes, rms });
    prune(at);
  }

  function attachAnalyser(stream) {
    const AC = deps.AudioContext || globalThis.AudioContext || globalThis.webkitAudioContext;
    if (typeof AC !== 'function') return { context: null, analyser: null };
    try {
      const context = new AC();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      return { context, analyser };
    } catch {
      return { context: null, analyser: null };
    }
  }

  async function stopInternal() {
    const cur = session;
    session = null;
    if (!cur) return { ok: true, op: 'listen', listen: 'stop', stopped: true };
    try { if (cur.recorder && cur.recorder.state !== 'inactive') cur.recorder.stop(); } catch { /* ignore */ }
    stopTracks(cur.stream);
    try { await cur.context?.close?.(); } catch { /* ignore */ }
    return { ok: true, op: 'listen', listen: 'stop', stopped: true, tabId: cur.tabId };
  }

  return {
    snapshot() {
      if (!session) return { capturing: false };
      return {
        capturing: true,
        tabId: session.tabId,
        sessionId: session.sessionId,
        executionId: session.executionId,
        mimeType: session.mimeType,
        chunks: session.chunks.length
      };
    },

    async start(input = {}) {
      const tabId = Number(input.tabId);
      const streamId = String(input.streamId || '');
      if (!streamId) {
        return { ok: false, code: 'NEED_CAPTURE_GRANT', error: 'listen start needs a tab media stream id' };
      }
      if (session && Number(session.tabId) === tabId) {
        return {
          ok: true,
          op: 'listen',
          listen: 'start',
          tabId,
          title: input.title || session.title || '',
          capturing: true
        };
      }
      if (session) await stopInternal();
      let stream;
      try {
        stream = await captureTabAudioStream(streamId, deps.getUserMedia);
      } catch (error) {
        return {
          ok: false,
          code: error?.code || (isCaptureGrantError(error) ? 'NEED_CAPTURE_GRANT' : 'NEED_PAGE'),
          error: error instanceof Error ? error.message : String(error)
        };
      }
      const mimeType = pickListenMimeType(deps.isTypeSupported);
      const Recorder = deps.MediaRecorder || globalThis.MediaRecorder;
      if (typeof Recorder !== 'function') {
        stopTracks(stream);
        return { ok: false, code: 'NEED_PAGE', error: 'MediaRecorder unavailable' };
      }
      let recorder;
      try {
        recorder = mimeType ? new Recorder(stream, { mimeType }) : new Recorder(stream);
      } catch {
        recorder = new Recorder(stream);
      }
      const { context, analyser } = attachAnalyser(stream);
      session = {
        tabId,
        title: input.title || '',
        sessionId: String(input.sessionId || ''),
        executionId: String(input.executionId || ''),
        stream,
        recorder,
        context,
        analyser,
        mimeType: recorder.mimeType || mimeType,
        chunks: [],
        startedAt: nowFn()
      };
      recorder.ondataavailable = (ev) => {
        const data = ev?.data;
        const at = nowFn();
        const rms = measure();
        void rememberChunk(data, at, rms);
      };
      try {
        recorder.start(LISTEN_TIMESLICE_MS);
      } catch (error) {
        await stopInternal();
        return { ok: false, code: 'NEED_PAGE', error: error instanceof Error ? error.message : String(error) };
      }
      return {
        ok: true,
        op: 'listen',
        listen: 'start',
        tabId,
        title: input.title || '',
        capturing: true
      };
    },

    async clip(input = {}) {
      if (!session) return { ok: false, code: 'NO_TARGET', error: 'listen start first' };
      const seconds = clampListenSeconds(input.seconds);
      const at = nowFn();
      prune(at);
      const slice = sliceRingChunks(session.chunks, seconds, at);
      const bytes = concatChunkBytes(slice);
      if (!bytes.byteLength) {
        return { ok: false, code: 'NO_TARGET', error: 'listen ring is empty', tabId: session.tabId };
      }
      const energy = energyFromRms(meanRms(slice));
      const mimeType = session.mimeType || 'audio/webm';
      const ext = listenExtFromMime(mimeType);
      const path = `/scratch/listen-${at.toString(36)}.${ext}`;
      const getFs = deps.getFs;
      if (typeof getFs !== 'function') {
        return { ok: false, code: 'FS_DENIED', error: 'guest filesystem is unavailable' };
      }
      const fs = getFs(session.sessionId, session.executionId);
      if (!fs || typeof fs.writeFile !== 'function') {
        return { ok: false, code: 'FS_DENIED', error: 'guest filesystem is unavailable' };
      }
      try {
        fs.mkdirp?.('/scratch');
        fs.writeFile(path, bytes, { mimeType });
      } catch (error) {
        return { ok: false, code: error?.code || 'FS_DENIED', error: error instanceof Error ? error.message : String(error) };
      }
      const receipt = {
        ok: true,
        op: 'listen',
        listen: 'clip',
        path,
        durationMs: Math.round(seconds * 1000),
        hadSound: energy.hadSound,
        rms: Number(energy.rms.toFixed(4)),
        mimeType,
        bytes: bytes.byteLength,
        tabId: session.tabId
      };
      const wantText = input.transcribe === true;
      if (wantText && typeof deps.transcribeFile === 'function') {
        const settings = typeof deps.loadStt === 'function' ? await deps.loadStt() : null;
        if (settings?.sttKey) {
          const transcribed = await deps.transcribeFile({
            apiKey: settings.sttKey,
            baseURL: settings.sttBaseURL,
            model: settings.sttModel,
            provider: settings.sttProvider,
            bytes,
            filename: path.split('/').pop(),
            mimeType,
            duration: seconds
          });
          if (transcribed?.ok) {
            receipt.text = transcribed.text;
            receipt.language = transcribed.language;
          } else {
            receipt.observationError = {
              code: transcribed?.code || 'STT_HTTP',
              error: transcribed?.error || 'transcription failed'
            };
          }
        }
      }
      return receipt;
    },

    async wait(input = {}) {
      if (!session) return { ok: false, code: 'NO_TARGET', error: 'listen start first' };
      const mode = parseListenWaitMode(input.text);
      if (!mode) {
        return { ok: false, code: 'BAD_INPUT', error: 'listen wait text must be sound or silence' };
      }
      const budget = clampListenWaitMs(input.ms);
      const started = nowFn();
      const signal = input.signal;
      while (nowFn() - started < budget) {
        if (signal?.aborted) {
          return { ok: false, code: 'SYS_ABORTED', error: 'listen wait aborted', tabId: session.tabId };
        }
        const rms = measure();
        const energy = energyFromRms(rms);
        const hit = mode === 'sound' ? energy.hadSound : !energy.hadSound;
        if (hit) {
          const receipt = {
            ok: true,
            op: 'listen',
            listen: 'wait',
            text: mode,
            hadSound: energy.hadSound,
            rms: Number(energy.rms.toFixed(4)),
            durationMs: nowFn() - started,
            tabId: session.tabId
          };
          if (input.transcribe === true && mode === 'sound') {
            const clip = await this.clip({ seconds: input.seconds, transcribe: true });
            if (clip.ok) {
              receipt.path = clip.path;
              receipt.text = clip.text;
              if (clip.observationError) receipt.observationError = clip.observationError;
            } else {
              receipt.observationError = { code: clip.code, error: clip.error };
            }
          }
          return receipt;
        }
        await sleep(120, signal);
      }
      const rms = measure();
      const energy = energyFromRms(rms);
      return {
        ok: false,
        code: 'NO_TARGET',
        error: mode === 'sound' ? 'waited for sound' : 'waited for silence',
        op: 'listen',
        listen: 'wait',
        text: mode,
        hadSound: energy.hadSound,
        rms: Number(energy.rms.toFixed(4)),
        durationMs: nowFn() - started,
        tabId: session.tabId
      };
    },

    async stop() {
      return stopInternal();
    },

    async stopExecution(sessionId, executionId) {
      if (!session) return { ok: true, op: 'listen', listen: 'stop', stopped: true };
      if (sessionId && session.sessionId && session.sessionId !== String(sessionId)) {
        return { ok: true, skipped: true };
      }
      if (executionId && session.executionId && session.executionId !== String(executionId)) {
        return { ok: true, skipped: true };
      }
      return stopInternal();
    },

    /** Test helper: push a ring chunk without MediaRecorder. */
    pushChunk(bytes, rms = 0, at = nowFn()) {
      if (!session) return;
      const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
      session.chunks.push({ at, bytes: buf, rms: Number(rms) || 0 });
      prune(at);
    }
  };
}

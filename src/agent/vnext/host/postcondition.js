/**
 * Minimal postcondition verifier.
 * Model natural-language evidence is never sufficient for verified.
 * Known payment never reaches dispatched, so never reaches this module.
 */

export function defaultPostconditions(input = {}) {
  const channel = String(input.channel || input.intent?.channel || '');
  const risk = String(input.risk || '');
  const op = String(input.op || input.intent?.op || '');
  if (channel === 'download' || op === 'download') {
    return [{ kind: 'download-id', downloadId: input.downloadId }];
  }
  if (channel === 'artifact' || op === 'updateArtifact') {
    return [
      {
        kind: 'artifact-hash',
        artifactId: input.artifactId,
        sha256: input.sha256,
        minRevision: Number(input.minRevision) || 0
      }
    ];
  }
  if (risk === 'delete') {
    return [{ kind: 'dom-snapshot', match: 'control-missing', ref: input.ref }];
  }
  if (channel === 'action') {
    const posts = [];
    if (input.expectedText || input.postText) posts.push({ kind: 'waitFor', text: input.expectedText || input.postText });
    if (input.expectedUrl || input.postUrl) posts.push({ kind: 'url-prefix', value: input.expectedUrl || input.postUrl });
    if (input.expectAbsent || input.postAbsent) posts.push({ kind: 'dom-snapshot', match: 'control-missing', ref: input.ref });
    if (input.expectVisible || input.postVisible) posts.push({ kind: 'dom-snapshot', match: 'text-includes', text: input.expectVisible || input.postVisible });
    return posts;
  }
  if (op === 'fetch' && /POST|PUT|PATCH|DELETE/i.test(String(input.method || ''))) {
    return input.postUrl
      ? [{ kind: 'network-status', min: 200, max: 299 }]
      : [];
  }
  return [];
}

function textIncludes(hay, needle) {
  return String(hay || '').includes(String(needle || ''));
}

export async function verifyPostconditions(row = {}, ctx = {}) {
  if (row.risk === 'payment' && row.confidence === 'known') {
    return { status: 'skipped', source: 'payment-never-dispatched', detail: 'known payment must not enter verifier' };
  }
  const posts = Array.isArray(row.postconditions) && row.postconditions.length
    ? row.postconditions
    : defaultPostconditions(row);
  if (!posts.length) {
    if (row.intent?.channel === 'sys' && /fetch/i.test(row.intent?.op || '') && /POST|PUT|PATCH/i.test(row.intent?.act || '')) {
      return { status: 'needs_human', source: 'unprovable-send', detail: 'No host-checkable postcondition for this send.' };
    }
    if (row.unprovable === true || row.intent?.unprovable === true) {
      return { status: 'needs_human', source: 'unprovable-send', detail: 'No host-checkable postcondition.' };
    }
    return { status: 'skipped', source: 'none', detail: 'no postcondition template' };
  }

  const facts = ctx.facts && typeof ctx.facts === 'object' ? ctx.facts : {};
  let verified = 0;
  let contradiction = false;
  let human = false;
  let source = '';

  for (const post of posts) {
    const kind = String(post.kind || '');
    if (kind === 'dom-snapshot') {
      if (facts.snapshotOk !== true) {
        human = true;
        source = 'no-snapshot';
        continue;
      }
      const controls = Array.isArray(facts.controls) ? facts.controls : [];
      const hit = controls.find((item) => String(item.ref || '') === String(post.ref || ''));
      if (post.match === 'control-missing') {
        if (!hit) {
          verified += 1;
          source = 'dom-missing';
        } else if (facts.toastDeleted === true) {
          human = true;
          source = 'virtual-list';
        } else if (facts.confirmDialog === true) {
          human = true;
          source = 'confirm-dialog';
        }
      } else if (post.match === 'control-disabled') {
        if (hit?.disabled === true || hit?.name === '已发送') {
          verified += 1;
          source = 'dom-disabled';
        } else if (facts.sendFailed === true && hit && hit.disabled !== true) {
          contradiction = true;
        }
      } else if (post.match === 'text-includes' && textIncludes(facts.text, post.text)) {
        verified += 1;
        source = 'dom-text';
      }
    } else if (kind === 'waitFor') {
      if (post.text && textIncludes(facts.text, post.text)) {
        verified += 1;
        source = 'waitFor-text';
      } else if (facts.waitForMatched === true) {
        verified += 1;
        source = 'waitFor';
      }
    } else if (kind === 'url-prefix' || kind === 'url-changed') {
      const url = String(facts.url || '');
      if (kind === 'url-prefix' && post.value && url.startsWith(post.value) && !/checkout|pay/i.test(url)) {
        verified += 1;
        source = 'url';
      }
      if (kind === 'url-changed' && facts.urlChanged === true && !/checkout|pay/i.test(url)) {
        verified += 1;
        source = 'url-changed';
      }
    } else if (kind === 'download-id') {
      const item = facts.download;
      if (item && (item.state === 'in_progress' || item.state === 'complete')) {
        if (facts.expectedBytes != null && item.bytes != null && Number(item.bytes) !== Number(facts.expectedBytes)) {
          contradiction = true;
        } else if (facts.expectedHash && item.hash && item.hash !== facts.expectedHash) {
          contradiction = true;
        } else {
          verified += 1;
          source = 'download';
        }
      } else if (item?.state === 'interrupted') {
        contradiction = true;
      } else if (facts.downloadMatches === 0) {
        return { status: 'retry', source: 'download-missing', detail: 'no download record; not auto-replayed if already dispatched' };
      } else if (facts.downloadMatches >= 2) {
        human = true;
        source = 'download-ambiguous';
      }
    } else if (kind === 'artifact-hash') {
      if (facts.artifactConflict === true) {
        return { status: 'needs_human', source: 'artifact-conflict', detail: 'ARTIFACT_CONFLICT is failed, not unknown' };
      }
      const revision = Number(facts.revision);
      const expected = Number(post.minRevision);
      const hashOk = !post.sha256 || facts.sha256 === post.sha256;
      const revOk = !expected || revision >= expected || facts.idempotent === true;
      if (hashOk && revOk) {
        verified += 1;
        source = 'artifact';
      }
    } else if (kind === 'network-status') {
      const status = Number(facts.status);
      if (status >= (post.min || 200) && status <= (post.max || 299) && facts.bodyHash) {
        verified += 1;
        source = 'http';
      } else if (facts.lostReceipt === true) {
        return { status: 'needs_human', source: 'fetch-unknown', detail: 'Do not replay POST; read back if a GET URL exists.' };
      }
    } else if (kind === 'document-still') {
      if (facts.documentId && facts.documentId === post.documentId) {
        verified += 1;
        source = 'document';
      }
    }
  }

  if (facts.observationError) {
    return { status: 'needs_human', source: 'observationError', detail: facts.observationError.code || 'observation failed after action' };
  }
  if (contradiction) return { status: 'needs_human', source: source || 'contradiction', detail: 'host sources disagree' };
  if (human) return { status: 'needs_human', source: source || 'ambiguous', detail: 'needs a human to inspect' };
  if (verified > 0) return { status: 'verified', source, detail: 'host source matched' };
  if (row.state === 'dispatched' || row.state === 'unknown') {
    return { status: 'needs_human', source: 'already-dispatched', detail: 'Do not replay an already dispatched operation.' };
  }
  return { status: 'retry', source: 'unmet', detail: 'safe retry only before dispatch' };
}

export function applyVerifyToJournalState(row, result) {
  if (!result || result.status === 'skipped') return row.state;
  if (result.status === 'verified') return 'verified';
  if (result.status === 'needs_human') return 'needs_human';
  if (result.status === 'retry' && (row.state === 'dispatched' || row.state === 'unknown')) return 'needs_human';
  return row.state;
}

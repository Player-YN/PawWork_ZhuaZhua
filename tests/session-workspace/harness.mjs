/**
 * Session Workspace Acceptance Harness (S-A … S-R)
 */

import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SESSION_CASE_DEFS = [
  { id: 'S-A', name: 'direct question → text only' },
  { id: 'S-B', name: 'selected context unrelated → no inspect' },
  { id: 'S-C', name: 'selected-context question → inspect + answer, no artifact' },
  { id: 'S-D', name: 'artifact request → run + artifact' },
  { id: 'S-E', name: 'later turn modifies previous artifact' },
  { id: 'S-F', name: 'new session isolated workspace' },
  { id: 'S-G', name: 'cross-session FS read denied' },
  { id: 'S-H', name: 'execution scratch removed after settle' },
  { id: 'S-I', name: 'artifact survives execution settle' },
  { id: 'S-J', name: 'artifact survives runtime restart' },
  { id: 'S-K', name: 'deleting session deletes its artifacts' },
  { id: 'S-L', name: 'deleting session does not delete SelectionGroup' },
  { id: 'S-M', name: 'group mutation visible to future inspect' },
  { id: 'S-N', name: 'active execution lease protects used WebItem' },
  { id: 'S-O', name: 'released unreachable WebItem gets GC' },
  { id: 'S-P', name: 'storage pressure never auto-deletes artifacts' },
  { id: 'S-Q', name: 'many artifacts not injected into initial context' },
  { id: 'S-R', name: 'no Task object created per normal message' }
];

export async function runAllCases() {
  const results = [];
  for (const def of SESSION_CASE_DEFS) {
    const casePath = path.join(__dirname, 'cases', `${def.id}.mjs`);
    try {
      const mod = await import(pathToFileURL(casePath).href);
      if (typeof mod.runCase !== 'function') {
        results.push({ ...def, status: 'pending', detail: 'no runCase() export' });
        continue;
      }
      await mod.runCase();
      results.push({ ...def, status: 'pass' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.startsWith('PENDING:')) {
        results.push({ ...def, status: 'pending', detail: msg.slice(0, 240) });
      } else {
        results.push({ ...def, status: 'fail', detail: msg.slice(0, 500) });
      }
    }
  }
  return results;
}

export function summarizeCases(cases) {
  const pending = cases.filter((c) => c.status === 'pending');
  const pass = cases.filter((c) => c.status === 'pass');
  const fail = cases.filter((c) => c.status === 'fail');
  return {
    total: cases.length,
    pendingCount: pending.length,
    passCount: pass.length,
    failCount: fail.length,
    pendingIds: pending.map((c) => c.id),
    failIds: fail.map((c) => c.id),
    passIds: pass.map((c) => c.id)
  };
}

export function printStatus(cases) {
  const s = summarizeCases(cases);
  for (const c of cases) {
    const mark = c.status === 'pass' ? 'PASS' : c.status === 'fail' ? 'FAIL' : 'PEND';
    console.log(`[${mark}] ${c.id} ${c.name}${c.detail ? ' — ' + c.detail : ''}`);
  }
  console.log(
    `summary: total=${s.total} pass=${s.passCount} fail=${s.failCount} pending=${s.pendingCount}`
  );
  return s;
}

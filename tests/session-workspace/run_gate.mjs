import { runAllCases, printStatus } from './harness.mjs';

const cases = await runAllCases();
const s = printStatus(cases);
console.log('');

if (s.failCount > 0) {
  console.error(`GATE FAIL: ${s.failCount} failed: ${s.failIds.join(', ')}`);
  process.exit(1);
}
if (s.pendingCount > 0) {
  console.error(`GATE FAIL: ${s.pendingCount} pending — skeletons are not green.`);
  console.error(`pending: ${s.pendingIds.join(', ')}`);
  process.exit(1);
}
if (s.passCount !== s.total || s.total === 0) {
  console.error('GATE FAIL: not all cases passed');
  process.exit(1);
}
console.log('GATE PASS: all Session Workspace acceptance cases green (S-A…S-R).');
process.exit(0);

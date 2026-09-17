import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCESS_POLICY_PROFILE_KEY,
  ACCESS_POLICY_SESSION_KEY,
  readEffectiveAccessPolicy,
  writeAccessPolicy,
  createMemoryAccessPolicyStorage,
  installAccessPolicyStorage,
  resetAccessPolicyStorage
} from '../src/agent/vnext/host/accessPolicy.js';
import { accessChipLabel, accessChipTitle } from '../src/sidepanel/accessPolicyUi.js';

function t(key) {
  return {
    accessChipGuarded: 'Guarded',
    accessChipFull: 'Full Access',
    accessChipSession: 'this session',
    accessGuardedHint: 'guarded-hint',
    accessFullHint: 'full-hint-raw-bypass'
  }[key] || key;
}

test('default is Guarded; session override beats profile; remember writes profile', async () => {
  resetAccessPolicyStorage();
  const areas = createMemoryAccessPolicyStorage();
  installAccessPolicyStorage(areas);
  const def = await readEffectiveAccessPolicy();
  assert.equal(def.mode, 'guarded');
  assert.equal(def.source, 'default');

  await writeAccessPolicy({ mode: 'full', rememberProfile: true });
  const remembered = await readEffectiveAccessPolicy();
  assert.equal(remembered.mode, 'full');
  assert.equal(remembered.source, 'profile');
  assert.equal(areas._local.get(ACCESS_POLICY_PROFILE_KEY).mode, 'full');
  assert.equal(areas._session.has(ACCESS_POLICY_SESSION_KEY), false);

  await writeAccessPolicy({ mode: 'full', rememberProfile: false });
  areas._local.set(ACCESS_POLICY_PROFILE_KEY, { mode: 'guarded' });
  const sessionOnly = await writeAccessPolicy({ mode: 'full' });
  assert.equal(sessionOnly.mode, 'full');
  assert.equal(sessionOnly.source, 'session');
  assert.equal(sessionOnly.sessionOverride, 'full');

  const back = await writeAccessPolicy({ mode: 'guarded' });
  assert.equal(back.mode, 'guarded');
  assert.equal(areas._session.has(ACCESS_POLICY_SESSION_KEY), false);
  resetAccessPolicyStorage();
});

test('chip copy never claims Full Access is a hard safety guarantee', () => {
  assert.equal(accessChipLabel({ mode: 'guarded' }, t), 'Guarded');
  assert.match(accessChipLabel({ mode: 'full', source: 'session' }, t), /this session/);
  assert.match(accessChipTitle({ mode: 'full' }, t), /raw-bypass/);
  assert.doesNotMatch(accessChipTitle({ mode: 'full' }, t), /never pay|绝不付款|hard guarantee/i);
});

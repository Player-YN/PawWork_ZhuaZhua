import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyChatVisionCapability,
  isKnownTextOnlyChatModel,
  isKnownVisionChatModel,
  isVisionCapableModel,
  normalizeChatModelId
} from '../../src/agent/modelCatalog.js';
import { isVisionCapableModel as fromScreenshot } from '../../src/screenshot.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

assert.equal(normalizeChatModelId('x-ai/grok-4.6'), 'grok-4.6');
assert.equal(normalizeChatModelId('OpenAI/GPT-4o'), 'gpt-4o');
assert.equal(normalizeChatModelId('  grok-4-fast  '), 'grok-4-fast');

const visionIds = [
  'x-ai/grok-4.6',
  'x-ai/grok-4.6-fast',
  'x-ai/grok-4.6-high',
  'grok-4.6',
  'grok-4-fast',
  'grok-4-high',
  'grok-3',
  'x-ai/grok-3',
  'openai/gpt-4o',
  'gpt-4.1',
  'gpt-5.4',
  'anthropic/claude-sonnet-4',
  'claude-haiku-4',
  'claude-opus-4.1',
  'google/gemini-2.5-flash',
  'qwen2.5-vl-72b',
  'qwen-vl-max',
  'glm-4v-plus',
  'doubao-1.5-vision-pro',
  'deepseek-vl2'
];
for (const id of visionIds) {
  assert.equal(isVisionCapableModel(id), true, `${id} must be multimodal`);
  assert.equal(classifyChatVisionCapability(id), 'vision', `${id} classifies as vision`);
  assert.equal(isKnownTextOnlyChatModel(id), false, `${id} is not text-only`);
}

assert.equal(isVisionCapableModel('totally-unknown-byok-id-xyz'), true, 'unknown id is permissive');
assert.equal(classifyChatVisionCapability('totally-unknown-byok-id-xyz'), 'unknown');
assert.equal(isKnownVisionChatModel('totally-unknown-byok-id-xyz'), false);
assert.equal(isVisionCapableModel(''), true, 'empty id is unknown → permissive');
assert.equal(classifyChatVisionCapability(''), 'unknown');

const textOnlyIds = [
  'deepseek-v4-flash',
  'deepseek-chat',
  'deepseek-v3',
  'deepseek/deepseek-chat',
  'o3-mini',
  'o1-mini',
  'gpt-3.5-turbo',
  'claude-2.1',
  'claude-instant'
];
for (const id of textOnlyIds) {
  assert.equal(isVisionCapableModel(id), false, `${id} remains text-only`);
  assert.equal(classifyChatVisionCapability(id), 'text-only', `${id} classifies as text-only`);
  assert.equal(isKnownTextOnlyChatModel(id), true, `${id} is known text-only`);
}

assert.equal(fromScreenshot('x-ai/grok-4.6'), true, 'screenshot.js re-exports the same classifier');
assert.equal(fromScreenshot('deepseek-v4-flash'), false);

const sidepanel = fs.readFileSync(path.join(root, 'src/sidepanel.js'), 'utf8');
const gate = sidepanel.slice(
  sidepanel.indexOf('hasImageAttachments(currentAttach)'),
  sidepanel.indexOf('hasImageAttachments(currentAttach)') + 900
);
assert.match(gate, /isKnownTextOnlyChatModel/);
assert.match(gate, /showSidepanelToast/);
assert.doesNotMatch(gate, /showCustomModal/);
assert.doesNotMatch(gate, /\breturn;/);

console.log('test_vision_capability: ok');

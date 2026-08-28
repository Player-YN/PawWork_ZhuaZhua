/**
 * Minimal OpenAI-compatible chat/completions mock for packed-extension E2E.
 * First user turn → run createScene. Second user turn → deck replacePlate.
 * After each tool result → short assistant text. Streams SSE when requested.
 */
import http from 'node:http';
import { e2eDeckOutline, slide4ReplaceSlots, SEMANTIC_THEME_ID } from '../session-workspace/harness/semanticDeckFixture.mjs';

export const MOCK_API_KEY = 'sk-e2e-mock-not-a-secret';
export const MOCK_MODEL = 'paw-e2e-mock';

export function createSceneToolArgs() {
  return {
    op: 'createScene',
    themeId: SEMANTIC_THEME_ID,
    kind: 'deck',
    title: 'Paw Work 选区交付',
    ...e2eDeckOutline()
  };
}

export function replacePlateToolArgs() {
  return {
    act: 'write',
    commands: [
      {
        op: 'replacePlate',
        plateId: 'slide-4',
        layoutId: 'quote',
        themeId: SEMANTIC_THEME_ID,
        slots: slide4ReplaceSlots()
      }
    ]
  };
}

function lastMessage(messages) {
  return Array.isArray(messages) && messages.length ? messages[messages.length - 1] : null;
}

function contentLooksLikeToolResult(content) {
  if (Array.isArray(content)) {
    return content.some((p) => p && (p.type === 'tool-result' || p.type === 'tool_result' || p.toolResult));
  }
  return false;
}

function isVisionFollowup(msg) {
  const content = msg?.content;
  if (!Array.isArray(content)) return false;
  return content.some(
    (p) =>
      p &&
      (p.type === 'image_url' ||
        p.type === 'image' ||
        p.type === 'file' ||
        p.image_url ||
        p.image)
  );
}

function messageHasToolResult(msg) {
  if (!msg) return false;
  if (msg.role === 'tool') return true;
  return contentLooksLikeToolResult(msg.content);
}

function isFreshUserTurn(messages) {
  const last = lastMessage(messages);
  if (!last || last.role !== 'user') return false;
  if (contentLooksLikeToolResult(last.content)) return false;
  if (isVisionFollowup(last)) return false;
  return true;
}

function isToolFollowup(messages) {
  return !isFreshUserTurn(messages);
}

function userTurnCount(messages) {
  return (messages || []).filter(
    (m) => m && m.role === 'user' && !contentLooksLikeToolResult(m.content) && !isVisionFollowup(m)
  ).length;
}

function summarizeMessages(messages) {
  return (messages || []).slice(-6).map((m) => ({
    role: m?.role || null,
    tool: messageHasToolResult(m),
    contentType: Array.isArray(m?.content) ? m.content.map((p) => p?.type || typeof p) : typeof m?.content
  }));
}

export function decideMockResponse(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const hasTools = Array.isArray(body?.tools) && body.tools.length > 0;
  if (!hasTools) {
    return { kind: 'text', text: 'Paw Work 介绍' };
  }
  if (!isFreshUserTurn(messages)) {
    const users = userTurnCount(messages);
    const text =
      users >= 2
        ? '已在同一份幻灯上替换第 4 页，没有另开文件。'
        : '已在同一份空白幻灯上编译七页 Paw Work 介绍。';
    return { kind: 'text', text };
  }
  if (userTurnCount(messages) >= 2) {
    return {
      kind: 'tool',
      toolName: 'deck',
      toolCallId: 'call_e2e_replace',
      args: replacePlateToolArgs()
    };
  }
  return {
    kind: 'tool',
    toolName: 'run',
    toolCallId: 'call_e2e_create',
    args: createSceneToolArgs()
  };
}

function sseChunks(id, model, decision) {
  const created = Math.floor(Date.now() / 1000);
  const events = [];
  const chunk = (delta, finish = null) =>
    `data: ${JSON.stringify({
      id,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [{ index: 0, delta, finish_reason: finish }]
    })}\n\n`;
  if (decision.kind === 'tool') {
    events.push(
      chunk({
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            index: 0,
            id: decision.toolCallId,
            type: 'function',
            function: { name: decision.toolName, arguments: JSON.stringify(decision.args) }
          }
        ]
      })
    );
    events.push(chunk({}, 'tool_calls'));
  } else {
    events.push(chunk({ role: 'assistant', content: decision.text }));
    events.push(chunk({}, 'stop'));
  }
  events.push('data: [DONE]\n\n');
  return events.join('');
}

function jsonCompletion(id, model, decision) {
  const created = Math.floor(Date.now() / 1000);
  if (decision.kind === 'tool') {
    return {
      id,
      object: 'chat.completion',
      created,
      model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: decision.toolCallId,
                type: 'function',
                function: { name: decision.toolName, arguments: JSON.stringify(decision.args) }
              }
            ]
          },
          finish_reason: 'tool_calls'
        }
      ]
    };
  }
  return {
    id,
    object: 'chat.completion',
    created,
    model,
    choices: [{ index: 0, message: { role: 'assistant', content: decision.text }, finish_reason: 'stop' }]
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

export function startMockOpenAiServer(opts = {}) {
  const onCall = typeof opts.onCall === 'function' ? opts.onCall : null;
  const calls = [];
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (req.method === 'GET' && /\/models\/?$/.test(url.pathname)) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ object: 'list', data: [{ id: MOCK_MODEL, object: 'model' }] }));
      return;
    }
    if (req.method === 'POST' && /\/chat\/completions\/?$/.test(url.pathname)) {
      let body = {};
      try {
        body = await readJsonBody(req);
      } catch {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'invalid json' } }));
        return;
      }
      const decision = decideMockResponse(body);
      const rec = {
        at: Date.now(),
        path: url.pathname,
        stream: body.stream === true,
        userTurns: userTurnCount(body.messages),
        lastRole: lastMessage(body.messages)?.role || null,
        toolFollowup: isToolFollowup(body.messages),
        toolCount: Array.isArray(body.tools) ? body.tools.length : 0,
        kind: decision.kind,
        toolName: decision.toolName || null,
        tail: summarizeMessages(body.messages)
      };
      calls.push(rec);
      if (typeof onCall === 'function') {
        try {
          onCall(rec);
        } catch {
          /* log hook must not fail the mock */
        }
      }
      const id = `chatcmpl-e2e-${calls.length}`;
      const model = String(body.model || MOCK_MODEL);
      if (body.stream) {
        res.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache',
          connection: 'keep-alive'
        });
        res.end(sseChunks(id, model, decision));
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(jsonCompletion(id, model, decision)));
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { message: `unhandled ${req.method} ${url.pathname}` } }));
  });

  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        server,
        port,
        baseURL: `http://127.0.0.1:${port}/v1`,
        calls,
        close: () => new Promise((r) => server.close(r))
      });
    });
    server.on('error', reject);
  });
}

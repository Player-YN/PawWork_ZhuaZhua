import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { DurableSessionWorkspaceStore } from '../src/agent/vnext/sessionWorkspace/durableStore.js';
import { createGuestSys } from '../src/agent/vnext/sessionWorkspace/browserSys.js';
import { SessionWorkspaceStore } from '../src/agent/vnext/sessionWorkspace/store.js';
import { createSessionGuestFs } from '../src/agent/vnext/sessionWorkspace/fs.js';
import { createArtifact, updateArtifactContent } from '../src/agent/vnext/sessionWorkspace/artifacts.js';
import { clarifyBelongsToSession } from '../src/sidepanel/sessionIsolation.js';

// Stages writes until commit, so a transaction error cannot publish partial data.
function memoryIdb() {
  const rows = new Map();
  const db = {
    fail: false, commits: 0,
    transaction() {
      const staged = new Map(rows);
      const tx = { error: null, abort() { tx.error = new Error('aborted'); }, objectStore() {
        return { put(value, key) { staged.set(key, structuredClone(value)); }, delete(key) { staged.delete(key); } };
      } };
      queueMicrotask(() => {
        if (db.fail || tx.error) {
          tx.error ||= new Error('injected disk failure'); tx.onerror?.();
        } else {
          rows.clear(); for (const [k,v] of staged) rows.set(k,v); db.commits++; tx.oncomplete?.();
        }
      });
      return tx;
    }
  };
  return { db, rows };
}

test('IDB fallback keeps bytes, failures are atomic, and later saves recover', async () => {
  const { db, rows } = memoryIdb();
  const store = new DurableSessionWorkspaceStore();
  store._opened = true; store._db = db;
  store.put('meta', 'version', 1);
  store.putBlob('proof', new Uint8Array([1, 2, 3]));
  await store.flush();
  assert.deepEqual(rows.get('workspace-inline-blobs')[0][1].bytes, [1, 2, 3]);
  const committed = structuredClone([...rows]);
  db.fail = true;
  store.put('meta', 'version', 2);
  store.putBlob('proof', new Uint8Array([4, 5]));
  await assert.rejects(store.flush(), /injected disk failure/);
  assert.deepEqual([...rows], committed);
  db.fail = false;
  await store.flush();
  assert.equal(rows.get('col:meta')[0][1], 2);
  assert.deepEqual(rows.get('workspace-inline-blobs')[0][1].bytes, [4, 5]);
});

test('OPFS replacement does not destroy committed bytes when metadata fails', async () => {
  const { db, rows } = memoryIdb();
  const files = new Map();
  const dir = {
    async getDirectoryHandle() { return dir; },
    async getFileHandle(name) { return { async createWritable() { let bytes; return {
      async write(value) { bytes = new Uint8Array(value); },
      async close() { files.set(name, bytes); }
    }; } }; },
    async removeEntry(name) { files.delete(name); }
  };
  const store = new DurableSessionWorkspaceStore();
  store._opened = true; store._db = db; store._opfs = dir;
  store.putBlob('proof', new Uint8Array([1])); await store.flush();
  const oldPath = rows.get('workspace-meta').blobManifest.proof.path.split('/').pop();
  db.fail = true;
  store.putBlob('proof', new Uint8Array([2]));
  await assert.rejects(store.flush());
  assert.deepEqual([...files.get(oldPath)], [1]);
  assert.equal(files.size, 1);
  db.fail = false; await store.flush();
  assert.equal(files.has(oldPath), false);
  assert.equal(files.size, 1);
  assert.deepEqual([...files.values()][0], new Uint8Array([2]));
});

test('docs drains edits made during a slow save and returns persistence failure', async () => {
  const source = await readFile(new URL('../src/preview/docs.js', import.meta.url), 'utf8');
  const code = source.slice(source.indexOf('async function saveNow('), source.indexOf('\nfunction scheduleSave()'));
  let release; let version = 1; const writes = [];
  const blocked = new Promise(r => release = r);
  const context = vm.createContext({ saving:false, savePromise:null, saveRequested:false, editRevision:0, artifactRevision:0,
    dirty:true, sessionId:'s', artifactId:'a', fileName:'doc', durableData:null, durableSnapshot:null,
    unitId:()=> 'u', setSaveState(){}, setStatus(){}, durableLiveDocument:async()=>({version}),
    normalizeUniverDoc:x=>x, univerDataToSnapshot:x=>x, serializeUniverDoc:JSON.stringify,
    workspaceRpc:async(_,p)=> { writes.push(JSON.parse(p.content)); if(writes.length===1) await blocked; },
    chrome:{runtime:{sendMessage(){}}}, window:{setTimeout(){}} });
  vm.runInContext(code, context);
  const first = context.saveNow(); await new Promise(r=>setImmediate(r));
  version=2; context.editRevision++; context.dirty=true;
  const second = context.saveNow(); release();
  assert.equal((await first).ok, true); await second;
  assert.deepEqual(writes.map(x=>x.version), [1,2]); assert.equal(context.dirty,false);
  context.workspaceRpc=async()=>{throw new Error('disk failure')};
  assert.equal((await context.saveNow()).ok,false); assert.equal(context.dirty,true);
});

globalThis.chrome = { debugger: {} };
const { handleWorkspaceSys, readResponseBytes } = await import('../src/agent/vnext/host/browserSysHost.js');

test('screenshot rejects an inactive target without capturing another tab', async () => {
  let captures=0;
  chrome.tabs={get:async id=>({id,windowId:1,url:'https://example.com'}),query:async()=>[{id:2}],
    captureVisibleTab:async()=>{captures++; return 'data:image/png;base64,AA==';}};
  const result=await handleWorkspaceSys({op:'screenshot',params:{tabId:1}});
  assert.equal(result.code,'TAB_NOT_VISIBLE'); assert.equal(captures,0);
});

test('stream limit cancels the reader before consuming the full response', async () => {
  let cancelled=false; let reads=0;
  const response={body:new ReadableStream({pull(controller){reads++;controller.enqueue(new Uint8Array(4));},cancel(){cancelled=true;}})};
  await assert.rejects(readResponseBytes(response,6),{code:'TOO_LARGE'});
  assert.equal(cancelled,true); assert.ok(reads<=3);
});

test('browser call cancellation reaches fetch, including its body', async () => {
  const original=globalThis.fetch; let seenSignal; let started;
  const ready=new Promise(r=>started=r);
  globalThis.fetch=async(_url,init)=>{seenSignal=init.signal; started(); return {
    body:new ReadableStream({start(controller){init.signal.addEventListener('abort',()=>controller.error(new Error('aborted')));}})
  };};
  try {
    const envelope={callId:'cancel-test',sessionId:'s',executionId:'e'};
    const pending=handleWorkspaceSys({...envelope,op:'fetch',params:{url:'https://example.com'}});
    await ready;
    await handleWorkspaceSys({...envelope,op:'cancel'});
    assert.equal((await pending).code,'SYS_ABORTED'); assert.equal(seenSignal.aborted,true);
    assert.equal((await handleWorkspaceSys({...envelope,op:'fetch',params:{url:'https://example.com'}})).code,'SYS_ABORTED');
  } finally {globalThis.fetch=original;}
});

test('saveTo writes binary bytes and returns a small file receipt', async () => {
  let written;
  const sys=createGuestSys({fs:{writeFile:async(path,bytes)=>written={path,bytes}},hostSys:async()=>({ok:true,result:{ok:true,base64:'AQID',contentType:'application/octet-stream'}})});
  const receipt=await sys.fetch({url:'https://example.com',saveTo:'/artifacts/data.bin'});
  assert.equal(receipt.base64,undefined); assert.equal(receipt.bytes,3);
  assert.deepEqual([...written.bytes],[1,2,3]); assert.ok(sys.writtenFiles.has('/artifacts/data.bin'));
  await assert.rejects(sys.fetch({saveTo:'/context/data.bin'}),{code:'BAD_INPUT'});
});

test('parallel CDP commands share attachment; another debugger is not treated as ours', async () => {
  let attaches=0;
  chrome.tabs={get:async id=>({id,url:'https://example.com'})};
  chrome.debugger={attach:async()=>{attaches++;await new Promise(r=>setImmediate(r));},
    sendCommand:async()=>({value:1}),detach:async()=>{},getTargets:async()=>[]};
  const results=await Promise.all([1,2].map(()=>handleWorkspaceSys({op:'cdp',params:{tabId:73,method:'Runtime.evaluate'}})));
  assert.equal(attaches,1); assert.ok(results.every(result=>result.ok));
  await handleWorkspaceSys({op:'cdp',params:{tabId:73,action:'detach'}});
  chrome.debugger.attach=async()=>{throw new Error('Another debugger is already attached to the tab')};
  chrome.debugger.sendCommand=async()=>{throw new Error('Another debugger is already attached to the tab')};
  const busy=await handleWorkspaceSys({op:'cdp',params:{tabId:74,action:'attach'}});
  assert.equal(busy.code,'CDP_BUSY');
});

test('CDP reclaim works when this extension still owns the pipe', async () => {
  let probed=0;
  chrome.tabs={get:async id=>({id,url:'https://example.com'})};
  chrome.debugger={
    attach:async()=>{throw new Error('already attached to the tab')},
    sendCommand:async()=>{probed++; return {result:{type:'undefined'}};},
    detach:async()=>{},
    getTargets:async()=>[]
  };
  const result=await handleWorkspaceSys({op:'cdp',params:{tabId:80,action:'attach'}});
  assert.equal(result.ok,true); assert.equal(probed,1);
  await handleWorkspaceSys({op:'cdp',params:{tabId:80,action:'detach'}});
});

test('CDP targetId is allowlisted; eval does not run on extension pages', async () => {
  chrome.debugger={getTargets:async()=>[{id:'t1',url:'chrome://version',type:'page'}],attach:async()=>{},sendCommand:async()=>({}),detach:async()=>{}};
  const denied=await handleWorkspaceSys({op:'cdp',params:{targetId:'t1',action:'attach'}});
  assert.equal(denied.code,'NEED_PAGE');
  chrome.tabs={get:async id=>({id,url:'chrome-extension://abc/src/preview/sheet.html'})};
  chrome.userScripts={getScripts:async()=>[],execute:async()=>[{result:{ok:true,value:1}}]};
  const evalDenied=await handleWorkspaceSys({op:'eval',params:{tabId:9,code:'return 1'}});
  assert.equal(evalDenied.code,'NEED_PAGE');
  const missing=await handleWorkspaceSys({op:'eval',params:{code:'return 1'}});
  assert.equal(missing.code,'NEED_PAGE');
});

test('abort surfaces SYS_ABORTED, not a numeric DOMException code', async () => {
  const original=globalThis.fetch; let started;
  const ready=new Promise(r=>started=r);
  globalThis.fetch=async(_url,init)=>{
    started();
    return new Promise((_,reject)=>{
      init.signal.addEventListener('abort',()=>reject(new DOMException('The operation was aborted.','AbortError')),{once:true});
    });
  };
  try {
    const envelope={callId:'abort-code',sessionId:'s',executionId:'e'};
    const pending=handleWorkspaceSys({...envelope,op:'fetch',params:{url:'https://example.com'}});
    await ready;
    await handleWorkspaceSys({...envelope,op:'cancel'});
    const result=await pending;
    assert.equal(result.code,'SYS_ABORTED');
    assert.equal(typeof result.code,'string');
  } finally {globalThis.fetch=original;}
});

test('capability probe handles asynchronous permission denial', async () => {
  chrome.userScripts={getScripts:async()=>{throw new Error('not allowed')},execute:async()=>[]};
  const result=await handleWorkspaceSys({op:'capabilities'});
  assert.equal(result.ok,true); assert.equal(result.result.userScripts.available,false);
  assert.match(result.result.userScripts.reason,/Allow User Scripts/);
  delete chrome.userScripts;
});

test('stale artifact edits are rejected, identical retries are safe, guest writes invalidate versions', () => {
  const store=new SessionWorkspaceStore();
  store.put('sessions','s',{sessionId:'s',messages:[]});
  const fs=createSessionGuestFs(store,{sessionId:'s',executionId:'e'});
  const artifact=createArtifact(store,fs,{sessionId:'s',name:'proof.txt',content:'original',mimeType:'text/plain'});
  const updated=updateArtifactContent(store,fs,'s',artifact.artifactId,'first',{expectedRevision:artifact.revision});
  assert.equal(updated.revision,artifact.revision+1);
  assert.throws(()=>updateArtifactContent(store,fs,'s',artifact.artifactId,'stale',{expectedRevision:artifact.revision}),{code:'ARTIFACT_CONFLICT'});
  assert.equal(fs.readFile(updated.primaryPath),'first');
  const retry=updateArtifactContent(store,fs,'s',artifact.artifactId,'first',{expectedRevision:artifact.revision});
  assert.equal(retry.revision,updated.revision);
  fs.writeFile(updated.primaryPath,'guest update');
  assert.throws(()=>updateArtifactContent(store,fs,'s',artifact.artifactId,'stale',{expectedRevision:updated.revision}),{code:'ARTIFACT_CONFLICT'});
  assert.equal(fs.readFile(updated.primaryPath),'guest update');
});

test('sheet saves newer edits after slow persistence and reports write failures', async () => {
  const source=await readFile(new URL('../src/preview/sheet.js',import.meta.url),'utf8');
  const code=source.slice(source.indexOf('async function saveNow('),source.indexOf('\nfunction scheduleSave()'));
  let release, version=1; const writes=[]; const blocked=new Promise(r=>release=r);
  const context=vm.createContext({univerAPI:{},saving:false,savePromise:null,saveRequested:false,editRevision:0,artifactRevision:1,
    dirty:true,sessionId:'s',artifactId:'a',mimeType:'text/csv',fileName:'sheet.csv',setSaveState(){},setStatus(){},
    bytesForPersist:async()=>String(version),bytesToBase64:x=>x,
    workspaceRpc:async(_,p)=>{writes.push(p);if(writes.length===1)await blocked;return {artifact:{revision:writes.length+1}};},
    chrome:{runtime:{sendMessage(){}}},window:{setTimeout(){}}});
  vm.runInContext(code,context);const first=context.saveNow();await new Promise(r=>setImmediate(r));
  version=2;context.editRevision++;const second=context.saveNow();release();await Promise.all([first,second]);
  assert.deepEqual(writes.map(p=>[p.base64,p.expectedRevision]),[['1',1],['2',2]]);
  assert.equal(context.dirty,false);context.workspaceRpc=async()=>{throw new Error('disk failure')};
  assert.equal((await context.saveNow()).ok,false);assert.equal(context.dirty,true);
});

test('plan/clarify chrome never matches another session', () => {
  assert.equal(clarifyBelongsToSession('session-a', 'session-a'), true);
  assert.equal(clarifyBelongsToSession('session-a', 'session-b'), false);
  assert.equal(clarifyBelongsToSession('', 'session-b'), false);
  assert.equal(clarifyBelongsToSession('session-a', ''), false);
  assert.equal(clarifyBelongsToSession('', ''), false);
});

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

// Load the real client module with a stub react; only __test.parseResponse runs.
function loadClient() {
  let module
  const sandbox = {
    window: { __ModuleLoader__: { load: ({ factory }) => { module = factory(() => ({ createElement() {} })) } } },
    console,
  }
  vm.runInNewContext(readFileSync(new URL('../client.js', import.meta.url), 'utf8'), sandbox)
  return module
}

const parse = loadClient().__test.parseResponse

test('a 200 HTML reply is rejected, not treated as empty', async () => {
  await assert.rejects(() => parse(new Response('<html></html>', { status: 200 }), 'workspaces'), error => error.code === 'invalid-json')
})

test('a JSON object without the op key is rejected', async () => {
  await assert.rejects(() => parse(new Response('{}', { status: 200 }), 'workspaces'), error => error.code === 'missing-workspaces')
  await assert.rejects(() => parse(new Response('{"boards":[]}', { status: 200 }), 'board'), error => error.code === 'missing-board')
})

test('an array top level is rejected', async () => {
  await assert.rejects(() => parse(new Response('[]', { status: 200 }), 'workspaces'), error => error.code === 'invalid-body')
})

test('only an empty array is a valid empty state', async () => {
  const body = await parse(new Response('{"workspaces":[]}', { status: 200 }), 'workspaces')
  assert.equal(body.workspaces.length, 0)
})

test('an error reply keeps the server code', async () => {
  await assert.rejects(() => parse(new Response('{"error":"missing-token"}', { status: 502 }), 'workspaces'), error => error.code === 'missing-token')
})

test('board and card require an object', async () => {
  const ok = await parse(new Response('{"board":{"id":"b1"}}', { status: 200 }), 'board')
  assert.equal(ok.board.id, 'b1')
  await assert.rejects(() => parse(new Response('{"card":"x"}', { status: 200 }), 'card'), error => error.code === 'missing-card')
})

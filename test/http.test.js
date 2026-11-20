import test from 'node:test'
import assert from 'node:assert/strict'
import { handleKanResource } from '../lib/http.js'
const peerCtx = (admission = { peer: { id: 'peer' } }) => ({ get: name => (name === 'connection' ? { admit: () => admission } : undefined) })
const apiWith = payloads => ({ getJson: async path => payloads[path] })
const call = (ctx, api, url) => handleKanResource(ctx, api, new Request(url))

const member = [{ role: 'owner', workspace: { publicId: 'w1', name: 'Work' } }]
const board = { publicId: 'b1', name: 'B', lists: [{ publicId: 'l1', name: 'Todo', cards: [{ publicId: 'c1', title: 'T' }] }] }
const card = { publicId: 'c1', title: 'T', description: 'D' }

test('workspaces are memberships behind an authenticated request', async () => {
  const res = await call(peerCtx(), apiWith({ '/workspaces': member }), 'https://host/x?op=workspaces')
  assert.equal(res.status, 200)
  assert.deepEqual((await res.json()).workspaces, [{ id: 'w1', name: 'Work' }])
})

test('missing peer is 401 and no connection service is 503', async () => {
  assert.equal((await call(peerCtx({ rejection: 401 }), apiWith({}), 'https://host/x?op=workspaces')).status, 401)
  assert.equal((await call(peerCtx({ rejection: 403 }), apiWith({}), 'https://host/x?op=workspaces')).status, 403)
  assert.equal((await call({ get: () => undefined }, apiWith({}), 'https://host/x?op=workspaces')).status, 503)
})

test('unknown op and bad ids are 400', async () => {
  assert.equal((await call(peerCtx(), apiWith({}), 'https://host/x?op=nope')).status, 400)
  assert.equal((await call(peerCtx(), apiWith({}), 'https://host/x?op=board&boardId=bad id')).status, 400)
})

test('board and card ops map real shapes', async () => {
  const api = apiWith({ '/boards/b1': board, '/cards/c1': card })
  const boardBody = await (await call(peerCtx(), api, 'https://host/x?op=board&boardId=b1')).json()
  assert.equal(boardBody.board.lists[0].cards[0].title, 'T')
  const cardBody = await (await call(peerCtx(), api, 'https://host/x?op=card&cardId=c1')).json()
  assert.equal(cardBody.card.description, 'D')
})

test('a shape mismatch is a 502 unexpected-shape, not an empty list', async () => {
  const api = apiWith({ '/workspaces': { workspaces: [] } })
  const res = await call(peerCtx(), api, 'https://host/x?op=workspaces')
  assert.equal(res.status, 502)
  assert.equal((await res.json()).error, 'unexpected-shape')
})

test('internal error text and tokens never reach the browser or the log', async () => {
  const logged = []
  const ctx = {
    get: name => (name === 'connection' ? { admit: () => ({ peer: { id: 'p' } }) } : undefined),
    logger: { warn: line => logged.push(String(line)) },
  }
  const api = { getJson: async () => { const error = new Error('boom secret-token'); error.code = 'network'; throw error } }
  const res = await call(ctx, api, 'https://host/x?op=workspaces')
  const body = await res.json()
  assert.equal(body.error, 'network')
  const wire = JSON.stringify(body)
  assert.ok(!wire.includes('boom'))
  assert.ok(!wire.includes('secret-token'))
  const log = logged.join('\n')
  assert.ok(!log.includes('boom'))
  assert.ok(!log.includes('secret-token'))
  assert.match(log, /request failed \(network\)/)
})

test('an unknown error becomes a fixed kan-error', async () => {
  const ctx = { get: name => (name === 'connection' ? { admit: () => ({ peer: {} }) } : undefined) }
  const api = { getJson: async () => { throw new Error('raw upstream detail') } }
  const res = await call(ctx, api, 'https://host/x?op=workspaces')
  const body = await res.json()
  assert.equal(res.status, 502)
  assert.equal(body.error, 'kan-error')
  assert.ok(!JSON.stringify(body).includes('raw upstream'))
})

test('an unknown or sensitive error code is reduced to kan-error', async () => {
  const logged = []
  const ctx = {
    get: name => (name === 'connection' ? { admit: () => ({ peer: {} }) } : undefined),
    logger: { warn: line => logged.push(String(line)) },
  }
  const api = { getJson: async () => { const error = new Error('x'); error.code = 'cred/secret-token-123'; throw error } }
  const res = await call(ctx, api, 'https://host/x?op=workspaces')
  const body = await res.json()
  assert.equal(body.error, 'kan-error')
  assert.ok(!JSON.stringify(body).includes('secret-token'))
  assert.ok(!logged.join('\n').includes('secret-token'))
  assert.match(logged.join('\n'), /request failed \(kan-error\)/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { createKanApi } from '../lib/kan-api.js'

const ok = body => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
const api = (fetchImpl, extra = {}) => createKanApi({ baseUrl: 'https://kan.example.com', getToken: async () => 'secret-token', fetchImpl, ...extra })

test('sends bearer token, never redirects, and parses json', async () => {
  const calls = []
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return ok({ ok: true }) }
  const value = await api(fetchImpl).getJson('/workspaces')
  assert.deepEqual(value, { ok: true })
  assert.equal(calls[0].url, 'https://kan.example.com/api/v1/workspaces')
  assert.equal(calls[0].init.headers.authorization, 'Bearer secret-token')
  assert.equal(calls[0].init.redirect, 'error')
})

test('missing token is explicit', async () => {
  const client = createKanApi({ baseUrl: 'https://kan.example.com', getToken: async () => undefined, fetchImpl: async () => ok({}) })
  await assert.rejects(() => client.getJson('/workspaces'), error => error.code === 'missing-token')
})

test('http errors never echo the upstream body or token', async () => {
  const fetchImpl = async () => new Response('denied for secret-token', { status: 401, statusText: 'Unauthorized' })
  await assert.rejects(() => api(fetchImpl).getJson('/workspaces'), error => {
    assert.equal(error.code, 'http')
    assert.equal(error.status, 401)
    assert.ok(!error.message.includes('secret-token'))
    assert.ok(!error.message.includes('denied'))
    return true
  })
})

test('oversized body is rejected while streaming', async () => {
  const fetchImpl = async () => ok({ a: 'x'.repeat(500) })
  await assert.rejects(() => api(fetchImpl, { maxBytes: 100 }).getJson('/workspaces'), error => error.code === 'too-large')
})

test('a redirect is refused, not followed', async () => {
  const fetchImpl = async () => { throw new Error('unexpected redirect response') }
  await assert.rejects(() => api(fetchImpl).getJson('/workspaces'), error => error.code === 'redirect')
})

test('a timeout aborts the request', async () => {
  const fetchImpl = (url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
  })
  await assert.rejects(() => api(fetchImpl, { timeoutMs: 20 }).getJson('/workspaces'), error => error.code === 'timeout')
})

test('non json body fails', async () => {
  const fetchImpl = async () => new Response('<html>', { status: 200 })
  await assert.rejects(() => api(fetchImpl).getJson('/workspaces'), error => error.code === 'bad-json')
})

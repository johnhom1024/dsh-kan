import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeConfig } from '../lib/config.js'

test('accepts a minimal https config with defaults', () => {
  const cfg = normalizeConfig({ baseUrl: 'https://kan.example.com/' })
  assert.equal(cfg.baseUrl, 'https://kan.example.com')
  assert.equal(cfg.tokenRef, 'KAN_API_TOKEN')
  assert.equal(cfg.requestTimeoutMs, 15000)
  assert.equal(cfg.maxResponseBytes, 2000000)
})

test('missing base url fails', () => {
  assert.throws(() => normalizeConfig({}), /set baseUrl/)
})

test('url credentials, query and fragment are refused', () => {
  assert.throws(() => normalizeConfig({ baseUrl: 'https://u:p@kan.example.com' }), /userinfo/)
  assert.throws(() => normalizeConfig({ baseUrl: 'https://kan.example.com/?a=1' }), /query/)
  assert.throws(() => normalizeConfig({ baseUrl: 'https://kan.example.com/#x' }), /fragment/)
})

test('plain http is loopback only unless explicitly allowed', () => {
  assert.equal(normalizeConfig({ baseUrl: 'http://127.0.0.1:9000' }).baseUrl, 'http://127.0.0.1:9000')
  assert.equal(normalizeConfig({ baseUrl: 'http://localhost:9000' }).baseUrl, 'http://localhost:9000')
  assert.throws(() => normalizeConfig({ baseUrl: 'http://kan.example.com' }), /loopback/)
  assert.equal(normalizeConfig({ baseUrl: 'http://kan.example.com', allowInsecureHttp: true }).baseUrl, 'http://kan.example.com')
})

test('token ref must be a reference name', () => {
  assert.throws(() => normalizeConfig({ baseUrl: 'https://kan.example.com', tokenRef: 'bad-ref' }), /tokenRef/)
})

test('bounds and booleans are enforced', () => {
  assert.throws(() => normalizeConfig({ baseUrl: 'https://kan.example.com', requestTimeoutMs: 10 }), /requestTimeoutMs/)
  assert.throws(() => normalizeConfig({ baseUrl: 'https://kan.example.com', maxResponseBytes: 10 }), /maxResponseBytes/)
  assert.equal(normalizeConfig({ baseUrl: 'https://kan.example.com', enableTools: 'false' }).enableTools, false)
  assert.throws(() => normalizeConfig({ baseUrl: 'https://kan.example.com', enableTools: 'no' }), /enableTools/)
})

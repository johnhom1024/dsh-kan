// Pure configuration normalization. No DSH imports, so it is unit-testable.
const DEFAULT_TOKEN_REF = 'KAN_API_TOKEN'
const REF = /^[A-Za-z_][A-Za-z0-9_]*$/

function fail(message) {
  throw new Error(`dsh-kan config: ${message}`)
}
function intIn(value, fallback, min, max, label) {
  if (value === undefined || value === null || value === '') return fallback
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(n) || n < min || n > max) fail(`${label} must be an integer between ${min} and ${max}`)
  return n
}
function bool(value, fallback, label) {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  fail(`${label} must be true or false`)
}
function isLoopback(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (host === 'localhost' || host === '::1') return true
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
}

export function normalizeConfig(config = {}) {
  const rawBase = String(config.baseUrl ?? '').trim()
  if (rawBase === '') fail('set baseUrl to your Kan origin (for example https://kan.example.com)')
  let url
  try {
    url = new URL(rawBase)
  } catch {
    fail('baseUrl is not a valid URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') fail('baseUrl must use http or https')
  if (url.username || url.password) fail('baseUrl must not contain userinfo')
  if (url.search) fail('baseUrl must not contain a query')
  if (url.hash) fail('baseUrl must not contain a fragment')
  const allowInsecureHttp = bool(config.allowInsecureHttp, false, 'allowInsecureHttp')
  if (url.protocol === 'http:' && !isLoopback(url.hostname) && !allowInsecureHttp) {
    fail('plain http is only allowed for a loopback host; use https or set allowInsecureHttp true')
  }

  const tokenRef = String(config.tokenRef ?? DEFAULT_TOKEN_REF).trim()
  if (!REF.test(tokenRef)) fail('tokenRef must be a credential reference such as KAN_API_TOKEN')

  return Object.freeze({
    baseUrl: rawBase.replace(/\/+$/, ''),
    tokenRef,
    requestTimeoutMs: intIn(config.requestTimeoutMs, 15000, 1000, 120000, 'requestTimeoutMs'),
    maxResponseBytes: intIn(config.maxResponseBytes, 2000000, 64 * 1024, 8 * 1024 * 1024, 'maxResponseBytes'),
    allowInsecureHttp,
    enableTools: bool(config.enableTools, true, 'enableTools'),
  })
}

// Host-only Kan API client. The token is obtained per call from a resolver and
// never appears in a message we produce. Responses are read as a stream with a
// byte budget so an oversized or stalled body cannot be buffered.
export class KanError extends Error {
  constructor(code, message, status) {
    super(message)
    this.name = 'KanError'
    this.code = code
    this.status = status
  }
}

export function redact(text, secret) {
  const value = String(text ?? '')
  if (!secret) return value
  return value.split(String(secret)).join('[redacted]')
}

function byteLength(text) {
  return typeof Buffer !== 'undefined' ? Buffer.byteLength(text, 'utf8') : new TextEncoder().encode(text).length
}

export function createKanApi({
  baseUrl,
  getToken,
  timeoutMs = 15000,
  maxBytes = 2000000,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new KanError('no-fetch', 'No fetch implementation is available')
  if (typeof getToken !== 'function') throw new KanError('no-token-source', 'No credential resolver was provided')
  const root = String(baseUrl ?? '').replace(/\/+$/, '')

  return {
    async getJson(path, externalSignal) {
      if (!String(path).startsWith('/')) throw new KanError('bad-path', 'Kan API path must start with "/"')
      const token = await getToken()
      if (typeof token !== 'string' || token.trim() === '') {
        throw new KanError('missing-token', 'The Kan API token is not configured')
      }
      const url = `${root}/api/v1${path}`
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      if (externalSignal) {
        if (externalSignal.aborted) controller.abort()
        else externalSignal.addEventListener('abort', () => controller.abort(), { once: true })
      }
      try {
        let response
        try {
          response = await fetchImpl(url, {
            method: 'GET',
            redirect: 'error',
            headers: { accept: 'application/json', authorization: `Bearer ${token}` },
            signal: controller.signal,
          })
        } catch (error) {
          if (controller.signal.aborted) throw new KanError('timeout', `Kan request exceeded ${timeoutMs} ms`)
          if (/redirect/i.test(String(error?.message ?? error))) {
            throw new KanError('redirect', 'Kan API attempted a redirect, which is not followed')
          }
          throw new KanError('network', redact(`Kan request failed: ${error?.message ?? error}`, token))
        }
        if (!response.ok) {
          // Never echo the upstream body: it may contain a token or user content.
          throw new KanError('http', `Kan API returned ${response.status} ${response.statusText ?? ''}`.trim(), response.status)
        }
        const text = await readBounded(response, maxBytes, controller, token)
        try {
          return JSON.parse(text)
        } catch {
          throw new KanError('bad-json', 'Kan API returned a non-JSON body')
        }
      } finally {
        clearTimeout(timer)
      }
    },
  }
}

async function readBounded(response, maxBytes, controller, token) {
  if (!response.body || typeof response.body.getReader !== 'function') {
    // No streaming body (test doubles or an empty reply): enforce the same cap.
    const text = await response.text()
    if (byteLength(text) > maxBytes) throw new KanError('too-large', `Kan response exceeded ${maxBytes} bytes`)
    return text
  }
  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  try {
    for (;;) {
      let step
      try {
        step = await reader.read()
      } catch (error) {
        if (controller.signal.aborted) throw new KanError('timeout', 'Kan response body stalled past the deadline')
        throw new KanError('read', redact(`Kan response read failed: ${error?.message ?? error}`, token))
      }
      if (step.done) break
      const chunk = step.value
      total += chunk?.byteLength ?? chunk?.length ?? 0
      if (total > maxBytes) {
        controller.abort()
        try { await reader.cancel() } catch {}
        throw new KanError('too-large', `Kan response exceeded ${maxBytes} bytes`)
      }
      chunks.push(chunk)
    }
  } finally {
    try { reader.releaseLock?.() } catch {}
  }
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength ?? chunk.length
  }
  return new TextDecoder().decode(merged)
}

// Same-origin read-only route body. Only fixed operations exist here, with the
// shared ID grammar. Error details stay in the Host log; the browser gets a
// stable code and a fixed message.
import { mapWorkspaces, mapBoards, mapBoard, mapCardDetail, ShapeError } from './map.js'
import { isKanId } from './ids.js'

// Only these codes may cross the boundary or the log. Anything else (including a
// third-party exception code that embeds a value) becomes the generic code.
const KNOWN_CODES = new Set([
  'unexpected-shape', 'network', 'timeout', 'redirect', 'http', 'too-large',
  'bad-json', 'missing-token', 'read', 'kan-error',
])

function safeCode(error) {
  if (error instanceof ShapeError) return 'unexpected-shape'
  const code = error?.code
  return typeof code === 'string' && KNOWN_CODES.has(code) ? code : 'kan-error'
}

const MESSAGES = {
  'unexpected-shape': 'The Kan server returned an unexpected response shape.',
  network: 'Could not reach the Kan server.',
  timeout: 'The Kan request timed out.',
  redirect: 'The Kan server tried to redirect the request.',
  http: 'The Kan server rejected the request.',
  'too-large': 'The Kan response was too large.',
  'bad-json': 'The Kan server returned an invalid response.',
  'missing-token': 'The Kan API token is not configured.',
  read: 'The Kan response could not be read.',
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function warn(ctx, code) {
  // A fixed line only: never an exception message or stack, which may carry a token.
  const line = `dsh-kan: request failed (${code})`
  if (ctx?.logger?.warn) ctx.logger.warn(line)
  else console.warn(line)
}

function admit(ctx, request) {
  const connection = typeof ctx.get === 'function' ? ctx.get('connection') : undefined
  if (!connection || typeof connection.admit !== 'function') {
    return { ok: false, status: 503, code: 'auth-unavailable' }
  }
  try {
    // Connection Admit returns `{ peer }` or `{ rejection: 401|403 }`.
    const admission = connection.admit(request)
    if (admission && typeof admission === 'object' && 'rejection' in admission) {
      const status = admission.rejection === 403 ? 403 : 401
      return { ok: false, status, code: status === 403 ? 'forbidden' : 'unauthenticated' }
    }
    if (!admission || !admission.peer) return { ok: false, status: 401, code: 'unauthenticated' }
    return { ok: true, peer: admission.peer }
  } catch {
    return { ok: false, status: 403, code: 'forbidden' }
  }
}

function param(url, name) {
  const value = url.searchParams.get(name) ?? ''
  return isKanId(value) ? value : undefined
}

export async function handleKanResource(ctx, api, request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return json(405, { error: 'method-not-allowed' })
  }
  const allowed = admit(ctx, request)
  if (!allowed.ok) return json(allowed.status, { error: allowed.code })

  const url = new URL(request.url)
  const op = url.searchParams.get('op') ?? 'workspaces'
  try {
    if (op === 'workspaces') {
      return json(200, { workspaces: mapWorkspaces(await api.getJson('/workspaces')) })
    }
    if (op === 'boards') {
      const workspaceId = param(url, 'workspaceId')
      if (!workspaceId) return json(400, { error: 'workspaceId-required' })
      return json(200, { boards: mapBoards(await api.getJson(`/workspaces/${workspaceId}/boards`)) })
    }
    if (op === 'board') {
      const boardId = param(url, 'boardId')
      if (!boardId) return json(400, { error: 'boardId-required' })
      return json(200, { board: mapBoard(await api.getJson(`/boards/${boardId}`)) })
    }
    if (op === 'card') {
      const cardId = param(url, 'cardId')
      if (!cardId) return json(400, { error: 'cardId-required' })
      return json(200, { card: mapCardDetail(await api.getJson(`/cards/${cardId}`)) })
    }
    return json(400, { error: 'unknown-op' })
  } catch (error) {
    const code = safeCode(error)
    warn(ctx, code)
    const message = MESSAGES[code] ?? 'The Kan request failed.'
    const status = code === 'http' && error?.status === 404 ? 404 : 502
    return json(status, { error: code, message })
  }
}

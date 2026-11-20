// The one route/tool registration path. index.js calls these with the real
// services; tests call the same functions with fakes, so no copied contract.
import { handleKanResource } from './http.js'
import { buildKanTools } from './tools.js'

export const PAGE_ROUTE = '/plugins/dsh-kan/api'

export function registerKanRoute(ctx, api) {
  return ctx.webServer.register({
    path: PAGE_ROUTE,
    kind: 'exact',
    resource: request => handleKanResource(ctx, api, request),
  })
}

export function registerKanTools(toolsCtx, api, defineTool) {
  const disposers = buildKanTools(api, defineTool).map(definition => toolsCtx.tools.register(definition))
  return () => {
    for (const dispose of disposers.reverse()) {
      try { dispose() } catch {}
    }
  }
}

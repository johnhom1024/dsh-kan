// Host half: config, one authenticated read-only route for the page, and a
// small read-only tool set for the agent. No MCP server and no write path.
import z from '@deepseek-ai/schemastery'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { normalizeConfig } from './lib/config.js'
import { createKanApi } from './lib/kan-api.js'
import { registerKanRoute, registerKanTools } from './lib/register.js'

export const inject = ['webServer']

export const Config = z.object({
  baseUrl: z.string().default('').description('Kan origin, for example https://kan.example.com'),
  tokenRef: z.string().default('KAN_API_TOKEN').description('Credential reference that holds the Kan API token'),
  requestTimeoutMs: z.number().min(1000).max(120000).default(15000).description('Per-request timeout in milliseconds'),
  maxResponseBytes: z.number().min(65536).max(8388608).default(2000000).description('Maximum accepted response size'),
  allowInsecureHttp: z.boolean().default(false).description('Allow a plain-http Kan origin on a non-loopback host'),
  enableTools: z.boolean().default(true).description('Register the read-only Kan tools for the agent'),
})

function tokenResolver(ctx, tokenRef) {
  return async () => {
    const provider = ctx.get?.('credentials')
    if (provider?.resolve) {
      const resolved = await provider.resolve(credentialRef(tokenRef))
      return resolved?.value
    }
    // A profile without the credentials service still works when the variable is
    // present in the launching environment.
    return globalThis.process?.env?.[tokenRef]
  }
}

export function apply(ctx, config = {}) {
  const cfg = normalizeConfig(config)
  const api = createKanApi({
    baseUrl: cfg.baseUrl,
    getToken: tokenResolver(ctx, cfg.tokenRef),
    timeoutMs: cfg.requestTimeoutMs,
    maxBytes: cfg.maxResponseBytes,
  })

  ctx.effect(() => registerKanRoute(ctx, api), 'dsh-kan: http route')

  if (cfg.enableTools) {
    ctx.inject(['tools'], toolsCtx => {
      toolsCtx.effect(() => registerKanTools(toolsCtx, api, defineTool), 'dsh-kan: read-only tools')
    })
  }
}

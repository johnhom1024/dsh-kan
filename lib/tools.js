// Read-only Kan tools for the agent. These are ordinary DSH tools registered by
// this plugin: no upstream MCP server, no write capability, no tool-name filter
// that could fail open. Every tool calls the same Host Kan client as the page.
import { mapWorkspaces, mapBoards, mapBoard, mapCardDetail } from './map.js'
import { isKanId } from './ids.js'

function requireId(value, name) {
  if (!isKanId(value)) throw new Error(`${name} must match [A-Za-z0-9_-]{1,64}`)
  return value
}

function renderJson(_args, value) {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

export function buildKanTools(api, defineTool) {
  const output = { schema: { type: 'json' }, render: renderJson }
  return [
    defineTool({
      name: 'kan_list_workspaces',
      description: 'List the Kan workspaces the configured token can read.',
      parameters: {},
      output,
      async execute() {
        return mapWorkspaces(await api.getJson('/workspaces'))
      },
    }),
    defineTool({
      name: 'kan_list_boards',
      description: 'List the boards in one Kan workspace.',
      parameters: {
        workspaceId: { type: 'string', required: true, description: 'Workspace public ID (from kan_list_workspaces)' },
      },
      output,
      async execute(args) {
        return mapBoards(await api.getJson(`/workspaces/${requireId(args.workspaceId, 'workspaceId')}/boards`))
      },
    }),
    defineTool({
      name: 'kan_get_board',
      description: 'Read one Kan board with its lists and cards.',
      parameters: {
        boardId: { type: 'string', required: true, description: 'Board public ID' },
      },
      output,
      async execute(args) {
        return mapBoard(await api.getJson(`/boards/${requireId(args.boardId, 'boardId')}`))
      },
    }),
    defineTool({
      name: 'kan_get_card',
      description: 'Read one Kan card: title, description, labels, assignees and due date when present.',
      parameters: {
        cardId: { type: 'string', required: true, description: 'Card public ID' },
      },
      output,
      async execute(args) {
        return mapCardDetail(await api.getJson(`/cards/${requireId(args.cardId, 'cardId')}`))
      },
    }),
  ]
}

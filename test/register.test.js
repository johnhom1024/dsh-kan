import test from 'node:test'
import assert from 'node:assert/strict'
import { registerKanRoute, registerKanTools, PAGE_ROUTE } from '../lib/register.js'

test('route registers the exact path with kind exact', () => {
  const calls = []
  const ctx = { webServer: { register: options => { calls.push(options); return () => {} } } }
  const dispose = registerKanRoute(ctx, {})
  assert.equal(calls.length, 1)
  assert.equal(calls[0].path, PAGE_ROUTE)
  assert.equal(calls[0].kind, 'exact')
  assert.equal(calls[0].path, '/plugins/dsh-kan/api')
  assert.equal(typeof calls[0].resource, 'function')
  assert.equal(calls[0].exact, undefined)
  assert.equal(typeof dispose, 'function')
})

test('tools register the four read-only definitions and dispose them', () => {
  const registered = []
  const disposed = []
  const toolsCtx = { tools: { register: definition => { registered.push(definition.name); return () => disposed.push(definition.name) } } }
  const defineTool = definition => definition
  const dispose = registerKanTools(toolsCtx, {}, defineTool)
  assert.deepEqual(registered, ['kan_list_workspaces', 'kan_list_boards', 'kan_get_board', 'kan_get_card'])
  dispose()
  assert.equal(disposed.length, 4)
})

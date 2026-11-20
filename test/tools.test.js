import test from 'node:test'
import assert from 'node:assert/strict'
import { buildKanTools } from '../lib/tools.js'

const identity = definition => definition
const api = {
  async getJson(path) {
    if (path === '/workspaces') return [{ role: 'owner', workspace: { publicId: 'w1', name: 'Work' } }]
    if (path === '/workspaces/w1/boards') return [{ publicId: 'b1', name: 'Board' }]
    if (path === '/boards/b1') return { publicId: 'b1', name: 'Board', lists: [{ publicId: 'l1', name: 'Todo', cards: [{ publicId: 'c1', title: 'T' }] }] }
    if (path === '/cards/c1') return { publicId: 'c1', title: 'T', description: 'D' }
    throw new Error(`unexpected path ${path}`)
  },
}

const tools = buildKanTools(api, identity)

test('exposes only the small read-only tool set', () => {
  assert.deepEqual(tools.map(tool => tool.name), ['kan_list_workspaces', 'kan_list_boards', 'kan_get_board', 'kan_get_card'])
  for (const tool of tools) {
    assert.ok(!/create|update|delete|invite|remove|toggle|duplicate/.test(tool.name))
  }
})

test('tools return mapped data', async () => {
  assert.deepEqual(await tools[0].execute({}), [{ id: 'w1', name: 'Work' }])
  assert.deepEqual(await tools[1].execute({ workspaceId: 'w1' }), [{ id: 'b1', name: 'Board' }])
  assert.equal((await tools[2].execute({ boardId: 'b1' })).lists[0].cards[0].title, 'T')
  assert.equal((await tools[3].execute({ cardId: 'c1' })).description, 'D')
})

test('tool ids use the shared grammar', async () => {
  await assert.rejects(() => tools[1].execute({ workspaceId: 'bad id' }), /must match/)
  await assert.rejects(() => tools[2].execute({ boardId: '../etc' }), /must match/)
})

test('a bad shape fails the tool instead of returning empty', async () => {
  const broken = buildKanTools({ getJson: async () => ({ workspaces: [] }) }, identity)
  await assert.rejects(() => broken[0].execute({}), /shape mismatch/)
})

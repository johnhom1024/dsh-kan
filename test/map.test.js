import test from 'node:test'
import assert from 'node:assert/strict'
import { mapWorkspaces, mapBoards, mapBoard, mapCardDetail, ShapeError } from '../lib/map.js'

test('workspaces are memberships, mapped from workspace', () => {
  const payload = [{ role: 'owner', workspace: { publicId: 'w1', name: 'Work', slug: 'work' } }]
  assert.deepEqual(mapWorkspaces(payload), [{ id: 'w1', name: 'Work' }])
})

test('a non-array workspaces reply is a shape error, not empty', () => {
  assert.throws(() => mapWorkspaces({ workspaces: [] }), ShapeError)
  assert.deepEqual(mapWorkspaces([]), [])
})

test('boards map from an array', () => {
  assert.deepEqual(mapBoards([{ publicId: 'b1', name: 'Board' }]), [{ id: 'b1', name: 'Board' }])
  assert.throws(() => mapBoards({ boards: [] }), ShapeError)
})

test('board requires lists and cards', () => {
  const board = mapBoard({
    publicId: 'b1',
    name: 'Board',
    lists: [{ publicId: 'l1', name: 'Todo', cards: [{ publicId: 'c1', title: 'First', labels: [{ name: 'bug' }] }] }],
  })
  assert.deepEqual(board, {
    id: 'b1',
    name: 'Board',
    lists: [{ id: 'l1', name: 'Todo', cards: [{ id: 'c1', title: 'First', labels: ['bug'] }] }],
  })
  assert.throws(() => mapBoard({ publicId: 'b1', name: 'Board' }), /lists/)
  assert.throws(() => mapBoard({ publicId: 'b1', name: 'Board', lists: [{ publicId: 'l1', name: 'Todo' }] }), /cards/)
})

test('card detail keeps only present fields and rejects a missing title', () => {
  const card = mapCardDetail({
    publicId: 'c1', title: 'Task', description: 'Do it', labels: ['bug'], members: [{ name: 'Ada' }], dueDate: '2026-01-01',
  })
  assert.deepEqual(card, { id: 'c1', title: 'Task', labels: ['bug'], description: 'Do it', assignees: ['Ada'], dueDate: '2026-01-01' })
  assert.deepEqual(mapCardDetail({ publicId: 'c2', title: 'Only' }), { id: 'c2', title: 'Only' })
  assert.throws(() => mapCardDetail({ publicId: 'c3' }), /title/)
})

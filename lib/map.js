// Strict mapping from Kan API JSON to the shapes the page renders.
// Unknown shapes throw instead of silently rendering empty results.
export class ShapeError extends Error {
  constructor(where, detail) {
    super(`Kan response shape mismatch at ${where}: ${detail}`)
    this.name = 'ShapeError'
    this.code = 'unexpected-shape'
  }
}

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const text = value => (typeof value === 'string' && value.trim() !== '' ? value : undefined)

function requireObject(value, where) {
  if (!isObject(value)) throw new ShapeError(where, 'expected an object')
  return value
}
function requireArray(value, where) {
  if (!Array.isArray(value)) throw new ShapeError(where, 'expected an array')
  return value
}
function requireString(value, where) {
  if (typeof value !== 'string' || value.trim() === '') throw new ShapeError(where, 'expected a non-empty string')
  return value
}
function idOf(value, where) {
  if (!isObject(value)) throw new ShapeError(where, 'expected an object')
  const id = text(value.publicId) ?? text(value.id)
  if (id === undefined) throw new ShapeError(where, 'missing publicId/id')
  return id
}
function put(target, key, value) {
  if (value !== undefined) target[key] = value
  return target
}
function labelsOf(card, where) {
  const raw = card.labels
  if (raw === undefined || raw === null) return []
  return requireArray(raw, `${where}.labels`)
    .map((label, index) => (typeof label === 'string' ? label : text(requireObject(label, `${where}.labels[${index}]`).name)))
    .filter(Boolean)
}
function peopleOf(card, where) {
  const raw = card.members ?? card.assignees ?? card.users
  if (raw === undefined || raw === null) return []
  return requireArray(raw, `${where}.members`)
    .map((person, index) => (typeof person === 'string' ? person : text(requireObject(person, `${where}.members[${index}]`).name)))
    .filter(Boolean)
}

export function mapWorkspaces(payload) {
  // GET /workspaces returns memberships: [{ role, workspace: { name, publicId } }]
  return requireArray(payload, 'GET /workspaces').map((membership, index) => {
    const where = `workspaces[${index}]`
    requireObject(membership, where)
    const workspace = requireObject(membership.workspace, `${where}.workspace`)
    requireString(workspace.name, `${where}.workspace.name`)
    return { id: idOf(workspace, `${where}.workspace`), name: workspace.name }
  })
}

export function mapBoards(payload) {
  return requireArray(payload, 'GET /workspaces/:id/boards').map((board, index) => {
    const where = `boards[${index}]`
    requireObject(board, where)
    requireString(board.name, `${where}.name`)
    return { id: idOf(board, where), name: board.name }
  })
}

export function mapCardSummary(card, where) {
  requireObject(card, where)
  const title = text(card.title) ?? text(card.name)
  if (title === undefined) throw new ShapeError(where, 'missing title')
  const out = { id: idOf(card, where), title }
  const labels = labelsOf(card, where)
  if (labels.length > 0) out.labels = labels
  return out
}

export function mapCardDetail(card) {
  const out = mapCardSummary(card, 'card')
  put(out, 'description', text(card.description))
  const people = peopleOf(card, 'card')
  if (people.length > 0) out.assignees = people
  put(out, 'dueDate', text(card.dueDate) ?? text(card.dueAt))
  return out
}

export function mapBoard(payload) {
  // GET /boards/:id returns the board with its lists and cards.
  requireObject(payload, 'GET /boards/:id')
  requireString(payload.name, 'board.name')
  const lists = requireArray(payload.lists, 'board.lists').map((list, index) => {
    const where = `board.lists[${index}]`
    requireObject(list, where)
    requireString(list.name, `${where}.name`)
    const cards = requireArray(list.cards, `${where}.cards`).map((card, cardIndex) => mapCardSummary(card, `${where}.cards[${cardIndex}]`))
    return { id: idOf(list, where), name: list.name, cards }
  })
  return { id: idOf(payload, 'board'), name: payload.name, lists }
}

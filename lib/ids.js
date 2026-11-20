// One ID grammar shared by the HTTP route and the agent tools.
export const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/

export function isKanId(value) {
  return typeof value === 'string' && SAFE_ID.test(value)
}

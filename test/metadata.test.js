import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('locale metadata describes four built-in read-only tools, not MCP', () => {
  for (const path of ['locale/en.json', 'locale/zh.json']) {
    const meta = JSON.parse(read(path)).meta
    assert.ok(!/mcp/i.test(meta.description), `${path} still mentions MCP`)
    assert.match(meta.description, /read-only|只读/)
  }
})

test('NOTICE records that no MCP server or third-party program is bundled', () => {
  const notice = read('NOTICE')
  assert.match(notice, /does not\s+use, fetch, or bundle @kan\.bn\/mcp/)
  assert.match(notice, /No third-party runtime program is bundled/)
})

test('peer dependencies and the runtime dependency are declared', () => {
  const pkg = JSON.parse(read('package.json'))
  for (const name of ['@deepseek-ai/dsh-tools', '@deepseek-ai/dsh-credentials']) {
    assert.equal(pkg.peerDependencies[name], '*')
  }
  assert.equal(pkg.dependencies['@deepseek-ai/schemastery'], '~3.19.0')
})

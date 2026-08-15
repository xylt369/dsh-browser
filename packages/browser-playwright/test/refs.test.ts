import assert from 'node:assert/strict'
import { test } from 'node:test'
import { extractAriaRefs, isAriaRefFormat } from '../src/index.ts'

test('extractAriaRefs collects every ref id and de-duplicates', () => {
  const text = [
    '- heading "Example Domain" [level=1]',
    '- link "More information..." [ref=e1]',
    '- button "Submit" [ref=e2]',
    '- link "Again" [ref=e1]',
  ].join('\n')
  assert.deepEqual(extractAriaRefs(text), ['e1', 'e2'])
})

test('extractAriaRefs returns an empty list without refs', () => {
  assert.deepEqual(extractAriaRefs('- paragraph: no interactivity here'), [])
  assert.deepEqual(extractAriaRefs(''), [])
})

test('isAriaRefFormat accepts old (e1) and new (f29e86) snapshot ref formats', () => {
  assert.equal(isAriaRefFormat('e1'), true)
  assert.equal(isAriaRefFormat('f29e86'), true)
})

test('isAriaRefFormat never swallows CSS selectors', () => {
  assert.equal(isAriaRefFormat('text=Save'), false)
  assert.equal(isAriaRefFormat("input[name='q']"), false)
  assert.equal(isAriaRefFormat('#id'), false)
  // plain tag names have no digits, so they must not take the aria-ref path
  assert.equal(isAriaRefFormat('div'), false)
  assert.equal(isAriaRefFormat('button'), false)
})

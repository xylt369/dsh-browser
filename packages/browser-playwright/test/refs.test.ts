import assert from 'node:assert/strict'
import { test } from 'node:test'
import { extractAriaRefs } from '../src/index.ts'

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

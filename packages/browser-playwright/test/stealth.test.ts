import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  HIDDEN_WINDOW_ARGS,
  STEALTH_INIT_SCRIPT,
  STEALTH_LAUNCH_ARGS,
} from '../src/stealth.ts'

test('stealth init script covers the common automation fingerprints', () => {
  for (const needle of [
    "Object.defineProperty(navigator, 'webdriver'",
    'window.chrome',
    'Navigator.prototype',
    'plugins',
    'permissions.query',
    'WebGLRenderingContext',
    '0x9245',
  ]) {
    assert.ok(STEALTH_INIT_SCRIPT.includes(needle), `stealth script is missing "${needle}"`)
  }
})

test('stealth launch args strip the automation-controlled blink feature', () => {
  assert.ok(
    STEALTH_LAUNCH_ARGS.includes('--disable-blink-features=AutomationControlled'),
    'stealth must disable the AutomationControlled blink feature',
  )
})

test('hidden-window args park the window offscreen and minimized', () => {
  assert.ok(HIDDEN_WINDOW_ARGS.includes('--window-position=-32000,-32000'))
  assert.ok(HIDDEN_WINDOW_ARGS.includes('--start-minimized'))
})

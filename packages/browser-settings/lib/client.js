window.__ModuleLoader__.load({
  id: '@yeesy369/dsh-browser-settings',
  factory: (require) => {
    'use strict'
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')
    const h = React.createElement

    const ENDPOINT = '/dsh-browser-settings/config'
    const MODES = [
      { value: 'visible', title: 'visible（默认）', desc: '真浏览器窗口，可直接手动登录、过验证码，所见即所得；每次使用都弹窗口，打扰桌面。' },
      { value: 'hidden', title: 'hidden', desc: '真浏览器（反爬最强），窗口最小化并移到屏幕外，不打扰桌面；登录需提前在 profile 完成，依赖桌面会话。' },
      { value: 'headless', title: 'headless', desc: '完全不弹窗，适合服务器/CI；无法手动登录，强风控仍可能识别。' },
    ]

    const STATE = {
      open: false,
      loading: true,
      saving: false,
      configured: false,
      windowVisibility: 'visible',
      stealth: true,
      message: null,
      error: null,
    }
    const LISTENERS = new Set()
    function setState(patch) {
      Object.assign(STATE, patch)
      LISTENERS.forEach((fn) => {
        try {
          fn()
        } catch (e) {
          console.error(e)
        }
      })
    }
    function subscribe(fn) {
      LISTENERS.add(fn)
      return function () {
        LISTENERS.delete(fn)
      }
    }
    function useStore() {
      const [, force] = React.useState(0)
      React.useEffect(function () {
        return subscribe(function () {
          force(function (x) {
            return x + 1
          })
        })
      }, [])
      return STATE
    }

    function loadConfig() {
      setState({ loading: true, message: null, error: null })
      fetch(ENDPOINT)
        .then(function (r) {
          const type = r.headers.get('content-type') || ''
          if (!type.includes('application/json')) {
            throw new Error('宿主接口未就绪（返回了非 JSON）。请确认 dsh-browser-settings 已加载并重启 DSH。')
          }
          return r.json()
        })
        .then(function (d) {
          if (d && d.ok) {
            setState({
              loading: false,
              configured: !!d.configured,
              windowVisibility: (d.config && d.config.windowVisibility) || 'visible',
              stealth: !d.config || d.config.stealth !== false,
            })
          } else {
            setState({ loading: false, error: (d && d.error) || '加载配置失败' })
          }
        })
        .catch(function (e) {
          setState({ loading: false, error: String(e && e.message ? e.message : e) })
        })
    }

    function saveConfig() {
      setState({ saving: true, message: null, error: null })
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ windowVisibility: STATE.windowVisibility, stealth: STATE.stealth }),
      })
        .then(function (r) {
          const type = r.headers.get('content-type') || ''
          if (!type.includes('application/json')) {
            throw new Error('宿主接口未就绪（返回了非 JSON）。请确认 dsh-browser-settings 已加载并重启 DSH。')
          }
          return r.json()
        })
        .then(function (d) {
          if (d && d.ok) {
            setState({ saving: false, configured: true, message: '已保存，稍候自动生效（写入 ' + (d.file || 'cordis.patch.yml') + '）' })
          } else {
            setState({ saving: false, error: (d && d.error) || '保存失败' })
          }
        })
        .catch(function (e) {
          setState({ saving: false, error: String(e && e.message ? e.message : e) })
        })
    }

    function BrowserSettingsPanel() {
      const s = useStore()
      React.useEffect(function () {
        loadConfig()
      }, [])
      return h('div', { className: 'dsh-bs-backdrop', onClick: function () { setState({ open: false }) } },
        h('div', { className: 'dsh-bs-panel', onClick: function (e) { e.stopPropagation() } },
          h('div', { className: 'dsh-bs-head' },
            h('div', null,
              h('div', { className: 'dsh-bs-title' }, '🌐 浏览器设置'),
              h('div', { className: 'dsh-bs-sub' }, '配置 dsh-browser-playwright：窗口模式与反检测补丁。保存后写入 profile 的 cordis.patch.yml，DSH 热应用，无需重启。'),
            ),
            h('button', { className: 'dsh-bs-close', title: '关闭', onClick: function () { setState({ open: false }) } }, '✕'),
          ),
          h('div', { className: 'dsh-bs-section' },
            h('div', { className: 'dsh-bs-section-title' }, '窗口模式 windowVisibility'),
            MODES.map(function (mode) {
              return h('label', { key: mode.value, className: 'dsh-bs-mode' + (s.windowVisibility === mode.value ? ' dsh-bs-mode-on' : '') },
                h('input', {
                  type: 'radio',
                  name: 'windowVisibility',
                  value: mode.value,
                  checked: s.windowVisibility === mode.value,
                  disabled: s.loading,
                  onChange: function () { setState({ windowVisibility: mode.value, message: null, error: null }) },
                }),
                h('span', { className: 'dsh-bs-mode-title' }, mode.title),
                h('span', { className: 'dsh-bs-mode-desc' }, mode.desc),
              )
            }),
          ),
          h('div', { className: 'dsh-bs-section' },
            h('label', { className: 'dsh-bs-row' },
              h('input', {
                type: 'checkbox',
                checked: s.stealth,
                disabled: s.loading,
                onChange: function (e) { setState({ stealth: e.target.checked, message: null, error: null }) },
              }),
              h('span', null, 'stealth 反检测补丁（抹掉 navigator.webdriver、补全 plugins、伪装 WebGL 等，默认开启）'),
            ),
          ),
          h('div', { className: 'dsh-bs-foot' },
            h('span', { className: 'dsh-bs-note' }, s.configured ? '已配置' : '尚未配置（保存后自动创建条目）'),
            s.message ? h('span', { className: 'dsh-bs-msg dsh-bs-msg-ok' }, s.message) : null,
            s.error ? h('span', { className: 'dsh-bs-msg' }, s.error) : null,
            h('button', {
              className: 'dsh-bs-btn dsh-bs-btn-primary',
              disabled: s.loading || s.saving,
              onClick: saveConfig,
            }, s.saving ? '保存中…' : '保存'),
          ),
        ),
      )
    }

    function BrowserSettingsOverlay() {
      const s = useStore()
      if (!s.open) return null
      return h(BrowserSettingsPanel)
    }

    function BrowserSettingsEntry(props) {
      useStore()
      const wide = !!(props && props.wide)
      return h('button', {
        className: 'dsh-bs-entry-btn',
        title: '浏览器设置',
        onClick: function () {
          setState({ open: true })
        },
      },
        h('span', { style: { fontSize: 15 } }, '🌐'),
        wide ? h('span', null, '浏览器设置') : null,
      )
    }

    const CSS = '.dsh-bs-backdrop{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;background:rgba(8,10,14,.4);overflow:auto;padding:24px}.dsh-bs-panel{box-sizing:border-box;width:min(560px,calc(100vw - 48px));max-height:88vh;overflow:auto;background-color:#fff;background-color:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.45);color:var(--dsw-alias-label-primary,#1f2328);padding:22px 26px 16px}.dsh-bs-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}.dsh-bs-title{font-size:18px;font-weight:600;line-height:1.3}.dsh-bs-sub{font-size:12.5px;opacity:.65;margin-top:4px;line-height:1.5}.dsh-bs-close{background:none;border:none;color:var(--dsw-alias-label-secondary,#6b7280);font-size:18px;cursor:pointer;line-height:1;padding:6px 10px;border-radius:8px}.dsh-bs-close:hover{background:var(--dsw-alias-bg-layer-1,#f3f4f6);color:var(--dsw-alias-label-primary,#1f2328)}.dsh-bs-section{margin-top:18px}.dsh-bs-section-title{font-size:13px;font-weight:600;opacity:.8;margin-bottom:10px}.dsh-bs-mode{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:9px 10px;border:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-radius:10px;margin-bottom:8px;cursor:pointer}.dsh-bs-mode-on{border-color:var(--dsw-alias-brand-primary,#4f46e5);background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4f46e5) 8%,transparent)}.dsh-bs-mode-title{font-size:13px;font-weight:500}.dsh-bs-mode-desc{width:100%;font-size:11.5px;opacity:.62;line-height:1.5;padding-left:24px}.dsh-bs-row{display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer}.dsh-bs-foot{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:18px;padding-top:14px;border-top:1px solid var(--dsw-alias-border-l1,#e5e7eb);flex-wrap:wrap}.dsh-bs-note{font-size:11.5px;opacity:.55;margin-right:auto}.dsh-bs-msg{font-size:12px;opacity:.9}.dsh-bs-msg-ok{color:#4ade80}.dsh-bs-btn{background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l1,#e5e7eb);color:var(--dsw-alias-label-primary,#1f2328);border-radius:10px;padding:8px 16px;font-size:13px;cursor:pointer}.dsh-bs-btn-primary{background:var(--dsw-alias-brand-primary,#4f46e5);border-color:transparent;color:#fff}.dsh-bs-btn:disabled{opacity:.55;cursor:default}.dsh-bs-entry-btn{display:inline-flex;align-items:center;gap:6px;background:none;border:none;color:var(--dsw-alias-label-secondary,#6b7280);font-size:13px;padding:6px 10px;border-radius:8px;cursor:pointer;white-space:nowrap}.dsh-bs-entry-btn:hover{color:var(--dsw-alias-label-primary,#1f2328);background:var(--dsw-alias-bg-layer-1,#f3f4f6)}'

    function apply(ctx) {
      const slots = ctx.get('slots')
      if (!slots) return
      ctx.effect(function () {
        const tag = document.createElement('style')
        tag.dataset.pluginCss = '@yeesy369/dsh-browser-settings'
        tag.textContent = CSS
        document.head.appendChild(tag)
        return function () {
          if (tag.parentNode) tag.parentNode.removeChild(tag)
        }
      })
      slots.inject('sidebar.footer.action', function () {
        return slots.register(
          { name: 'sidebar.footer.action', id: 'dsh-browser-settings-entry', order: 0, label: 'Browser Settings' },
          function (props) {
            return h(BrowserSettingsEntry, props)
          },
        )
      })
      slots.inject('shell.overlay', function () {
        return slots.register(
          { name: 'shell.overlay', id: 'dsh-browser-settings-overlay', order: 20 },
          function () {
            return h(BrowserSettingsOverlay)
          },
        )
      })
    }

    exports.apply = apply
    exports.inject = []
    return module.exports
  },
})

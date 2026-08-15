# dsh-browser-settings

> DSH 侧栏伴侣插件：为 `dsh-browser-playwright` 提供可视化配置面板。
> A DSH sidebar companion that makes `dsh-browser-playwright` configurable from the UI.

在 DSH 侧边栏底部提供一个「🌐 浏览器设置」入口（与 Open Theme 同一槽位），点开后可以切换
浏览器的窗口模式（`windowVisibility`：`visible` / `hidden` / `headless`）与反检测补丁
（`stealth`），保存后即时生效，无需手改配置文件、无需重启 DSH。

Adds a "🌐 Browser Settings" entry to the DSH sidebar footer (same slot as Open Theme).
The panel edits the browser window mode (`windowVisibility`: `visible` / `hidden` /
`headless`) and the anti-detection patch toggle (`stealth`). Saving applies immediately —
no manual YAML editing, no DSH restart.

---

## 工作原理 / How it works

**宿主端（node）**

- 通过 `inject: ['webServer']` 声明服务依赖，等 webServer 就绪后注册
  `GET / POST /dsh-browser-settings/config` 路由；
- 读取并改写 profile 的 `cordis.patch.yml` 中 `- id: browser-playwright` 条目的 `config`；
- DSH 的 HMR 监听该 patch 文件，保存后自动重新应用（热生效）。

**客户端（web）**

- 注册 `sidebar.footer.action` 入口按钮与 `shell.overlay` 弹层；
- 面板加载当前配置、保存新配置，并对“宿主接口未就绪”等情况给出明确提示。

**Host side (node):** declares `inject: ['webServer']` so the config route is registered only
after the web server is ready; reads and rewrites the `- id: browser-playwright` entry's
`config` in the profile's `cordis.patch.yml`. DSH's HMR watches that patch file and hot-applies
changes.

**Client side (web):** registers a `sidebar.footer.action` entry and a `shell.overlay` panel,
loads the current config, saves changes, and reports clear errors (e.g. host endpoint not ready).

---

## 安装 / Install

### 方式一：npm（推荐）

```bash
npm i @yeesy369/dsh-browser-settings
```

然后在 profile 的 `package.json` 中把插件加入 bundle 列表：

```json
{
  "dsh": {
    "profile": {
      "bundles": [
        "...",
        "@yeesy369/dsh-browser-settings"
      ]
    }
  }
}
```

在 profile 目录执行 `pnpm install`，重启 DSH。

### 方式二：本地 link（开发调试）

```json
{
  "dependencies": {
    "@yeesy369/dsh-browser-settings": "link:D:/Projects/dsh-browser-settings"
  },
  "dsh": {
    "profile": {
      "bundles": ["...", "@yeesy369/dsh-browser-settings"]
    }
  }
}
```

同样执行 `pnpm install` 并重启 DSH。

---

## 使用 / Usage

1. 点击侧边栏底部的「🌐 浏览器设置」；
2. 选择窗口模式：`visible`（默认，真窗口，可手动登录）/ `hidden`（真浏览器最小化移出屏幕，
   反爬最强）/ `headless`（无窗口，适合服务器 / CI）；
3. 勾选/取消 `stealth` 反检测补丁（默认开启）；
4. 点「保存」——配置写入 `cordis.patch.yml`，DSH 热应用，立即生效。

配置等价于手写：

```yaml
# ~/.dsh/profiles/<profile>/cordis.patch.yml
- id: browser-playwright
  config:
    windowVisibility: headless
    stealth: true
```

---

## 常见问题 / Troubleshooting

- **面板提示“宿主接口未就绪（返回了非 JSON）”**：宿主路由未注册。确认
  `@yeesy369/dsh-browser-settings` 已加入 profile 的 bundles 并重启过 DSH，且使用最新版本；
  早期开发版宿主插件因缺少 `inject: ['webServer']` 会静默跳过路由注册。
- **改动后没生效**：确认保存成功（面板显示“已保存”），DSH 的 HMR 需要 1–2 秒应用；
  若仍不生效，重启 DSH 或手动检查 `cordis.patch.yml`。
- **面板与背景叠在一起**：请使用最新版本（弹层样式已按 DSH 主题加固）。

---

## License

MIT

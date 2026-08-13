# dsh-browser

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）补上缺失的浏览器能力。

`dsh` 有文件系统、shell、搜索和抓取原语，但**没有浏览器**：没有 `ctx.browser` seam，没有 provider，也没有面向模型的「打开 / 阅读 / 操作真实网页」工具。本仓库按 `dsh` 一贯的 Service Definition / Provider / Consumer 模型，用三个包补上这块能力。

## 为什么值得做

- **这是真实缺口。** 官方 `dsh-web-fetch-http` 的 README 明确写着 SSRF/私网防护是 deferred，且「内网可达环境禁止启用」；全仓库也没有任何 browser 包。
- **面向模型而非面向 DOM。** 页面用紧凑的无障碍树快照表示，而不是整页 HTML；截图变成模型真正能「看见」的持久图片附件。
- **默认安全。** 每次导航都过 URL 守卫：拒绝凭据、非 `http(s)`、黑名单主机名，以及私网/回环/link-local/组播目标（含 DNS 解析后校验）。

## 包结构

| 包 | 角色 | 职责 |
|---|---|---|
| [`dsh-browser`](./packages/browser) | Service Definition | 声明 `ctx.browser` seam（`BrowserRuntime`、`BrowserPage`、类型化结果） |
| [`dsh-browser-playwright`](./packages/browser-playwright) | Service Provider | 用 headless Playwright 实现 `ctx.browser` |
| [`dsh-tool-browser`](./packages/tool-browser) | Consumer | 注册 `browser_navigate`、`browser_snapshot`、`browser_click`、`browser_type`、`browser_back`、`browser_screenshot` |

Service Definition 是纯库（类型 + 抽象类）；Provider 和 Consumer 是可安装的 bundle。

## 面向模型的工具

| 工具 | 副作用 | 说明 |
|---|---|---|
| `browser_navigate` | 网络 | URL 先过 SSRF 校验 |
| `browser_snapshot` | 无 | 无障碍快照（回退为正文文本） |
| `browser_screenshot` | 图片 | 存为持久附件 |
| `browser_click` | 页面变更 | CSS 选择器 |
| `browser_type` | 页面变更 | 输入到焦点元素 |
| `browser_back` | 历史 | |

## 安装

正式分发走 npm（每个 bundle 一个包）：

```sh
dsh plugin --profile web add dsh-browser-playwright dsh-tool-browser
```

开发阶段从源码加载：

```sh
pnpm install
pnpm build
dsh --profile web --patch packages/browser-playwright/cordis.patch.yml --patch packages/tool-browser/cordis.patch.yml
```

## 安全模型

URL 安全由 `browser-playwright/src/url-guard.ts` 统一负责，导航前依次：拒绝非 `http(s)` 与带凭据的 URL；拦截默认主机名黑名单；拦截私网/回环/link-local/组播 IP 字面量；DNS 解析后逐条校验是否公网。

已知残余风险：Playwright 拥有网络栈，守卫的 DNS 校验与浏览器实际连接之间存在 TOCTOU 窗口；代理或 `--host-resolver-rules` 钉扎是文档化的后续项。切勿在能触及敏感内网的环境里放开私网目标。

## 状态

**alpha**，基于 `dsh` `0.1.0-rc.x`（当前解析到 `0.1.0-rc.6`）与 Cordis `4.x`。`pnpm install`、`pnpm build`、`pnpm typecheck`、`pnpm test` 均已通过；URL 守卫单测覆盖 SSRF 的协议/主机名/IP 字面量矩阵。

## 开发

```sh
pnpm install
pnpm build
pnpm typecheck
pnpm test          # browser-playwright 测试需先 pnpm playwright install chromium
```

仓库约定见 [AGENTS.md](./AGENTS.md)，许可见 [LICENSE](./LICENSE)（MIT）。

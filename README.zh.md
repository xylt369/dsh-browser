# dsh-browser

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）补上缺失的浏览器能力。

`dsh` 有文件系统、shell、搜索和抓取原语，但**没有浏览器**：没有 `ctx.browser` seam，没有 provider，也没有面向模型的「打开 / 阅读 / 操作真实网页」工具。本仓库按 `dsh` 一贯的 Service Definition / Provider / Consumer 模型，用三个包补上这块能力。

## 项目背景

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）是 DeepSeek AI 开源的 agent 框架，核心思想是「**一切皆插件**」——连模型适配器、工具注册表、会话日志、agent loop 本身都是插件（[出处](https://github.com/deepseek-ai/deepseek-harness/blob/master/README.md)）。

`dsh` 已经内置了一个 **Web 访问 seam**（`ctx.web`），横跨「search 与 fetch」两项操作（[`docs/subsystems/web.md`](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/web.md)）。但它**没有浏览器能力**：没有 `ctx.browser` seam、没有 browser provider、没有浏览器工具——[`packages/web/`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/web) 目录下只有 `web`、`tool-web`、`web-fetch-http` 和几个 `web-search-*` provider。

## 本项目要解决的问题

本项目针对 `dsh` Web 能力里三个**有官方文档佐证**的具体缺口：

1. **已发布的 fetch 后端是 SSRF 原语，且默认被禁用。** 官方 [`dsh-web-fetch-http` README](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/web/web-fetch-http/README.md) 原文：

   > SSRF / private-network protection is deferred — no blocking of private, loopback, link-local, multicast, or otherwise non-public destinations... Until it lands, this provider is an SSRF primitive and **must not be enabled** in a deployment that can reach sensitive internal network targets.

   发布的 base bundle 印证了这一点：[`tool-web` 配置为 `fetch: false`](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/bundle/base/cordis.patch.yml)，且默认不挂 fetch provider。

2. **完全没有浏览器能力。** `dsh` 能搜索、（有条件地）抓取，但不能打开、阅读、驱动一个真实网页。

3. **Web 访问没有授权策略。** 官方 [`dsh-tool-web` README](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/web/tool-web/README.md) 原文：

   > No web-specific permission policy — both tools execute without requesting `ctx.approval`... the package does not define persistent URL/domain grants.

## 项目目的

`dsh-browser` 在「默认安全」的地基上，给 DeepSeek Harness 补上缺失的**浏览器能力**：

- 提供一个真正的 `ctx.browser` seam（Definition / Provider / Consumer），让模型能打开、快照、点击、输入、截图一个页面。
- 让导航在**发布前就做到 SSRF 安全**——直接补上 `dsh-web-fetch-http` 文档里标注为 deferred 的那一项。
- 加一个 Web **权限门**（`@yeesy369/dsh-web-permission`），让外发与页面变更类操作走白名单 / 黑名单 / 审批。

## 包结构

| 包 | 角色 | 职责 |
|---|---|---|
| [`@yeesy369/dsh-browser`](./packages/browser) | Service Definition | 声明 `ctx.browser` seam（`BrowserRuntime`、`BrowserPage`、类型化结果） |
| [`@yeesy369/dsh-browser-playwright`](./packages/browser-playwright) | Service Provider | 用 headless Playwright 实现 `ctx.browser` |
| [`@yeesy369/dsh-tool-browser`](./packages/tool-browser) | Consumer | 注册 `browser_navigate`、`browser_snapshot`、`browser_click`、`browser_type`、`browser_back`、`browser_screenshot` |
| [`@yeesy369/dsh-web-permission`](./packages/web-permission) | Hook | 通过 `tools/pre-execute` 给 web/browser 工具加白名单 / 黑名单 / 审批 |

Service Definition 是纯库（类型 + 抽象类）；Provider、Consumer 和权限门都是可安装的 bundle。

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

包已发布到 npm（`@yeesy369` 作用域，每个 bundle 一个包），一条命令：

```sh
dsh plugin --profile web add @yeesy369/dsh-browser-playwright @yeesy369/dsh-tool-browser @yeesy369/dsh-web-permission
```

Windows 一键脚本：`powershell -ExecutionPolicy Bypass -File scripts/install.ps1`（安装三个 bundle，并往 `cordis.patch.yml` 写入示例 `allowHosts`）。装完重启 profile（`Ctrl+C` 后重新 `dsh web`）生效。

provider 默认**真实用户模式**：有头 Microsoft Edge（`channel: 'msedge'`，Chrome 兜底）、持久化 profile（`~/.dsh/edge-profile`，登录态跨会话保留）、降低自动化指纹（`--disable-blink-features=AutomationControlled` + init script 隐藏 `navigator.webdriver`）、窗口被关闭时自动重新拉起；无真实浏览器时回退 Playwright 自带 Chromium。`@yeesy369/dsh-web-permission`（权限门）默认对白名单/黑名单之外的主机放行——需要更严格默认值请改 `cordis.patch.yml`。

开发阶段从源码加载：

```sh
pnpm install
pnpm build
dsh --profile web --patch packages/browser-playwright/cordis.patch.yml --patch packages/tool-browser/cordis.patch.yml --patch packages/web-permission/cordis.patch.yml
```

## 安全模型

URL 安全由 `browser-playwright/src/url-guard.ts` 统一负责，导航前依次：拒绝非 `http(s)` 与带凭据的 URL；拦截默认主机名黑名单；拦截私网/回环/link-local/组播 IP 字面量；DNS 解析后逐条校验是否公网。

已知残余风险：Playwright 拥有网络栈，守卫的 DNS 校验与浏览器实际连接之间存在 TOCTOU 窗口；代理或 `--host-resolver-rules` 钉扎是文档化的后续项。切勿在能触及敏感内网的环境里放开私网目标。

## 配置

`@yeesy369/dsh-web-permission` 从 `$DSH_HOME/settings.yaml` 读取配置，**热加载**——改完不用重启 `dsh`：

```yaml
web-permission:
  allowHosts:
    - example.com
  denyHosts:
    - evil.com
  defaultAction: allow   # 或 ask
  gatedTools:
    - browser_navigate
    - web_fetch
```

- `allowHosts` / `denyHosts` —— 主机名白名单 / 黑名单（黑名单优先）。
- `defaultAction` —— 既不在白名单也不在黑名单时的行为：`allow`（默认）或 `ask`（要求审批）。
- `gatedTools` —— 需要被该门审查的面向模型工具。

同样的字段也可以在组合期写进 `cordis.patch.yml`；`settings.yaml` 的用户层会在不重启的情况下覆盖它们。

## 状态

**alpha**，基于 `dsh` `0.1.0-rc.x`（当前解析到 `0.1.0-rc.6`）与 Cordis `4.x`。`pnpm install`、`pnpm build`、`pnpm typecheck`、`pnpm test` 均已通过；URL 守卫单测覆盖 SSRF 的协议/主机名/IP 字面量矩阵，权限门策略有独立单测，`pnpm test:e2e` 会驱动真实 headless Chromium（导航/快照/截图/SSRF 拒绝）。

## 开发

```sh
pnpm install
pnpm build
pnpm typecheck
pnpm test          # 单测（URL 守卫、权限门策略）
pnpm test:e2e      # 真实 headless Chromium；先 pnpm playwright install chromium
```

仓库约定见 [AGENTS.md](./AGENTS.md)，许可见 [LICENSE](./LICENSE)（MIT）。

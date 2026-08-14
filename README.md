# dsh-browser 🦊

[English](README.en.md) | **中文**

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）装上**浏览器能力**：让 AI 能打开真实网页、读内容、点按钮、填表单、截图。

`dsh` 原本只有文件系统、Shell、搜索和抓取工具，**没有浏览器**。本仓库按 `dsh` 的插件模型补上这块能力，默认使用你电脑上的 **Microsoft Edge**（真实浏览器窗口，带反检测），bilibili、知乎这类反爬严格的网站也能正常访问。

## 快速开始（3 步）

**第 0 步 · 检查有没有 dsh**（只需做一次，跳过也没关系）

打开终端（Windows：按 `Win + R`，输入 `cmd` 回车），运行：

```sh
dsh --version
```

- ✅ **有输出**（比如 `0.1.0-rc.6`）→ 你已经装好了，直接进入第 1 步
- ❌ **提示"不是内部或外部命令" / "command not found"** → 说明还没装，任选一种方式安装：

  **方式 A · 命令行安装**（复制这行命令粘贴执行）：

  ```sh
  npm i -g @deepseek-ai/dsh
  ```

  **方式 B · 打开网页安装**：浏览器访问 https://www.npmjs.com/package/@deepseek-ai/dsh ，按页面上的提示执行安装命令。

  装完**重新打开一个终端窗口**，再运行一次 `dsh --version`，确认有输出后继续。

> 💡 不想安装到系统里？也可以不装，直接把后面命令里的 `dsh` 全部换成 `npx @deepseek-ai/dsh`（效果一样，只是每次走临时缓存）。

**第 1 步 · 安装插件**（任意终端执行）：

```sh
dsh plugin --profile web add @yeesy369/dsh-browser-playwright @yeesy369/dsh-tool-browser @yeesy369/dsh-web-permission
```

> Windows 也可以用一键脚本（效果等价，还会自动写入示例白名单）：
> ```sh
> powershell -ExecutionPolicy Bypass -File scripts/install.ps1
> ```

**第 2 步 · 重启 dsh**：在运行 `dsh web` 的终端按 `Ctrl+C`，然后重新运行 `dsh web`。

**第 3 步 · 开用**：对 AI 说"打开 https://www.bilibili.com"。第一次会弹出 Edge 窗口——**别关它**，那是 AI 的"眼睛"。

> ✅ 不需要任何额外配置。需要登录的网站：在弹出的 Edge 窗口里登录一次即可，登录态永久保存（存在 `~/.dsh/edge-profile`，重启不丢）。

## 能对 AI 说什么

| 你说 | AI 会 |
|---|---|
| 打开 https://xxx | 访问网页（SSRF 校验后） |
| 看看这个网页讲了什么 | 读出页面内容 |
| 点一下 xxx / 输入 xxx / 返回 / 截图 | 操作页面（受权限门管控） |
| 登录 xxx 网站 | 引导你在 Edge 窗口里登录，登录态持久保存 |

## 常见问题

**弹出的 Edge 窗口可以关吗？** 使用期间别关；就算关了，插件会自动重新打开（页面状态会重置）。

**登录态会丢吗？** 不会。存在 `~/.dsh/edge-profile`，重启 dsh、重启电脑都保留。

**哪些网站访问不了？** 默认放行所有公网域名；`localhost`、`192.168.x`、`10.x` 等内网地址被拦截（防 SSRF 的安全设计）。

**想自定义白名单/黑名单？** 编辑 `$DSH_HOME/settings.yaml` 的 `web-permission` 节（**热更新**，不用重启 dsh），或 `~/.dsh/profiles/web/cordis.patch.yml`。

**怎么卸载？**

```sh
dsh plugin --profile web remove @yeesy369/dsh-browser-playwright @yeesy369/dsh-tool-browser @yeesy369/dsh-web-permission
```

## 包结构

| 包 | 角色 | 作用 |
|---|---|---|
| `@yeesy369/dsh-browser` | 服务定义 | 声明 `ctx.browser` 接口（`BrowserRuntime` / `BrowserPage`） |
| `@yeesy369/dsh-browser-playwright` | 服务实现 | 用 Edge/Playwright 实现：有头模式 + 持久 profile + 反检测 + 窗口自动重开 |
| `@yeesy369/dsh-tool-browser` | 消费者 | 注册 `browser_navigate` / `browser_snapshot` / `browser_click` / `browser_type` / `browser_back` / `browser_screenshot` |
| `@yeesy369/dsh-web-permission` | 权限门 | `tools/pre-execute` 白名单 / 黑名单 / 询问 |

## 安全模型

- 只允许公网 HTTP(S) 地址；拒绝内网/回环/link-local/云元数据地址（SSRF 防护，见 `packages/browser-playwright/src/url-guard.ts`）
- 权限门默认放行公网域名（`defaultAction: allow`），可配置 `allowHosts` / `denyHosts` / `gatedTools`
- 反检测有局限：极强风控站点仍可能识别人机，属已知边界（见英文版 README）

## 开发与发布

```sh
pnpm install && pnpm build && pnpm typecheck && pnpm test
```

架构细节见 [docs/architecture.md](./docs/architecture.md)，仓库规范见 [AGENTS.md](./AGENTS.md)，许可 [MIT](./LICENSE)。

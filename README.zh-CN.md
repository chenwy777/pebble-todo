<p align="center"><img src="assets/icon.svg" width="64" alt="Pebble 标记"></p>

# Pebble · 悬浮待办

适用于 **Windows 和 macOS** 的透明悬浮待办小球，提供供 **Codex、Claude** 调用的本地 MCP 工具。

[English](README.md) · [下载 v0.5.0](https://github.com/chenwy777/pebble-todo/releases/tag/v0.5.0) · [安装说明](#安装) · [AI 连接](#连接-codex-或-claude) · [更新记录](CHANGELOG.md)

平时是一个清透小球，鼠标移上去后向下展开列表。添加、查看、分类和切换状态都在小面板里完成。事项保存在自己的电脑上，不需要注册 Pebble 账号。

<p align="center"><img src="docs/demos/quick-start.gif" width="480" alt="实际操作：悬停展开、添加待办、事项悬停聚焦、切换进行中与完成状态，再收回到显示剩余数量的小球。"></p>

_动图录自实际 Electron 应用，使用独立的演示事项；外层背景和字幕用于帮助观看。_

## 功能

| 功能           | 实际行为                                                                    |
| -------------- | --------------------------------------------------------------------------- |
| 透明悬浮小球   | 拖动移动，悬停或点击后向下展开。                                            |
| 待办数量提示   | To-do 为 0 时显示 P 标记；有事项时显示 To-do 数量。Doing、Done 不计入数字。 |
| 三种状态       | To-do / Doing / Done，每种状态都可以直接添加事项。                          |
| 悬停聚焦       | 鼠标指向的事项轻微浮起，其他事项淡出、缩小；遵循系统减少动态效果设置。      |
| 自定义分类     | 新增、改名、改颜色、筛选，分类分组可折叠。                                  |
| 日期与计划时长 | 可选日期、预计时长或开始 / 结束时间，自动显示小时与分钟，支持跨午夜。       |
| 快捷模板       | 使用默认活动或创建自己的模板，加入时选择目标状态。                          |
| 中英文         | 默认英文，可切换中文；日期语言可以独立切换。                                |
| 本地保存与备份 | 自动保存、上一份有效数据备份、JSON 导入导出、最近手动修改撤销。             |
| 可选 AI 接入   | 通过本地 MCP 读取事项和分类，或让 AI 添加事项。                             |

## 安装

### 先选择下载文件

打开 [v0.5.0 下载页](https://github.com/chenwy777/pebble-todo/releases/tag/v0.5.0)，必要时展开 **Assets**。普通使用者下载下面的安装包；GitHub 自动提供的 **Source code** 压缩包是源码，不是安装程序。

| 电脑类型               | 建议下载                                                                                                            | ZIP 备选                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Windows x64            | [Windows 安装程序](https://github.com/chenwy777/pebble-todo/releases/download/v0.5.0/Pebble-0.5.0-windows-x64.exe)  | [Windows ZIP](https://github.com/chenwy777/pebble-todo/releases/download/v0.5.0/Pebble-0.5.0-windows-x64.zip)       |
| Apple M 系列芯片的 Mac | [Apple Silicon DMG](https://github.com/chenwy777/pebble-todo/releases/download/v0.5.0/Pebble-0.5.0-macos-arm64.dmg) | [Apple Silicon ZIP](https://github.com/chenwy777/pebble-todo/releases/download/v0.5.0/Pebble-0.5.0-macos-arm64.zip) |
| Intel 处理器的 Mac     | [Intel DMG](https://github.com/chenwy777/pebble-todo/releases/download/v0.5.0/Pebble-0.5.0-macos-x64.dmg)           | [Intel ZIP](https://github.com/chenwy777/pebble-todo/releases/download/v0.5.0/Pebble-0.5.0-macos-x64.zip)           |

**只使用桌面待办不需要 Node.js。** AI 连接或源码开发才需要它。

### Windows 安装

1. 如果旧版正在运行，先右键旧小球，选择 **Quit Pebble / 退出 Pebble**。
2. 从本仓库下载 `Pebble-0.5.0-windows-x64.exe` 并运行。
3. 选择安装目录，完成安装。
4. 从开始菜单或桌面快捷方式打开 **Pebble**，寻找桌面小球。它不会像普通软件一样显示一个任务栏主窗口。

使用 ZIP 时，先点“全部解压”，保留整个解压目录，再运行其中的 `Pebble.exe`。不要只复制 `.exe`，否则会缺少资源。当前本机验证环境为 Windows 11 x64，其他 Windows 配置尚未逐项验证。

预览版没有发布者签名，Windows 可能提示未知发布者；请先核对仓库和文件，再决定是否运行。Release 中的 `SHA256SUMS.txt` 提供文件校验值，在 PowerShell 中可用以下命令计算并比对：

```powershell
Get-FileHash -Algorithm SHA256 .\Pebble-0.5.0-windows-x64.exe
```

### macOS 安装

1. 打开 **苹果菜单 → 关于本机**：显示 Apple M1/M2/M3/M4 等“芯片”的选择 **arm64**，显示 Intel“处理器”的选择 **x64**。
2. 下载对应的 `.dmg`，双击打开，将 **Pebble** 拖入 **Applications / 应用程序**。
3. 更新旧版时先退出旧 Pebble，再从应用程序中打开新版，寻找小球或菜单栏图标。
4. ZIP 版本则先解压，再将 `Pebble.app` 移到应用程序中打开。

当前预览版没有 Apple Developer ID 签名和公证。如果被系统拦截，请参阅 [Apple 官方说明](https://support.apple.com/en-au/102445)。在确认下载可信后，可使用 Apple 的单个应用放行流程：首次尝试打开后，进入 **系统设置 → 隐私与安全性 → 仍要打开**。无需全局关闭 Gatekeeper。可用 `shasum -a 256 /文件路径/下载文件.dmg` 与 Release 校验值比对。

Mac 安装包由 Apple Silicon 与 Intel 两个 CI 环境分别构建。构建、单元测试成功不代表已完成真实 Mac 上的透明效果、拖动、多显示器、菜单栏和快捷键验收；这些人工体验检查仍待进行。

### 更新与卸载

更新前建议在 **设置 → 导出备份** 保存一份 JSON。退出旧版后安装或运行新版，事项数据独立于应用存放，会继续读取。移动或重新安装应用后，请重新复制 AI 配置，更新 MCP 文件所在路径。

Windows 可正常卸载应用；Mac 可移除 `Pebble.app`。ZIP 用户退出后移除解压目录即可。移除应用不要求删除独立存放的事项数据。

## 第一次使用

1. **展开**：鼠标移到小球上、单击小球，或使用快捷键。
2. **添加**：选择 To-do / Doing / Done，在底部输入内容，选择分类后按 **Enter**。
3. **设置时间**：点 **Date / time / 日期 / 时间**；也可以先添加，再点击事项正文编辑。
4. **推进状态**：点事项左侧方框，按照 **待办 → 进行中 → 已完成 → 待办** 循环；编辑器可以直接选择目标状态。
5. **固定展开**：点图钉；点减号收起。
6. **移动或退出**：拖动小球移动；右键小球或托盘 / 菜单栏图标退出。

| 操作             | Windows                | macOS               |
| ---------------- | ---------------------- | ------------------- |
| 唤出并聚焦输入框 | `Ctrl + Shift + Space` | `⌘ + Shift + Space` |
| 没有弹窗时收起   | `Esc`                  | `Esc`               |

列表按分类展示所有日期的事项。填写日期、时长不会产生通知，也不会自动把事项标记为完成。

### 分类与语言

点 **Manage categories / 管理分类**，或在分类下拉框选择 **+ New category… / + 新建分类…**。名称和颜色离开输入框后自动保存。删除分类会保留事项和模板，并移到未分类。

常见分类词会自动对应中英文，例如 `life` → 生活、`work` → 工作。其他名称可以展开 **中英文名称（可选）** 自行填写；手动填写的名称优先。未收录、未填写翻译的名称保留原文。事项正文和自建模板标题不会随界面语言自动翻译。

<p align="center"><img src="docs/demos/categories-language.gif" width="480" alt="实际操作：创建自定义分类、填写中文名称、添加事项、切换中文界面，并独立切换日期语言。"></p>

### 时间段与 AI 添加

设置 **19:00 → 20:30** 后，显示 **1h 30m / 1小时30分钟**。结束时间早于开始时间时按跨午夜计算；相同起止时间会提示无效。更长的计划可以使用“预计时长”。

下面动图的后半段调用了真实的 `pebble_add_task` MCP 工具，展示小球数字与列表自动更新。它展示的是实际接口联动，没有模拟某个 AI 软件的聊天窗口。

<p align="center"><img src="docs/demos/time-and-ai.gif" width="480" alt="实际操作：选择 19:00 至 20:30，查看自动计算的时长，保存后通过 MCP 添加第二个事项，观察小球和列表更新。"></p>

## 连接 Codex 或 Claude

AI 软件负责理解自然语言，Pebble 负责校验并保存事项。Pebble 本身不需要模型 API Key。

1. 安装 **Node.js 20 或更新版本**，本项目开发使用 Node.js 24。
2. 保持 Pebble 运行，打开 **设置 → AI 连接**。
3. 开启 **允许 AI 软件读取和添加事项**。
4. 复制对应配置，合并到 AI 客户端中，保留已有 MCP 服务。
5. 重启 AI 软件以加载工具。

| AI 客户端      | 配置位置                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------- |
| Codex          | 将复制的 TOML 段加入 `~/.codex/config.toml`；已有 `[mcp_servers.pebble]` 时更新该段，避免重复。 |
| Claude Code    | 将复制的 JSON 中 `mcpServers.pebble` 合并到项目 `.mcp.json`，也可以使用 `claude mcp add`。      |
| Claude Desktop | Settings → Developer → Edit Config，将配置合并到 `claude_desktop_config.json`。                 |

Claude Desktop 的配置通常位于 Windows 的 `%APPDATA%/Claude/claude_desktop_config.json`，或 Mac 的 `~/Library/Application Support/Claude/claude_desktop_config.json`。如果客户端找不到 `node`，把配置中的 `command` 改为 Node 可执行文件的绝对路径。本地 stdio 运行在桌面客户端，网页聊天不能直接启动电脑上的本地进程。

连接后可以说：**“把今晚七点到八点复习 CV 加入学习分类的待办。”** 或 **“看看我还有哪些事情没做。”**

| 工具                     | 功能                                                 |
| ------------------------ | ---------------------------------------------------- |
| `pebble_get_context`     | 读取本机日期、时区、语言和事项数量。                 |
| `pebble_list_categories` | 读取分类 ID 与中英文名称。                           |
| `pebble_list_tasks`      | 按状态、分类、日期或标题查询事项，支持分页。         |
| `pebble_add_task`        | 添加带可选状态、分类、日期、时间段或预计时长的事项。 |

本地 AI 访问默认关闭；开启后使用带鉴权的本机回环连接，关闭开关或退出 Pebble 即停止访问。当前 MCP 不编辑或删除已有事项。协议测试覆盖 SDK v2 和三个旧版本；Claude 客户端实际验收、Gemini / WorkBuddy 等其他客户端仍待验证。DeepSeek 能否使用取决于承载该模型的客户端是否支持 MCP。

详细步骤与说明见 [AI 连接文档](docs/ai.md)。官方参考：[Codex](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)、[Claude Code](https://code.claude.com/docs/en/mcp)、[Claude Desktop 本地连接](https://modelcontextprotocol.io/docs/develop/connect-local-servers)。

## 数据与备份

| 系统    | 事项数据文件                                      |
| ------- | ------------------------------------------------- |
| Windows | `%APPDATA%/Pebble/tasks.json`                     |
| macOS   | `~/Library/Application Support/Pebble/tasks.json` |

上一份有效写入会保留为 `tasks.json.backup`。主文件损坏时会尝试恢复备份，并保留损坏原文件。请定期使用 **设置 → 导出备份** 另存 JSON；导入会在确认后替换当前列表。

应用不发送遥测，也不加载外部页面资源。事项文件没有加密，使用电脑账户权限保护。AI 连接的临时发现文件位于数据目录的 `ai/connection.json`，不要分享；复制给 AI 软件的配置不包含访问令牌。

## 常见问题

| 问题                       | 处理方法                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------- |
| 看不到普通窗口或任务栏图标 | Pebble 是小球 / 托盘应用，寻找桌面小球或使用唤出快捷键。                           |
| 打开后仍然是旧界面         | 先退出旧进程，再打开新版；应用默认只运行一个实例。                                 |
| ZIP 版本打不开             | 完整解压，保留可执行文件旁的资源目录。                                             |
| Mac 无法打开               | 核对芯片架构，并查看上面的 macOS 安装说明。                                        |
| 自建分类还是英文           | 填写该分类的可选中英文名称；自动转换只覆盖词典中的常见分类词。                     |
| AI 提示 Pebble 不可用      | 保持 Pebble 运行、开启 AI 连接，检查复制出的路径和 Node 位置，然后重启 AI 客户端。 |
| 快捷键无反应               | 可能被其他软件占用，可以点击小球或托盘 / 菜单栏图标。                              |

反馈问题时请提供应用版本、系统、芯片类型、复现步骤与不含私人事项的截图。[提交 Issue](https://github.com/chenwy777/pebble-todo/issues)。

## 源码开发与构建

使用 Node.js 24 和 npm：

```sh
git clone https://github.com/chenwy777/pebble-todo.git
cd pebble-todo
npm ci
npm start
```

Windows 开发者安装依赖后也可以使用 `Start Pebble.cmd`。

```sh
npm test               # 数据、时间、存储、布局和本地 AI 桥接测试
npm run build:mcp      # 生成独立 Node MCP 桥接文件
npm run test:desktop   # Electron 界面回归
npm run test:mcp       # MCP 与真实 Electron 联动回归
npm run pack           # 当前系统可运行目录
npm run dist:win       # 在 Windows 上生成安装程序与 ZIP
npm run dist:mac       # 在 macOS 上生成 DMG 与 ZIP
```

构建产物在 `release/`。测试使用独立临时数据目录，不改动真实事项。GitHub 工作流分别构建 Windows x64、macOS arm64 和 macOS x64，运行单元测试，并在推送版本标签后发布安装包及 SHA-256 校验值。Windows 桌面 / MCP 已完成本机回归；Mac 的人工体验和 Claude 客户端验收范围见 [验证记录](VALIDATION.md)。

### 重新录制动图

```sh
npm run build:mcp
npm run demo:record
python -m pip install Pillow
python scripts/encode-demos.py
```

录制脚本操作真实 Electron 应用和真实本地 MCP 客户端，使用独立演示数据。临时 PNG 在 `test-results/demo-frames`；编码脚本只添加背景、字幕和帧时长，生成 `docs/demos` 中的 GIF。

## 当前范围

0.5 是桌面预览版，尚不包含云端同步、通知提醒、重复事项、开机启动、实际用时计时，或通过 MCP 修改 / 删除已有事项。计划时长不是计时器或闹钟。

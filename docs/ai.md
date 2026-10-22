# Pebble 与 AI 软件连接

Pebble 提供两种可选接入方式：**Skill 技能**（0.6.1 新增）和 **MCP 连接**（0.5 已提供，继续保留）。两种方式都由运行中的 Pebble 统一读写数据，均不需要 Pebble 模型 API Key。

Skill 包含给 AI 的操作说明、参数参考和实际操作脚本；脚本自动读取本机连接信息，调用 Pebble 的本地服务。MCP 将同样的操作暴露为标准工具。选择一种适合客户端的方式即可，无须同时安装二者。

## 方案一：安装 Skill（Codex / Claude Code 本地会话）

1. 运行 Pebble 0.6，打开 **Settings → AI connections**。
2. 点击 **Install Codex Skill** 或 **Install Claude Code Skill**。
3. 开启 **Allow AI apps to read and add tasks**。安装 Skill 本身不会替你开启访问。
4. 重启 AI 客户端或新建对话。在 Codex 中可用 `$pebble-todo`，Claude Code 中可用 `/pebble-todo`，也可直接说明“帮我把复习 CV 加入 Pebble 待办”。

Skill 安装后不需要手工编辑 TOML / JSON，也不需要额外安装 Node.js：启动脚本复用 Pebble 自带运行环境。AI 客户端仍可按自身权限规则提示批准本地命令。使用时保持 Pebble 运行；移动应用位置后，从新位置重新安装 Skill，更新启动路径。

安装目录按客户端规范选择：Codex 为 `~/.agents/skills/pebble-todo`，Claude Code 为 `~/.claude/skills/pebble-todo`。两者不会改动已有 MCP 配置。重新安装会检查 Pebble 安装标记和文件校验值，发现用户改动或同名外部 Skill 时停止，不覆盖自定义内容。要移除时只需在客户端中移除／关闭该 Skill，或删除其对应文件夹；AI 访问开关关闭后，已安装的脚本也不能继续读取或写入。

该 Skill 需要 AI 客户端拥有**本机执行能力**，不能仅把 ZIP 上传到云端聊天，就自动连到你的电脑。普通 Claude Desktop 聊天请用下方 MCP 路线；Claude Code 本机会话与 Claude 网页、Cowork 虚拟机、云端任务的运行环境不同。参考 [Codex Skill 官方文档](https://learn.chatgpt.com/docs/build-skills)和 [Claude Code Skill 官方文档](https://code.claude.com/docs/en/skills)。

Skill 与现有 MCP 的操作范围相同：读取上下文、分类、事项，以及添加事项；当前不通过这两个入口编辑、完成或删除已有事项。应用内语音完成属于本机界面的另一项功能。

## 方案二：MCP 连接（原有方式保留）

## 第一次连接

1. 安装 Node.js 20 或更新版本，并运行 Pebble v0.6.1。
2. 打开 Pebble 的 Settings → AI connections（设置 → AI 连接），开启“允许 AI 软件读取和添加事项”。
3. 复制对应的 Codex 或 Claude 配置，按下面的说明加入 AI 软件。
4. 重启 AI 客户端以加载配置。使用时保持 Pebble 运行，关闭连接开关即可停止 AI 访问。

复制出来的路径以当前 Pebble 所在位置为准；安装或移动程序后请重新复制配置。如果客户端找不到 `node`，将配置里的 `command` 改为 Node 可执行文件的绝对路径。

## Codex

将复制的 TOML 配置加入 `~/.codex/config.toml`，保留已有设置和其他 MCP 服务。若已存在 `[mcp_servers.pebble]`，更新该段，不要重复添加同名段。

结构示例（路径须替换为实际位置，优先使用 Pebble 生成的配置）：

```toml
[mcp_servers.pebble]
command = "node"
args = ["/absolute/path/to/resources/mcp/pebble-mcp.cjs", "--data-dir=/absolute/path/to/Pebble-data"]
startup_timeout_sec = 15
```

也可以使用 CLI：

```sh
codex mcp add pebble -- node /absolute/path/to/pebble-mcp.cjs --data-dir=/absolute/path/to/Pebble-data
codex mcp get pebble
```

Codex 的本地 MCP 配置方式见 [官方文档](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)。当前已打开的对话不一定会即时加载新增工具；重新打开客户端或新建对话后检查可用工具。

## Claude Code

将 Pebble 生成的 Claude JSON 中 `mcpServers.pebble` 加入项目 `.mcp.json` 的 `mcpServers` 对象，保留其他服务；也可以使用用户级 CLI 配置：

```sh
claude mcp add --transport stdio --scope user pebble -- node /absolute/path/to/pebble-mcp.cjs --data-dir=/absolute/path/to/Pebble-data
claude mcp get pebble
```

详见 [Claude Code MCP 文档](https://code.claude.com/docs/en/mcp)。客户端可能要求信任该 MCP 服务或批准具体工具调用，按客户端提示操作。

## Claude Desktop

在 Settings → Developer → Edit Config 中，将复制的 `mcpServers.pebble` 合并到配置，保留已有条目。配置文件通常位于：

- Windows：`%APPDATA%/Claude/claude_desktop_config.json`
- macOS：`~/Library/Application Support/Claude/claude_desktop_config.json`

保存后完整退出并重新打开 Claude Desktop。参考 [MCP 官方本地连接教程](https://modelcontextprotocol.io/docs/develop/connect-local-servers)。本地 stdio 工具在桌面客户端运行；网页聊天本身不能直接启动电脑上的这个进程。

## 可以怎么说

“帮我把今晚 7 点到 8 点复习 CV 加入学习分类的待办。”

“看看我还有哪些事情没做。”

“把游泳加入 Doing，预计一小时。”

日期和“今天 / 明天”以 Pebble 返回的本机日期及时区为准。分类选择使用现有分类 ID，找不到对应分类时请先澄清或使用未分类，不会凭空创建分类。

## 本版四个工具

| 工具                     | 作用                                                 |
| ------------------------ | ---------------------------------------------------- |
| `pebble_get_context`     | 读取本地日期、时区、语言与状态数量                   |
| `pebble_list_categories` | 读取分类 ID 与中英文名称                             |
| `pebble_list_tasks`      | 按状态、分类、日期或标题筛选，最多每页 100 条        |
| `pebble_add_task`        | 添加事项，可设置状态、分类、日期与时间段或预计分钟数 |

添加时可传入唯一 `requestId`，同一次请求重试时沿用该值，避免重复添加。保存成功后面板和小球计数自动更新。To-do 计数仍不包含 Doing / Done。

本版没有通过 MCP 编辑、删除现有事项、设置提醒或云端同步。时间是计划信息。关闭 AI 访问后已启动的 MCP 进程仍可列出工具，但读写操作会明确返回不可用。

## 兼容范围与验证

接入目标为 Codex、Claude Code 和 Claude Desktop 的本地 stdio MCP。自动测试覆盖 SDK v2 客户端及 2024-11-05、2025-06-18、2025-11-25 协议握手和工具调用，同时检查实时 UI、跨午夜时间、重复请求、编辑草稿、过期保存拒绝、开关及重启连接。

协议验证不等于每个客户端界面都已实测。Claude 客户端和 macOS 仍需实机验收。Gemini、WorkBuddy 等支持本地 stdio 的客户端可以按其配置格式接入，但本版不声称已经逐一验证；DeepSeek 能否接入取决于使用它的具体客户端是否支持 MCP。

## 本地实现

AI 客户端通过 stdio 启动独立 Node 桥接进程。桥接进程只调用运行中的 Pebble，由应用统一校验并保存事项，不直接修改数据文件。

开启本地访问后，应用只监听 `127.0.0.1` 的随机端口，使用每次启动生成的令牌，拒绝浏览器 Origin 与其他 Host。发现文件在 Pebble 数据目录的 `ai/connection.json`，不应分享。配置文件不含令牌。关闭访问或退出应用会停止监听并删除发现文件。

GUI 与 AI 写入共用串行队列和数据版本检查，旧界面快照不能覆盖新事项；检测到冲突时保留输入并提示重试。收到 AI 更新后清除旧撤销快照，避免把 AI 新增的事项撤销掉。

开发时运行 `npm run build:mcp` 生成独立桥接文件，`npm run test:mcp` 执行隔离数据目录的完整 MCP 回归。

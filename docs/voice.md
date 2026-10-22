# Local voice input · 本地语音输入

Available in the **0.6.1 local preview**. The published 0.5.0 installers do not include it.

## Use

1. Click the microphone beside **Add a task…**. Select Chinese or English.
2. Click **Start recording**. On first use, Pebble downloads the pinned multilingual Whisper Small model from Hugging Face (approximately 250 MB). Allow microphone access when prompted. Later uses load the cached model.
3. Speak one command, then click **Stop recording** (maximum 30 seconds). Only one recording or recognition runs at a time. Closing the dialog cancels it and releases the microphone.
4. Check or edit the transcript, then review the proposed change and click **Apply**. The command determines the target status regardless of which tab you opened it from. Use **Action** to correct the interpretation without re-recording. For a new task you can choose a category, or use **Edit task** to adjust the title, date or time before saving.

Examples:

| Command | Result after confirmation |
| --- | --- |
| `我下午三点有一个会，帮我记录一下` | Add a To-do for today at 15:00; no end time is invented. |
| `Meeting tomorrow at 3:30 pm` | Add a To-do for tomorrow at 15:30. |
| `我现在游完泳了` / `I finished swimming` | Match unfinished swimming tasks and move the selected one from To-do / Doing directly to Done. |
| `Complete the meeting` / `完成会议` | Match the existing meeting and move it to Done, even when opened from To-do. |
| `Start the meeting` / `开始会议` | Move the existing meeting to Doing. |
| `Reopen the meeting` / `把会议移回待办` | Return the existing meeting to To-do. |
| `Add meeting to doing` | Explicitly add a new task to Doing rather than use the current tab. |

Exact names take priority over partial matches. When several eligible tasks match, choose one explicitly. Completion searches To-do and Doing; start and reopen can also target completed tasks. If an exact task is already in the target status, the preview says so instead of selecting a different partial match. When nothing matches, a status command does not insert a new task. Editing the transcript clears its previous proposal; a list change requires review again before saving. Recent saves can be undone.

Voice uses limited, deterministic command parsing, rather than a general conversational AI. It supports positive add / complete / start / reopen commands, common activity names across Chinese and English, today / tomorrow / the day after tomorrow, and a single start time. It rejects multiple actions, negation and unsupported scheduling expressions rather than guessing. For an unfamiliar phrasing, choose the intended action and enter the task's name; to deliberately add a title such as "Finish book", choose Add a new task. Use **Edit task** for date ranges, durations, other dates or detailed changes. Speech recognition may be inaccurate, so review the transcript. There are no reminder notifications.

If the download, model loading or microphone fails, Pebble shows the error. You can retry or type a command in the same dialog. Restricted networks may block Hugging Face downloads. On Windows, check **Settings → Privacy & security → Microphone**; on macOS check **System Settings → Privacy & Security → Microphone** if access is denied.

## Privacy and runtime

There is no voice API key, paid transcription account or Pebble server. Recording starts only after clicking the recording button; there is no background listening. Audio is processed in memory on the computer and is not uploaded or saved as a recording. Transcripts remain in the dialog until applied or replaced. Applied task changes use the same local persistence and conflict protection as manual edits. No MCP connection is needed for built-in voice input.

Model files are cached under `voice-models/` in the Pebble data directory. Closing the dialog stops the separate speech process and frees the loaded model. The next use reloads the model from disk. Internet access is needed for the initial model download or to replace missing files. Delete the `voice-models/` directory while Pebble is closed to remove downloaded models; this does not delete tasks.

Windows and Apple Silicon use native CPU inference. Intel macOS uses a bundled WebAssembly fallback because the pinned ONNX Runtime package no longer ships Intel Mac binaries. This fallback was exercised on Windows, but real Intel / Apple Silicon Mac microphone and inference acceptance remains pending. Speech speed and accuracy vary by hardware, language and recording conditions.

Model: [`onnx-community/whisper-small`](https://huggingface.co/onnx-community/whisper-small), revision `36050c46d777d46dc4b5f43f6d90574fc38f8732` (model license MIT). Runtime: [Transformers.js](https://huggingface.co/docs/transformers.js) (Apache-2.0) and [ONNX Runtime](https://onnxruntime.ai/) (MIT). Model weights are downloaded separately and are not bundled in the installer.

## 中文使用说明

点击输入栏右侧的麦克风，选择中／英文后点击“开始录音”。第一次会联网下载约 250 MB 的免费多语言模型；录音和识别在本机完成，不需要 API 密钥，也不依赖外部 AI 软件。

说完点击“停止录音”，检查识别文字和操作预览，再确认应用。可以说“我下午三点有一个会，帮我记录一下”，或者“我现在游完泳了”。后者可匹配英文 `swimming`，多个匹配项必须手动选择。添加事项可选分类，也可打开事项编辑器调整日期、时间或时长。

支持简单的添加／完成／开始／重新打开指令，按语句决定目标状态，不受打开时的标签影响。也可以在“操作”中手动选择新增、移到待办、进行中或已完成，无须重新录音。找不到要移动的事项时不会新增，同名事项需要选择，已经在目标状态的事项会明确提示。当前仍使用有限规则解析，不是开放式 AI 对话；复杂日期、时间段、否定或多条指令请改用普通事项编辑器。关闭语音框会停止录音和识别，释放麦克风；不会在后台监听。语音不会上传或保存为音频文件。

分类的颜色和可选 emoji 显示在分类管理和展开后的分类菜单中；收起的选择器、主页分类标题、事项和导航保持统一的中性文字颜色。不会因为更换分类配色而将整个主列表变成彩色。

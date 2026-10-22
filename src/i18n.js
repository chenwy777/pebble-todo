(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PebbleI18n = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const zh = {
    "{n} to-dos. Open Pebble": "{n} 项待办，打开 Pebble",
    "To-do": "待办",
    Doing: "进行中",
    Done: "已完成",
    Templates: "快捷模板",
    "Pin open": "固定展开",
    Settings: "设置",
    "AI connections": "AI 连接",
    "Connect an AI app": "连接 AI 软件",
    "Allow AI apps to read and add tasks": "允许 AI 软件读取和添加事项",
    "Connect Codex or Claude using the configuration below. Keep Pebble running while using AI.":
      "使用下面的配置连接 Codex 或 Claude。使用 AI 时请保持 Pebble 运行。",
    "Copy Codex config": "复制 Codex 配置",
    "Copy Claude config": "复制 Claude 配置",
    "Local connections use Node.js 20 or later. Paste Codex config into config.toml; merge Claude config into its MCP settings. Restart the AI client after setup.":
      "本地连接需要 Node.js 20 或更新版本。将 Codex 配置加入 config.toml，或将 Claude 配置合并到其 MCP 设置中。配置后重启 AI 软件。",
    "AI can read tasks and categories, and add tasks with dates or planned times. Reminders and cloud sync are not included.":
      "AI 可以读取事项和分类，并添加带日期、预计时长或时间段的事项。暂不支持提醒和云端同步。",
    "Configuration copied": "配置已复制",
    "Copy failed": "复制失败",
    "Tasks updated by AI": "AI 已更新事项",
    "The list changed. Review the latest tasks and try again.":
      "列表已更新，请检查最新事项后重试。",
    "Invalid data revision.": "数据版本无效。",
    Collapse: "收起",
    Open: "展开",
    "Quit Pebble": "退出 Pebble",
    Language: "界面语言",
    English: "English",
    Chinese: "简体中文",
    "Click to change date language": "点击切换日期语言",
    Today: "今天",
    Tomorrow: "明天",
    "next day": "次日",
    "Today’s progress": "今日进度",
    "{n} completed today": "今日已完成 {n} 项",
    Tasks: "事项",
    "All categories": "所有分类",
    Uncategorized: "未分类",
    Categories: "分类",
    "Manage categories": "管理分类",
    "+ New category…": "+ 新建分类…",
    "Add a task…": "添加事项…",
    "Add task": "添加事项",
    "Date / time": "日期 / 时间",
    "Enter to add": "Enter 添加",
    "Saved locally": "保存在本机",
    "New template": "新建模板",
    "No to-dos": "暂无待办事项",
    "Add a task below.": "在下方输入框添加事项。",
    "Nothing in progress": "暂无进行中的事项",
    "Start a task from To-do.": "点击待办事项左侧的按钮开始。",
    "No completed tasks": "暂无已完成事项",
    "Completed tasks appear here.": "标记完成的事项将在这里显示。",
    "No tasks in this category": "此分类暂无事项",
    "Choose another category or add a task.": "切换分类或添加事项。",
    "No templates": "暂无快捷模板",
    "Create a template for tasks you add often.": "为经常添加的事项创建模板。",
    "Start task": "开始事项",
    "Mark complete": "标记完成",
    "Move to To-do": "移回待办",
    "Edit task": "编辑事项",
    "Delete task": "删除事项",
    "Use template": "使用模板",
    "Delete template": "删除模板",
    Close: "关闭",
    "Task name": "事项名称",
    "e.g. Review CV": "例如：修改 CV",
    Status: "状态",
    Category: "分类",
    Date: "日期",
    Clear: "清除",
    Time: "时间",
    Optional: "可选",
    None: "不设置",
    Duration: "预计时长",
    "Time range": "时间段",
    Start: "开始",
    End: "结束",
    Hours: "小时",
    Minutes: "分钟",
    "Calculate end from duration": "按时长推算结束时间",
    Calculate: "计算",
    "No time set. You can add it later.": "未设置时间，可稍后编辑。",
    "Estimated {duration}": "预计 {duration}",
    "Save changes": "保存修改",
    "Add to {status}": "添加到{status}",
    "Text color": "文字颜色",
    "Panel opacity": "面板不透明度",
    Backup: "备份",
    "Export backup": "导出备份",
    "Import backup": "导入备份",
    "Drag the orb to move. Right-click it to quit.":
      "拖动小球移动，右键菜单可退出。",
    "Edit names and colors below. Changes save when you leave the field.":
      "直接修改名称和颜色，离开输入框后自动保存。",
    "Category name": "分类名称",
    "Translations (optional)": "中英文名称（可选）",
    "English name": "英文名称",
    "Chinese name": "中文名称",
    "Common category names translate automatically. Add your own translations for other names.":
      "常见分类名会自动切换语言，其他名称可展开填写中英文名称。",
    "New category name": "新分类名称",
    Color: "颜色",
    "Add category": "添加分类",
    "Delete category": "删除分类",
    "Tasks and templates are kept when a category is deleted.":
      "删除分类后，事项和模板会保留为未分类。",
    "Category added": "分类已添加",
    "Category updated": "分类已更新",
    "Category deleted. Tasks and templates kept.":
      "分类已删除，事项和模板已保留",
    "A category with this name already exists.": "已有同名分类。",
    "Category name cannot be empty.": "分类名称不能为空。",
    "Template name": "模板名称",
    "e.g. Go for a walk": "例如：散步",
    "Duration in minutes (optional)": "预计时长（分钟，可选）",
    "Save template": "保存模板",
    "Template saved": "模板已保存",
    "Template deleted": "模板已删除",
    "Task added": "事项已添加",
    "Task deleted": "事项已删除",
    "Changes saved": "修改已保存",
    "Moved to Doing": "已移至进行中",
    "Marked complete": "已标记完成",
    "Moved to To-do": "已移回待办",
    Undo: "撤销",
    Undone: "已撤销",
    "Saving. Please wait.": "正在保存，请稍等。",
    "Save failed": "保存失败",
    "Export failed": "导出失败",
    "Import failed": "导入失败",
    "Backup exported": "备份已导出",
    "Backup imported": "备份已导入",
    "Enter a start time and a duration under 24 hours.":
      "请填写开始时间和小于 24 小时的有效时长。",
    "Unable to load tasks": "无法读取事项",
    "Restart Pebble. Your data has been kept.": "请重启 Pebble，原数据已保留。",
    Career: "求职",
    Study: "学习",
    Exercise: "运动",
    Personal: "生活",
    "Review CV": "修改 CV",
    "Apply for jobs": "投递岗位",
    "Read / study": "阅读 / 学习",
    Swimming: "游泳",
    Badminton: "羽毛球",
    Bouldering: "抱石",
    "Export Pebble backup": "导出 Pebble 备份",
    "Import Pebble backup": "导入 Pebble 备份",
    "Replace the current list with {n} tasks from this backup?":
      "用备份中的 {n} 条事项替换当前列表？",
    "The current data will be kept in the local automatic backup.":
      "当前数据将保留在本地自动备份中。",
    Cancel: "取消",
    Import: "导入",
    "Unable to save position": "无法保存位置",
    "Unable to start Pebble": "Pebble 无法启动",
    "Backup files cannot exceed 10 MB.": "备份文件不能超过 10 MB。",
    "Enter valid start and end times.": "请选择有效的开始和结束时间。",
    "Duration must be 1 minute to 168 hours.":
      "预计时长须为 1 分钟至 168 小时。",
    "Start and end times must be different.": "开始和结束时间不能相同。",
    "Unknown time type.": "未知时间类型。",
    "Choose a valid color.": "请选择有效颜色。",
    "Unsupported data file.": "不支持的数据文件。",
    "Too many tasks, categories or templates.": "事项、分类或模板数量过多。",
    "Duplicate data IDs.": "数据中有重复标识。",
    "Category does not exist.": "分类不存在。",
    "Invalid category translations.": "分类的中英文名称格式无效。",
    "Invalid task status or date.": "事项状态或日期无效。",
    "Task data was damaged. The previous backup was restored and the original file was kept.":
      "数据文件损坏，已恢复上一次备份并保留原文件。",
    "Unable to read tasks. The original file was kept. Back it up before checking it.":
      "无法读取事项。原文件已保留，请先备份后检查。",
  };
  function t(language, key, values = {}) {
    return String(language === "zh" ? zh[key] || key : key).replace(
      /\{(\w+)\}/g,
      (_, name) => String(values[name] ?? `{${name}}`),
    );
  }
  function error(language, message) {
    let clean = String(message).replace(
      /^Error invoking remote method '[^']+': Error: /,
      "",
    );
    if (language === "zh") {
      const match = clean.match(
        /^(ID|Category name|Task|Template) must contain 1 to (\d+) characters\.$/,
      );
      if (match)
        return `${{ ID: "标识", "Category name": "分类名称", Task: "事项", Template: "模板" }[match[1]]}须为 1 至 ${match[2]} 个字符。`;
    }
    return t(language, clean);
  }
  // Exact category-name matches only. Never translate task text or guess partial names.
  const categoryWords = [
    ["Life", "生活", "personal", "personal life"],
    ["Study", "学习", "learning"],
    ["Exercise", "运动", "sport", "sports"],
    ["Work", "工作"],
    ["Health", "健康"],
    ["Fitness", "健身"],
    ["Reading", "阅读"],
    ["Travel", "旅行"],
    ["Hobbies", "兴趣", "hobby"],
    ["Finance", "财务", "finances"],
    ["Family", "家庭", "home"],
    ["Shopping", "购物"],
    ["Food", "饮食"],
    ["Cooking", "烹饪"],
    ["Social", "社交"],
    ["Creativity", "创作", "creative"],
    ["Content", "内容"],
    ["Projects", "项目", "project"],
    ["Chores", "家务"],
    ["Entertainment", "娱乐"],
    ["Rest", "休息"],
  ];
  function categoryName(language, category) {
    const custom = category.translations?.[language];
    if (custom) return custom;
    if (category.builtinKey) return t(language, category.builtinKey);
    const key = category.name.trim().toLowerCase();
    const words = categoryWords.find((row) =>
      row.some((word) => word.toLowerCase() === key),
    );
    if (!words) return category.name;
    if (language === "zh") return words[1];
    return key === words[1] ? words[0] : category.name;
  }
  return { t, error, zh, categoryName };
});

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./domain.js"));
  else root.PebbleCommands = factory(root.Pebble);
})(typeof globalThis !== "undefined" ? globalThis : this, function (D) {
  "use strict";
  const number = (value) => {
    if (/^\d+$/.test(value)) return Number(value);
    const digits = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
    if (value.includes("十")) {
      const [a, b] = value.split("十");
      return (a ? digits[a] : 1) * 10 + (b ? digits[b] : 0);
    }
    return digits[value];
  };
  const synonyms = [
    ["swimming", "swim", "游泳", "游完泳"],
    ["badminton", "羽毛球", "打羽毛球"],
    ["bouldering", "boulder", "抱石"],
    ["study", "studying", "学习"],
    ["meeting", "会", "开会", "会议"],
  ];
  function canonical(value) {
    let key = value.toLowerCase().replace(/[\s\p{P}]/gu, "");
    for (const row of synonyms) {
      key = key.replace(new RegExp([...row].sort((a, b) => b.length - a.length).join("|"), "g"), row[0]);
    }
    return key;
  }
  function actionText(value) {
    return value.replace(/^(?:(?:please|could you|can you|would you)\s+|(?:请(?:帮我)?|帮我|麻烦(?:帮我)?))+/i, "").trim().replace(/^我(?=把|将)/, "");
  }
  function changeIntent(value) {
    const text = actionText(value);
    const targets = { todo: "todo", "to-do": "todo", "to do": "todo", pending: "todo", doing: "doing", "in progress": "doing", done: "done", complete: "done", completed: "done", finished: "done", 待办: "todo", 进行中: "doing", 已完成: "done", 完成: "done" };
    let match = text.match(/^(?:move|put|switch|change|set)\s+(.+?)\s+(?:back\s+)?(?:to|into|in)\s+(to[ -]?do|pending|doing|in progress|done|complete|completed|finished)$/i)
      || text.match(/^mark\s+(.+?)\s+(?:as\s+)?(to[ -]?do|pending|doing|in progress|done|complete|completed|finished)$/i)
      || text.match(/^(?:把|将)?(.+?)(?:标记为?|设置为|设为|改为|移回|移到|移至|放回|放到)(待办|进行中|已完成|完成|to[ -]?do|doing|done)$/i);
    if (match) return { status: targets[match[2].toLowerCase()], subject: match[1] };
    const en = [
      ["done", /^(?:complete|finish)\s+(.+)$/i],
      ["done", /^(?:(?:i(?:'ve| have)?|we(?:'ve| have)?)\s+)?(?:just\s+)?(?:finished|completed)\s+(.+)$/i],
      ["done", /^(?:(?:i(?:'m| am)|we(?:'re| are))\s+)?(?:done|finished)\s+(?:with\s+)?(.+)$/i],
      ["done", /^(.+?)\s+(?:is|are|was|has been)\s+(?:now\s+)?(?:done|complete|completed|finished)$/i],
      ["doing", /^(?:start|begin|resume|continue)\s+(?:(?:working|work)\s+on\s+)?(.+)$/i],
      ["doing", /^(?:i(?:'m| am)|we(?:'re| are))\s+(?:now\s+)?(?:working\s+on|doing)\s+(.+)$/i],
      ["doing", /^(.+?)\s+(?:is|are)\s+(?:now\s+)?(?:in progress|underway)$/i],
      ["todo", /^(?:reopen|reset)\s+(.+)$/i],
    ];
    for (const [status, pattern] of en) {
      match = text.match(pattern);
      if (match) return { status, subject: match[1] };
    }
    const zh = text.replace(/^(?:我(?:现在|已经|刚刚|刚)?|现在|已经|刚刚|刚)+/, "");
    if (/^游完泳(?:了)?$|^游泳完了$/.test(zh)) return { status: "done", subject: "游泳" };
    match = zh.match(/^(?:完成|做完|结束)(?:了)?(.+)$/) || zh.match(/^(.+?)(?:已经|已)?(?:完成|做完|结束)(?:了)?$/);
    if (match) return { status: "done", subject: match[1] };
    match = zh.match(/^(?:开始|继续)(?:做|处理)?(.+)$/) || zh.match(/^正在(?:做|处理)?(.+)$/) || zh.match(/^(.+?)(?:正在进行|进行中)$/);
    if (match) return { status: "doing", subject: match[1] };
    match = zh.match(/^重新打开(.+)$/);
    if (match) return { status: "todo", subject: match[1] };
    return null;
  }
  function taskChange(subject, status, state) {
    subject = subject.trim().replace(/^(?:(?:the|my|our|task)\s+)+/i, "").replace(/^(?:这项|这个|事项|任务)/, "").replace(/了$/, "").trim();
    const query = canonical(subject);
    if (!query) return { kind: "error", message: "Name the task to update." };
    const matches = state.tasks.filter((task) => canonical(task.title).includes(query));
    const exact = matches.filter((task) => canonical(task.title) === query);
    const scope = exact.length ? exact : matches;
    const eligible = scope.filter((task) => task.status !== status);
    return {
      kind: status === "done" ? "complete" : "move", status,
      candidates: eligible.map((task) => ({ id: task.id, title: task.title, status: task.status })),
      already: !eligible.length && scope.some((task) => task.status === status), query: subject,
    };
  }
  function parse(input, state, now = new Date(), action = "auto") {
    const raw = String(input).trim();
    if (!raw || raw.length > 500) return { kind: "error", message: "Enter a short command." };
    if (!["auto", "add", ...D.statuses].includes(action)) return { kind: "error", message: "Choose a valid action." };
    if (action !== "add" && /\b(?:not|never|don['’]t|didn['’]t|haven['’]t|cancel|delete)\b|不要|没有|还没|没完成|取消|删除|然后|以及|[;；]|\band\b/i.test(raw))
      return { kind: "error", message: "Use one positive task command at a time." };
    let text = raw.replace(/[。.!！?？]+$/g, "").replaceAll("’", "'").trim();
    // A frequent ASR homophone in this fixed completion phrase. The result is
    // still previewed and must be confirmed; never fuzzy-match arbitrary titles.
    text = text.replace(/游玩泳了/g, "游完泳了");
    const explicitAdd = /^(?:add|create|record|schedule|remind me)\b|^(?:新增|新建|添加|加入|记录|安排|提醒我)/i.test(actionText(text));
    const change = changeIntent(text);
    if (D.statuses.includes(action)) return taskChange(change?.subject || actionText(text), action, state);
    if (action === "auto" && !explicitAdd) {
      if (change) return taskChange(change.subject, change.status, state);
      // An incomplete or unfamiliar state command must not silently create a task.
      if (/^(?:complete|completed|finish|finished|done|start|begin|resume|continue|reopen|reset|mark|move|put|switch|set|change)\b|^(?:完成|做完|结束|开始|继续|重新打开)/i.test(actionText(text)))
        return { kind: "error", message: "Choose an action and name the task to update." };
    }
    let addStatus = "todo";
    if (explicitAdd && action !== "add") {
      const target = text.match(/\s+(?:to|in|into)\s+(to[ -]?do|doing|done)$/i) || text.match(/(?:到|在)(待办|进行中|已完成)$/);
      if (target) {
        addStatus = /done|已完成/i.test(target[1]) ? "done" : /doing|进行中/i.test(target[1]) ? "doing" : "todo";
        text = text.slice(0, target.index).trim();
      }
    }
    const date = new Date(now);
    let hasDate = false;
    const dayMatch = text.match(/后天|明天|今天|day after tomorrow|tomorrow|today/i);
    if (dayMatch) {
      const word = dayMatch[0].toLowerCase();
      date.setDate(date.getDate() + (["后天", "day after tomorrow"].includes(word) ? 2 : ["明天", "tomorrow"].includes(word) ? 1 : 0));
      text = text.replace(dayMatch[0], " ");
      hasDate = true;
    }
    if (/下周|星期|周[一二三四五六日天]|下个|\b(?:next|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\d+[月/年-]/i.test(text))
      return { kind: "error", message: "Use today, tomorrow or a manual task date for this command." };
    let time = { mode: "none" };
    const zhTime = text.match(/(凌晨|早上|上午|中午|下午|晚上)?\s*([零一二两三四五六七八九十\d]{1,3})[点时](半|一刻|三刻|[零一二两三四五六七八九十\d]{1,3}分?)?/);
    const enTime = text.match(/\b(?:at\s+)?(\d{1,2})(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\b/i) || text.match(/\b(?:at\s+)?(\d{1,2}):([0-5]\d)\b/i);
    const match = zhTime || enTime;
    if (match) {
      let h, m, period;
      if (zhTime) {
        h = number(match[2]);
        m = match[3] === "半" ? 30 : match[3] === "一刻" ? 15 : match[3] === "三刻" ? 45 : match[3] ? number(match[3].replace("分", "")) : 0;
        period = match[1];
        if (["下午", "晚上", "中午"].includes(period) && h < 12) h += 12;
        if (["上午", "早上", "凌晨"].includes(period) && h === 12) h = 0;
      } else {
        h = Number(match[1]); m = Number(match[2] || 0);
        period = match[3]?.toLowerCase().replaceAll(".", "");
        if (period && (h < 1 || h > 12)) return { kind: "error", message: "Check the spoken time." };
        if (period === "pm" && h < 12) h += 12;
        if (period === "am" && h === 12) h = 0;
      }
      if (!Number.isInteger(h) || !Number.isInteger(m) || h > 23 || m > 59) return { kind: "error", message: "Check the spoken time." };
      time = { mode: "start", start: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` };
      hasDate = true;
      text = text.replace(match[0], " ");
    }
    if (/\d+[点时:]|[一二两三四五六七八九十]+点|小时|分钟|\b(?:am|pm|hours?|minutes?|at\s+\d)\b|下午|上午|晚上/i.test(text))
      return { kind: "error", message: "Check the spoken time. Use the task editor for ranges or durations." };
    const title = actionText(text).replace(/^(?:添加|加入|记录|安排)(?:一个|一项)?(?:事项|任务)?/, "").replace(/(?:帮我(?:记录|记|添加|加|安排)(?:一下)?|请(?:帮我)?|记录一下|提醒我|加入待办|添加待办|新增(?:事项|任务)?|新建(?:事项|任务)?|我有一个|我有个|有一个|有个|一个|我要|我)/g, "")
      .replace(/^(?:add|create|record|remind me(?: to)?|i have(?: a| an)?|schedule)\s+(?:(?:a|an)\s+)?(?:task\s+)?/i, "")
      .replace(/^[\s,，:：]+|[\s,，:：]+$/g, "").replace(/\s+/g, " ").trim();
    if (!title || title.length > 240) return { kind: "error", message: "Enter a short task name." };
    const key = canonical(title);
    const preferred = /swimming|badminton|bouldering/.test(key) ? "sport" : /study|学习|复习/.test(key) ? "study" : "";
    return { kind: "add", values: { title, status: addStatus, categoryId: state.categories.some((c) => c.id === preferred) ? preferred : "", date: hasDate ? D.localDate(date) : "", time } };
  }
  return { parse };
});

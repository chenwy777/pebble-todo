(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Pebble = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const statuses = ["todo", "doing", "done"];
  const uid = () => globalThis.crypto.randomUUID();
  const localDate = (date = new Date()) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const fail = (message) => {
    throw new Error(message);
  };
  function minutes(value) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || ""))
      fail("请选择有效的开始和结束时间");
    const [h, m] = value.split(":").map(Number);
    return h * 60 + m;
  }
  function normalizeTime(time = { mode: "none" }) {
    if (time.mode === "none") return { mode: "none" };
    if (time.mode === "duration") {
      const durationMinutes = Number(time.durationMinutes);
      if (
        !Number.isInteger(durationMinutes) ||
        durationMinutes < 1 ||
        durationMinutes > 10080
      )
        fail("预计时长须为 1 分钟至 168 小时");
      return { mode: "duration", durationMinutes };
    }
    if (time.mode === "range") {
      const start = minutes(time.start),
        end = minutes(time.end);
      if (start === end) fail("开始和结束时间不能相同");
      return {
        mode: "range",
        start: time.start,
        end: time.end,
        durationMinutes: (end - start + 1440) % 1440,
        overnight: end < start,
      };
    }
    fail("未知时间类型");
  }
  function formatDuration(value, language = "zh") {
    const h = Math.floor(value / 60),
      m = value % 60;
    return language === "en"
      ? [h ? `${h}h` : "", m ? `${m}m` : ""].filter(Boolean).join(" ")
      : [h ? `${h}小时` : "", m ? `${m}分钟` : ""].filter(Boolean).join("");
  }
  function createState() {
    const categories = [
      { id: "career", name: "求职", color: "#8c94d9" },
      { id: "study", name: "学习", color: "#d5a76b" },
      { id: "sport", name: "运动", color: "#7aa995" },
      { id: "life", name: "生活", color: "#ce8e99" },
    ];
    return {
      schemaVersion: 1,
      tasks: [],
      categories,
      templates: [
        {
          id: "cv",
          title: "修改 CV",
          categoryId: "career",
          durationMinutes: 45,
        },
        {
          id: "apply",
          title: "投递岗位",
          categoryId: "career",
          durationMinutes: 30,
        },
        {
          id: "read",
          title: "阅读 / 学习",
          categoryId: "study",
          durationMinutes: 30,
        },
        { id: "swim", title: "游泳", categoryId: "sport", durationMinutes: 60 },
        {
          id: "badminton",
          title: "羽毛球",
          categoryId: "sport",
          durationMinutes: 90,
        },
        {
          id: "boulder",
          title: "抱石",
          categoryId: "sport",
          durationMinutes: 90,
        },
      ],
      settings: {
        dateLanguage: "en",
        textColor: "#292c2b",
        opacity: 94,
        pinned: false,
        position: null,
      },
    };
  }
  function validDate(value) {
    if (value === "") return true;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
      return false;
    const date = new Date(value + "T12:00:00");
    return !Number.isNaN(date.valueOf()) && localDate(date) === value;
  }
  function text(value, max, label) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > max)
      fail(`${label}不能为空，最多 ${max} 个字符`);
    return value.trim();
  }
  function color(value) {
    if (typeof value !== "string" || !/^#[a-f\d]{6}$/i.test(value))
      fail("请选择有效颜色");
    return value;
  }
  function validateState(input) {
    if (
      !input ||
      input.schemaVersion !== 1 ||
      !Array.isArray(input.tasks) ||
      !Array.isArray(input.categories) ||
      !Array.isArray(input.templates)
    )
      fail("不支持的数据文件");
    if (
      input.tasks.length > 10000 ||
      input.categories.length > 100 ||
      input.templates.length > 1000
    )
      fail("事项、分类或模板数量过多");
    const ids = new Set();
    const id = (value) => {
      const result = text(value, 100, "标识");
      if (ids.has(result)) fail("数据中有重复标识");
      ids.add(result);
      return result;
    };
    const categories = input.categories.map((c) => ({
      id: id(c.id),
      name: text(c.name, 30, "分类名称"),
      color: color(c.color),
    }));
    const categoryIds = new Set(categories.map((c) => c.id));
    const category = (value) => {
      if (value !== "" && !categoryIds.has(value)) fail("分类不存在");
      return value;
    };
    const tasks = input.tasks.map((t) => {
      if (!statuses.includes(t.status) || !validDate(t.date))
        fail("事项状态或日期无效");
      const createdAt = new Date(t.createdAt).toISOString();
      return {
        id: id(t.id),
        title: text(t.title, 240, "事项"),
        categoryId: category(t.categoryId),
        status: t.status,
        date: t.date,
        time: normalizeTime(t.time),
        createdAt,
        completedAt:
          t.status === "done"
            ? new Date(t.completedAt || createdAt).toISOString()
            : null,
      };
    });
    const templates = input.templates.map((t) => ({
      id: id(t.id),
      title: text(t.title, 240, "模板"),
      categoryId: category(t.categoryId),
      durationMinutes: t.durationMinutes
        ? normalizeTime({
            mode: "duration",
            durationMinutes: t.durationMinutes,
          }).durationMinutes
        : 0,
    }));
    const s = input.settings || {};
    const position =
      s.position &&
      Number.isFinite(s.position.x) &&
      Number.isFinite(s.position.y)
        ? { x: Math.round(s.position.x), y: Math.round(s.position.y) }
        : null;
    return {
      schemaVersion: 1,
      tasks,
      categories,
      templates,
      settings: {
        dateLanguage: s.dateLanguage === "zh" ? "zh" : "en",
        textColor: color(s.textColor || "#292c2b"),
        opacity: Math.max(70, Math.min(100, Number(s.opacity) || 94)),
        pinned: Boolean(s.pinned),
        position,
      },
    };
  }
  function makeTask(values) {
    const now = new Date().toISOString();
    return {
      id: uid(),
      title: text(values.title, 240, "事项"),
      categoryId: values.categoryId || "",
      status: values.status || "todo",
      date: values.date || "",
      time: normalizeTime(values.time),
      createdAt: now,
      completedAt: values.status === "done" ? now : null,
    };
  }
  return {
    statuses,
    uid,
    localDate,
    normalizeTime,
    formatDuration,
    createState,
    validateState,
    makeTask,
  };
});

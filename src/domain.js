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
      fail("Enter valid start and end times.");
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
        fail("Duration must be 1 minute to 168 hours.");
      return { mode: "duration", durationMinutes };
    }
    if (time.mode === "range") {
      const start = minutes(time.start),
        end = minutes(time.end);
      if (start === end) fail("Start and end times must be different.");
      return {
        mode: "range",
        start: time.start,
        end: time.end,
        durationMinutes: (end - start + 1440) % 1440,
        overnight: end < start,
      };
    }
    fail("Unknown time type.");
  }
  function formatDuration(value, language = "zh") {
    const h = Math.floor(value / 60),
      m = value % 60;
    return language === "en"
      ? [h ? `${h}h` : "", m ? `${m}m` : ""].filter(Boolean).join(" ")
      : [h ? `${h}小时` : "", m ? `${m}分钟` : ""].filter(Boolean).join("");
  }
  const categoryDefaults = {
    career: ["Career", "求职"],
    study: ["Study", "学习"],
    sport: ["Exercise", "运动"],
    life: ["Personal", "生活"],
  };
  const templateDefaults = {
    cv: ["Review CV", "修改 CV"],
    apply: ["Apply for jobs", "投递岗位"],
    read: ["Read / study", "阅读 / 学习"],
    swim: ["Swimming", "游泳"],
    badminton: ["Badminton", "羽毛球"],
    boulder: ["Bouldering", "抱石"],
  };
  function preset(item, defaults, field) {
    const names = defaults[item.id];
    if (
      names &&
      names.includes(item[field]) &&
      (item.builtinKey === names[0] || !Object.hasOwn(item, "builtinKey"))
    )
      return { [field]: names[0], builtinKey: names[0] };
    return { [field]: item[field], builtinKey: "" };
  }
  function createState() {
    const categories = [
      { id: "study", name: "学习", color: "#d5a76b" },
      { id: "sport", name: "运动", color: "#7aa995" },
      { id: "life", name: "生活", color: "#ce8e99" },
    ];
    return {
      schemaVersion: 1,
      tasks: [],
      categories: categories.map((c) => ({
        ...c,
        ...preset(c, categoryDefaults, "name"),
      })),
      templates: [
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
      ].map((t) => ({ ...t, ...preset(t, templateDefaults, "title") })),
      settings: {
        dateLanguage: "en",
        language: "en",
        textColor: "#292c2b",
        opacity: 82,
        appearanceVersion: 3,
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
      fail(`${label} must contain 1 to ${max} characters.`);
    return value.trim();
  }
  function color(value) {
    if (typeof value !== "string" || !/^#[a-f\d]{6}$/i.test(value))
      fail("Choose a valid color.");
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
      fail("Unsupported data file.");
    if (
      input.tasks.length > 10000 ||
      input.categories.length > 100 ||
      input.templates.length > 1000
    )
      fail("Too many tasks, categories or templates.");
    const ids = new Set();
    const id = (value) => {
      const result = text(value, 100, "ID");
      if (ids.has(result)) fail("Duplicate data IDs.");
      ids.add(result);
      return result;
    };
    const categories = input.categories.map((c) => ({
      id: id(c.id),
      name: text(preset(c, categoryDefaults, "name").name, 30, "Category name"),
      builtinKey: preset(c, categoryDefaults, "name").builtinKey,
      color: color(c.color),
    }));
    const categoryIds = new Set(categories.map((c) => c.id));
    const category = (value) => {
      if (value !== "" && !categoryIds.has(value))
        fail("Category does not exist.");
      return value;
    };
    const tasks = input.tasks.map((t) => {
      if (!statuses.includes(t.status) || !validDate(t.date))
        fail("Invalid task status or date.");
      const createdAt = new Date(t.createdAt).toISOString();
      return {
        id: id(t.id),
        title: text(t.title, 240, "Task"),
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
      title: text(preset(t, templateDefaults, "title").title, 240, "Template"),
      builtinKey: preset(t, templateDefaults, "title").builtinKey,
      categoryId: category(t.categoryId),
      durationMinutes: t.durationMinutes
        ? normalizeTime({
            mode: "duration",
            durationMinutes: t.durationMinutes,
          }).durationMinutes
        : 0,
    }));
    // Remove only the retired, unedited built-in. Keep tasks and user-customized names/templates.
    const removeCareer = categories.some(
      (c) => c.id === "career" && c.builtinKey === "Career",
    );
    const activeCategories = removeCareer
      ? categories.filter((c) => c.id !== "career")
      : categories;
    const activeTasks = removeCareer
      ? tasks.map((t) =>
          t.categoryId === "career" ? { ...t, categoryId: "" } : t,
        )
      : tasks;
    const activeTemplates = removeCareer
      ? templates
          .filter(
            (t) =>
              !(
                ["cv", "apply"].includes(t.id) &&
                ["Review CV", "Apply for jobs"].includes(t.builtinKey)
              ),
          )
          .map((t) =>
            t.categoryId === "career" ? { ...t, categoryId: "" } : t,
          )
      : templates;
    const s = input.settings || {};
    const position =
      s.position &&
      Number.isFinite(s.position.x) &&
      Number.isFinite(s.position.y)
        ? { x: Math.round(s.position.x), y: Math.round(s.position.y) }
        : null;
    return {
      schemaVersion: 1,
      tasks: activeTasks,
      categories: activeCategories,
      templates: activeTemplates,
      settings: {
        dateLanguage: s.language && s.dateLanguage === "zh" ? "zh" : "en",
        language: s.language === "zh" ? "zh" : "en",
        textColor: color(s.textColor || "#292c2b"),
        opacity:
          Number(s.appearanceVersion || 0) < 3 && Number(s.opacity) === 94
            ? 82
            : Math.max(70, Math.min(100, Number(s.opacity) || 82)),
        appearanceVersion: 3,
        pinned: Boolean(s.pinned),
        position,
      },
    };
  }
  function makeTask(values) {
    const now = new Date().toISOString();
    return {
      id: uid(),
      title: text(values.title, 240, "Task"),
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

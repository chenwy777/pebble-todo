const { test } = require("node:test");
const assert = require("node:assert/strict");
const D = require("../src/domain.js");
const I = require("../src/i18n.js");

test("new profiles default to English without job-search categories or templates", () => {
  const state = D.createState();
  assert.equal(state.settings.language, "en");
  assert.equal(state.settings.opacity, 82);
  assert.equal(state.categories[0].name, "Study");
  assert.equal(I.t("zh", state.categories[0].builtinKey), "学习");
  assert.equal(
    state.categories.some((c) => c.id === "career"),
    false,
  );
  assert.equal(
    state.templates.some((t) => ["cv", "apply"].includes(t.id)),
    false,
  );
  assert.equal(
    I.error("zh", "Start and end times must be different."),
    "开始和结束时间不能相同。",
  );
});

test("legacy job-search preset is removed without deleting tasks or customized templates", () => {
  const state = D.createState();
  delete state.settings.language;
  state.settings.dateLanguage = "zh";
  delete state.settings.appearanceVersion;
  state.settings.opacity = 94;
  state.categories.unshift({ id: "career", name: "求职", color: "#8c94d9" });
  state.templates.unshift(
    { id: "cv", title: "修改 CV", categoryId: "career", durationMinutes: 45 },
    {
      id: "apply",
      title: "投递岗位",
      categoryId: "career",
      durationMinutes: 30,
    },
  );
  state.templates.push({
    id: "my-template",
    title: "My own template",
    categoryId: "career",
    durationMinutes: 30,
  });
  state.tasks.push(D.makeTask({ title: "Keep my task", categoryId: "career" }));
  const migrated = D.validateState(state);
  assert.equal(migrated.settings.language, "en");
  assert.equal(migrated.settings.dateLanguage, "en");
  assert.equal(migrated.settings.opacity, 82);
  assert.equal(
    migrated.categories.some((c) => c.id === "career"),
    false,
  );
  assert.equal(migrated.tasks[0].title, "Keep my task");
  assert.equal(migrated.tasks[0].categoryId, "");
  assert.equal(
    migrated.templates.some((t) => ["cv", "apply"].includes(t.id)),
    false,
  );
  assert.equal(
    migrated.templates.find((t) => t.id === "my-template").categoryId,
    "",
  );
  assert.deepEqual(D.validateState(migrated), migrated);
});

test("custom category names, templates, opacity and language survive migration", () => {
  const state = D.createState();
  state.categories.unshift({
    id: "career",
    name: "Creative projects",
    color: "#8c94d9",
    builtinKey: "",
  });
  state.templates.unshift({
    id: "cv",
    title: "My custom routine",
    categoryId: "career",
    durationMinutes: 15,
    builtinKey: "",
  });
  state.categories[1].name = "Research / 研究";
  state.categories[1].builtinKey = "";
  state.settings.language = "zh";
  state.settings.dateLanguage = "zh";
  state.settings.opacity = 77;
  const custom = D.validateState(state);
  assert.equal(custom.categories[0].name, "Creative projects");
  assert.equal(custom.categories[1].name, "Research / 研究");
  assert.equal(custom.templates[0].title, "My custom routine");
  assert.equal(custom.settings.opacity, 77);
  assert.equal(custom.settings.language, "zh");
});

test("time ranges calculate minutes and explicitly identify next-day endings", () => {
  assert.deepEqual(
    D.normalizeTime({ mode: "range", start: "14:30", end: "16:00" }),
    {
      mode: "range",
      start: "14:30",
      end: "16:00",
      durationMinutes: 90,
      overnight: false,
    },
  );
  assert.deepEqual(
    D.normalizeTime({ mode: "range", start: "23:45", end: "00:15" }),
    {
      mode: "range",
      start: "23:45",
      end: "00:15",
      durationMinutes: 30,
      overnight: true,
    },
  );
  assert.throws(() =>
    D.normalizeTime({ mode: "range", start: "09:00", end: "09:00" }),
  );
  assert.throws(() =>
    D.normalizeTime({ mode: "range", start: "25:01", end: "09:00" }),
  );
});
test("duration validation preserves hour-plus-minute values and rejects invalid values", () => {
  assert.equal(D.formatDuration(150), "2小时30分钟");
  assert.equal(D.formatDuration(120), "2小时");
  assert.equal(D.formatDuration(45), "45分钟");
  assert.equal(D.formatDuration(90, "en"), "1h 30m");
  for (const value of [0, -1, 1.5, 10081, Infinity, "oops"])
    assert.throws(() =>
      D.normalizeTime({ mode: "duration", durationMinutes: value }),
    );
});
test("state validation rejects corrupt dates, broken category references and duplicate IDs", () => {
  const state = D.createState();
  state.tasks.push(
    D.makeTask({
      title: "复习 CV",
      categoryId: "study",
      date: "2026-10-22",
      time: { mode: "duration", durationMinutes: 45 },
    }),
  );
  assert.equal(D.validateState(state).tasks[0].title, "复习 CV");
  const wrongDate = structuredClone(state);
  wrongDate.tasks[0].date = "2026-02-30";
  assert.throws(() => D.validateState(wrongDate));
  const wrongCategory = structuredClone(state);
  wrongCategory.tasks[0].categoryId = "missing";
  assert.throws(() => D.validateState(wrongCategory));
  const duplicate = structuredClone(state);
  duplicate.tasks.push(duplicate.tasks[0]);
  assert.throws(() => D.validateState(duplicate));
  const invalidColor = structuredClone(state);
  invalidColor.settings.textColor = "url(evil)";
  assert.throws(() => D.validateState(invalidColor));
});
test("tasks in Done receive completion timestamps; duration alone never completes a task", () => {
  assert.ok(D.makeTask({ title: "游泳", status: "done" }).completedAt);
  const task = D.makeTask({
    title: "Read",
    time: { mode: "duration", durationMinutes: 45 },
  });
  assert.equal(task.status, "todo");
  assert.equal(task.completedAt, null);
});

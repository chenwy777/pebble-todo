const { test } = require("node:test");
const assert = require("node:assert/strict");
const D = require("../src/domain.js");
const I = require("../src/i18n.js");

test("new profiles default to English and built-in labels are localizable", () => {
  const state = D.createState();
  assert.equal(state.settings.language, "en");
  assert.equal(state.categories[0].name, "Career");
  assert.equal(state.templates[0].title, "Review CV");
  assert.equal(I.t("zh", state.categories[0].builtinKey), "求职");
  assert.equal(
    I.t("zh", "Estimated {duration}", { duration: "1小时30分钟" }),
    "预计 1小时30分钟",
  );
  assert.equal(
    I.error("zh", "Start and end times must be different."),
    "开始和结束时间不能相同。",
  );
});

test("legacy defaults migrate while customized names, tasks and selected language survive validation", () => {
  const state = D.createState();
  delete state.settings.language;
  state.settings.dateLanguage = "zh";
  state.categories[0].name = "求职";
  delete state.categories[0].builtinKey;
  state.categories[1].name = "Research / 研究";
  delete state.categories[1].builtinKey;
  state.templates[0].title = "改我的 CV";
  delete state.templates[0].builtinKey;
  state.tasks.push(D.makeTask({ title: "我的事项", categoryId: "career" }));
  const migrated = D.validateState(state);
  assert.equal(migrated.settings.language, "en");
  assert.equal(migrated.settings.dateLanguage, "en");
  assert.equal(migrated.categories[0].name, "Career");
  assert.equal(migrated.categories[1].name, "Research / 研究");
  assert.equal(migrated.categories[1].builtinKey, "");
  assert.equal(migrated.templates[0].title, "改我的 CV");
  assert.equal(migrated.tasks[0].title, "我的事项");
  migrated.settings.language = "zh";
  migrated.settings.dateLanguage = "zh";
  migrated.categories[0].name = "Career edited";
  const custom = D.validateState(migrated);
  assert.equal(custom.categories[0].name, "Career edited");
  assert.equal(custom.categories[0].builtinKey, "");
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
      categoryId: "career",
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

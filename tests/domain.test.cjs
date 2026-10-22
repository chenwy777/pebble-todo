const { test } = require("node:test");
const assert = require("node:assert/strict");
const D = require("../src/domain.js");

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

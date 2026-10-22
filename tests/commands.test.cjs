const { test } = require("node:test");
const assert = require("node:assert/strict");
const D = require("../src/domain.js");
const C = require("../src/commands.js");
const now = new Date(2026, 9, 22, 10, 0);
test("spoken meeting keeps only the requested start time using the local date", () => {
  const result = C.parse("我下午三点有一个会，帮我记录一下", D.createState(), now);
  assert.equal(result.kind, "add");
  assert.equal(result.values.date, "2026-10-22");
  assert.deepEqual(result.values.time, { mode: "start", start: "15:00" });
  assert.equal(result.values.title, "会");
  const tomorrow = C.parse("Meeting tomorrow at 3:30 pm", D.createState(), now);
  assert.equal(tomorrow.values.date, "2026-10-23");
  assert.equal(tomorrow.values.time.start, "15:30");
  assert.deepEqual(D.validateState({ ...D.createState(), tasks: [D.makeTask(tomorrow.values)] }).tasks[0].time, tomorrow.values.time);
});
test("Chinese and English completion match across languages and preserve ambiguity", () => {
  const state = D.createState();
  state.tasks = [D.makeTask({title: "swimming", status: "todo"}), D.makeTask({ title: "游泳", status: "doing" }), D.makeTask({ title: "Swimming", status: "done" })];
  for (const command of ["我现在游完泳了", "我现在游玩泳了", "I finished swimming.", "我游泳完了"]) {
    const result = C.parse(command, state, now);
    assert.equal(result.kind, "complete");
    assert.equal(result.candidates.length, 2, command);
    assert.equal(state.tasks[0].status, "todo", "parsing never mutates tasks");
  }
  assert.equal(C.parse("I finished bouldering", state, now).candidates.length, 0);
});

test("imperative and reported completion update existing meetings rather than create tasks", () => {
  const state = D.createState();
  state.tasks = [D.makeTask({ title: "meeting", status: "todo" }), D.makeTask({ title: "team meeting", status: "doing" })];
  for (const command of ["Complete the meeting.", "Finish the meeting", "Please mark the meeting as complete", "I have completed the meeting", "I'm done with the meeting", "I am finished with the meeting", "The meeting has been completed", "请完成会议", "会议已经完成了", "我把会议标记为完成", "把会议移到Done"]) {
    const result = C.parse(command, state, now);
    assert.equal(result.kind, "complete", command);
    assert.equal(result.status, "done", command);
    assert.deepEqual(result.candidates.map((task) => task.id), [state.tasks[0].id], command);
    assert.equal(state.tasks[0].status, "todo", "preview never changes data");
  }
  const missing = C.parse("Complete the missing meeting", state, now);
  assert.equal(missing.kind, "complete");
  assert.deepEqual(missing.candidates, []);
  const already = C.parse("Complete the meeting", { ...state, tasks: [D.makeTask({ title: "meeting", status: "done" }), state.tasks[1]] }, now);
  assert.equal(already.already, true);
  assert.equal(already.candidates.length, 0);
});

test("start, reopen and explicit add status follow intent independently of any UI tab", () => {
  const state = D.createState();
  state.tasks = [D.makeTask({ title: "meeting", status: "todo" }), D.makeTask({ title: "swimming", status: "done" })];
  for (const command of ["Start the meeting", "I'm working on the meeting", "Move the meeting to doing", "开始会议", "把会议设为进行中"]) {
    const result = C.parse(command, state, now);
    assert.equal(result.kind, "move", command);
    assert.equal(result.status, "doing", command);
    assert.equal(result.candidates[0].id, state.tasks[0].id, command);
  }
  for (const command of ["Reopen swimming", "Move swimming back to to-do", "把游泳移回待办"]) {
    const result = C.parse(command, state, now);
    assert.equal(result.status, "todo", command);
    assert.equal(result.candidates[0].id, state.tasks[1].id, command);
  }
  for (const [command, status] of [["Add a task finish the meeting", "todo"], ["Add meeting to doing", "doing"], ["添加会议到已完成", "done"]]) {
    const result = C.parse(command, state, now);
    assert.equal(result.kind, "add", command);
    assert.equal(result.values.status, status, command);
  }
  assert.equal(C.parse("Read Getting Things Done", state, now).kind, "add", "a word in a task title is not a state command");
  assert.equal(C.parse("meeting", state, now, "doing").status, "doing");
  assert.equal(C.parse("Complete the meeting", state, now, "add").kind, "add", "user can deliberately add a title that sounds like a command");
  for (const command of ["Complete", "Mark meeting", "I haven't finished swimming", "I haven’t finished swimming"]) assert.equal(C.parse(command, state, now).kind, "error", command);
});
test("negation, multiple actions, unsupported dates and invalid times never become writes", () => {
  for (const text of ["我还没完成游泳", "I have not finished swimming", "我明天下午三点到四点有会", "Meeting at 25:00", "Meeting next Monday", "Meeting at 3", "I finished swimming and studying"]) {
    assert.equal(C.parse(text, D.createState(), now).kind, "error", text);
  }
});
test("category emoji and colors survive import, old files migrate", () => {
  const state = D.createState();
  state.categories[0].emoji = "👩🏽‍💻";
  const saved = D.validateState(state);
  assert.equal(saved.categories[0].emoji, "👩🏽‍💻");
  delete state.categories[0].emoji;
  assert.equal(saved.categories[0].color, state.categories[0].color);
  assert.equal(D.validateState(state).categories[0].emoji, "");
  state.categories[0].emoji = '<script>';
  assert.throws(() => D.validateState(state), /emoji/);
});

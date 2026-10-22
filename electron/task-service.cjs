const D = require("../src/domain.js");
const I = require("../src/i18n.js");

const methods = [
  "pebble_get_context",
  "pebble_list_categories",
  "pebble_list_tasks",
  "pebble_add_task",
];
const conflict = "The list changed. Review the latest tasks and try again.";
function object(value, fields) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !fields.includes(key))
  )
    throw new Error("Invalid tool arguments.");
}

class TaskService {
  constructor(store, state, onChange = () => {}) {
    this.store = store;
    this.state = D.validateState(state);
    this.queue = Promise.resolve();
    this.onChange = onChange;
  }
  update(change, { expectedRevision, bump = true, source = "ui" } = {}) {
    const operation = this.queue.then(async () => {
      if (
        expectedRevision !== undefined &&
        expectedRevision !== this.state.revision
      )
        throw new Error(conflict);
      const changed = change(structuredClone(this.state));
      if (changed === null) return this.state;
      changed.revision = this.state.revision + (bump ? 1 : 0);
      const saved = await this.store.save(changed);
      this.state = saved;
      this.onChange(saved, source);
      return saved;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  save(next, replace = false) {
    return this.update(
      (current) => ({
        ...next,
        settings: {
          ...next.settings,
          position: current.settings.position,
          ...(replace ? { aiEnabled: current.settings.aiEnabled } : {}),
        },
      }),
      { expectedRevision: replace ? undefined : (next.revision ?? 0) },
    );
  }
  async execute(method, args = {}) {
    if (!methods.includes(method)) throw new Error("Unknown Pebble tool.");
    await this.queue;
    if (!this.state.settings.aiEnabled)
      throw new Error(
        "Local AI access is off. Enable it in Pebble Settings → AI connections.",
      );
    const state = this.state;
    if (method === "pebble_get_context") {
      object(args, []);
      const now = new Date();
      return {
        date: D.localDate(now),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        now: now.toISOString(),
        utcOffsetMinutes: -now.getTimezoneOffset(),
        language: state.settings.language,
        revision: state.revision,
        counts: Object.fromEntries(
          D.statuses.map((status) => [
            status,
            state.tasks.filter((t) => t.status === status).length,
          ]),
        ),
      };
    }
    if (method === "pebble_list_categories") {
      object(args, []);
      return {
        categories: state.categories.map((c) => ({
          id: c.id,
          name: I.categoryName(state.settings.language, c),
          names: { en: I.categoryName("en", c), zh: I.categoryName("zh", c) },
          color: c.color,
        })),
        uncategorizedId: "",
      };
    }
    if (method === "pebble_list_tasks") {
      object(args, [
        "status",
        "categoryId",
        "date",
        "query",
        "limit",
        "offset",
      ]);
      if (args.status !== undefined && !D.statuses.includes(args.status))
        throw new Error("Invalid task status or date.");
      if (
        ["categoryId", "date", "query"].some(
          (k) => args[k] !== undefined && typeof args[k] !== "string",
        )
      )
        throw new Error("Invalid tool arguments.");
      const limit = args.limit ?? 50,
        offset = args.offset ?? 0;
      if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100 ||
        !Number.isSafeInteger(offset) ||
        offset < 0
      )
        throw new Error("Invalid pagination.");
      const matches = state.tasks.filter(
        (t) =>
          (args.status === undefined || t.status === args.status) &&
          (args.categoryId === undefined || t.categoryId === args.categoryId) &&
          (args.date === undefined || t.date === args.date) &&
          (!args.query ||
            t.title.toLowerCase().includes(args.query.toLowerCase())),
      );
      return {
        tasks: structuredClone(matches.slice(offset, offset + limit)),
        total: matches.length,
        nextOffset: offset + limit < matches.length ? offset + limit : null,
        revision: state.revision,
      };
    }
    object(args, [
      "title",
      "status",
      "categoryId",
      "date",
      "time",
      "requestId",
    ]);
    if (args.status !== undefined && !D.statuses.includes(args.status))
      throw new Error("Invalid task status or date.");
    if (
      ["categoryId", "date"].some(
        (k) => args[k] !== undefined && typeof args[k] !== "string",
      )
    )
      throw new Error("Invalid tool arguments.");
    if (
      args.requestId !== undefined &&
      (typeof args.requestId !== "string" ||
        !args.requestId.trim() ||
        args.requestId.length > 100)
    )
      throw new Error("Invalid request ID.");
    const task = D.makeTask({ ...args, externalRequestId: args.requestId });
    let taskId = task.id,
      reused = false;
    const saved = await this.update(
      (current) => {
        if (!current.settings.aiEnabled)
          throw new Error("Local AI access is off.");
        const existing =
          task.externalRequestId &&
          current.tasks.find(
            (t) => t.externalRequestId === task.externalRequestId,
          );
        if (existing) {
          taskId = existing.id;
          reused = true;
          return null;
        }
        current.tasks.push(task);
        return current;
      },
      { source: "ai" },
    );
    return {
      task: structuredClone(saved.tasks.find((t) => t.id === taskId)),
      reused,
      revision: saved.revision,
    };
  }
}
module.exports = { TaskService, methods, conflict };

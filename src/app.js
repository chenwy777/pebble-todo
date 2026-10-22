"use strict";
const D = window.Pebble;
const $ = (id) => document.getElementById(id);
const icons = {
  pin: '<path d="m7 3 10 0-2 5 3 3H6l3-3-2-5Z"/><path d="M12 11v8"/>',
  settings:
    '<path d="m9 3 1-1h4l1 3 3 1 2 2-1 3 1 3-2 2-3 1-1 3h-4l-1-3-3-1-2-2 1-3-1-3 2-2 3-1Z"/><circle cx="12" cy="11" r="3"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  arrow: '<path d="M5 12h13m-5-5 5 5-5 5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  sparkles:
    '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4m-2-2h4"/>',
  leaf: '<path d="M19 4C7 2 2 10 7 16s16 2 12-12ZM6 19l9-10"/>',
  trash: '<path d="M4 6h16M9 3h6m-9 3 1 14h10l1-14M10 9v7m4-7v7"/>',
  play: '<path d="m9 6 9 6-9 6V6Z"/>',
  reset: '<path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/>',
};
const svg = (name) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.leaf}</svg>`;
document
  .querySelectorAll("[data-icon]")
  .forEach((el) => (el.innerHTML = svg(el.dataset.icon)));
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
let state,
  activeTab = "todo",
  filter = "all",
  busy = false,
  lastUndo = null,
  toastTimer,
  hoverTimer,
  closeTimer,
  editingId = null,
  windowExpanded = false;
const clone = (obj) => structuredClone(obj);
const dialogs = [...document.querySelectorAll("dialog")];
const anyDialog = () => dialogs.some((d) => d.open);

function toast(message, undoState) {
  clearTimeout(toastTimer);
  lastUndo = undoState || null;
  $("toast-message").textContent = message;
  $("undo").hidden = !lastUndo;
  $("toast").hidden = false;
  toastTimer = setTimeout(
    () => {
      $("toast").hidden = true;
      lastUndo = null;
    },
    undoState ? 9000 : 5000,
  );
}
async function commit(next, message, undoable = false) {
  if (busy) {
    toast("正在保存，请稍等一下");
    return false;
  }
  const before = clone(state);
  busy = true;
  document.body.classList.add("save-busy");
  try {
    state = await window.desktop.save(next);
    render();
    if (message) toast(message, undoable ? before : null);
    return true;
  } catch (error) {
    toast(`保存失败：${error.message}`);
    return false;
  } finally {
    busy = false;
    document.body.classList.remove("save-busy");
  }
}
function options(selected, includeAll = false) {
  return (
    (includeAll
      ? '<option value="all">所有分类</option>'
      : '<option value="">未分类</option>') +
    state.categories
      .map(
        (c) =>
          `<option value="${esc(c.id)}" ${c.id === selected ? "selected" : ""}>${esc(c.name)}</option>`,
      )
      .join("")
  );
}
function fillSelect(id, selected, includeAll = false) {
  $(id).innerHTML = options(selected, includeAll);
  if (includeAll) $(id).value = selected;
}
function categoryTag(id) {
  const c = state.categories.find((c) => c.id === id);
  return c
    ? `<span class="category-tag" style="--category-color:${c.color}"><i></i>${esc(c.name)}</span>`
    : "";
}
function dateLabel(date) {
  if (!date) return "";
  const today = D.localDate(),
    tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date === today) return "今天";
  if (date === D.localDate(tomorrow)) return "明天";
  return new Date(date + "T12:00:00").toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    ...(date.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}),
  });
}
function scheduleLabel(t) {
  const parts = [];
  if (t.date) parts.push(dateLabel(t.date));
  if (t.time.mode === "duration")
    parts.push("预计 " + D.formatDuration(t.time.durationMinutes));
  if (t.time.mode === "range")
    parts.push(
      `${t.time.start}–${t.time.overnight ? "次日 " : ""}${t.time.end}`,
      D.formatDuration(t.time.durationMinutes),
    );
  return parts.join(" · ");
}
function renderDate() {
  const date = new Date(),
    zh = state.settings.dateLanguage === "zh";
  $("weekday").textContent = date.toLocaleDateString(zh ? "zh-CN" : "en-AU", {
    weekday: "long",
  });
  $("date").textContent = date.toLocaleDateString(zh ? "zh-CN" : "en-US", {
    month: "long",
    day: "numeric",
  });
  $("date-toggle").setAttribute(
    "aria-label",
    `今天 ${date.toLocaleDateString(zh ? "zh-CN" : "en-AU")}，点击切换语言`,
  );
}
function render() {
  const { settings, tasks } = state;
  document.documentElement.style.setProperty("--ink", settings.textColor);
  document.documentElement.style.setProperty(
    "--opacity",
    settings.opacity / 100,
  );
  renderDate();
  const counts = { todo: 0, doing: 0, done: 0 };
  tasks.forEach((t) => counts[t.status]++);
  for (const status of D.statuses)
    $("count-" + status).textContent = counts[status];
  $("orb-count").textContent = Math.min(counts.todo + counts.doing, 99);
  $("orb-count").hidden = counts.todo + counts.doing === 0;
  const today = D.localDate();
  const daily = tasks.filter(
    (t) =>
      t.date === today ||
      (t.status === "done" && D.localDate(new Date(t.completedAt)) === today),
  );
  const done = daily.filter((t) => t.status === "done").length;
  $("summary").textContent = done
    ? `今天已经完成 ${done} 件小事`
    : "慢慢来，一件一件完成。";
  $("progress-label").textContent = daily.length
    ? `${done} / ${daily.length}`
    : "a fresh start";
  $("progress-bar").style.width =
    `${daily.length ? (done / daily.length) * 100 : 0}%`;
  $("pin").setAttribute("aria-pressed", String(settings.pinned));
  document.querySelectorAll("[data-tab]").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === activeTab);
    b.setAttribute(
      "aria-current",
      b.dataset.tab === activeTab ? "page" : "false",
    );
  });
  if (filter !== "all" && !state.categories.some((c) => c.id === filter))
    filter = "all";
  fillSelect("category-filter", filter, true);
  const quickCategory = $("quick-category").value;
  fillSelect(
    "quick-category",
    state.categories.some((c) => c.id === quickCategory) ? quickCategory : "",
  );
  const templates = activeTab === "templates";
  $("task-list").hidden = templates;
  $("template-list").hidden = !templates;
  $("quick-form").hidden = templates;
  $("new-template").hidden = !templates;
  $("list-label").textContent = {
    todo: "留一点空间给重要的事",
    doing: "专注眼前的这一件",
    done: "每一步，都算数",
    templates: "熟悉的小事，一键加入",
  }[activeTab];
  if (templates) renderTemplates();
  else renderTasks();
}
function renderTasks() {
  const list = state.tasks.filter(
    (t) =>
      t.status === activeTab && (filter === "all" || t.categoryId === filter),
  );
  list.sort((a, b) =>
    activeTab === "done"
      ? b.completedAt.localeCompare(a.completedAt)
      : (a.date || "9999").localeCompare(b.date || "9999") ||
        (a.time.start || "99").localeCompare(b.time.start || "99") ||
        b.createdAt.localeCompare(a.createdAt),
  );
  $("task-list").innerHTML = list.length
    ? list
        .map((t) => {
          const schedule = scheduleLabel(t),
            category = categoryTag(t.categoryId);
          const action = {
            todo: "开始进行",
            doing: "标记完成",
            done: "移回待办",
          }[t.status];
          return `<article class="task-card ${t.status === "done" ? "completed" : ""}" data-task-id="${esc(t.id)}"><button class="status-button ${t.status}" data-action="advance" title="${action}" aria-label="${action}：${esc(t.title)}">${t.status === "todo" ? "" : svg(t.status === "doing" ? "play" : "check")}</button><div class="task-body" role="button" tabindex="0" data-action="edit" aria-label="编辑：${esc(t.title)}"><div class="task-title">${esc(t.title)}</div><div class="task-meta">${category}${category && schedule ? '<span class="meta-divider"></span>' : ""}${schedule ? `<span class="task-schedule">${svg("clock")}${esc(schedule)}</span>` : ""}${!category && !schedule ? "<span>随时开始，一点一点来</span>" : ""}</div></div><button class="task-delete" data-action="delete" title="删除事项" aria-label="删除：${esc(t.title)}">${svg("close")}</button></article>`;
        })
        .join("")
    : `<div class="empty"><div class="empty-illustration">${svg(activeTab === "done" ? "check" : "leaf")}</div><strong>${filter !== "all" ? "这个分类还没有事项" : { todo: "给今天留一点期待", doing: "一次专注一件事", done: "小小的完成，也值得记录" }[activeTab]}</strong><p>${filter !== "all" ? "切换分类，或者记下一件新事项。" : { todo: "在下面记下第一件小事。<br>不用一次安排好所有事情。", doing: "点击待办左侧的小方框，就可以开始。", done: "完成的事项会留在这里。<br>今天，也可以慢慢来。" }[activeTab]}</p></div>`;
}
function renderTemplates() {
  const list = state.templates.filter(
    (t) => filter === "all" || t.categoryId === filter,
  );
  $("template-list").innerHTML = list.length
    ? list
        .map(
          (t) =>
            `<article class="template-card" data-template-id="${esc(t.id)}"><button class="template-add" data-action="use-template" aria-label="使用模板：${esc(t.title)}"><span class="template-symbol">${svg("plus")}</span><div class="template-title">${esc(t.title)}</div><div class="template-meta">${categoryTag(t.categoryId)}${t.durationMinutes ? `<span>${esc(D.formatDuration(t.durationMinutes))}</span>` : ""}</div></button><button class="template-delete icon-button" data-action="delete-template" aria-label="删除模板：${esc(t.title)}">${svg("close")}</button></article>`,
        )
        .join("")
    : '<div class="empty" style="grid-column:1/-1"><strong>把常做的事，留在这里</strong><p>创建一个模板，下次就能快速加入。</p></div>';
}
function currentTimeMode() {
  return document.querySelector('input[name="time-mode"]:checked').value;
}
function readTime() {
  const mode = currentTimeMode();
  return D.normalizeTime(
    mode === "range"
      ? { mode, start: $("time-start").value, end: $("time-end").value }
      : mode === "duration"
        ? {
            mode,
            durationMinutes:
              Number($("time-hours").value) * 60 +
              Number($("time-minutes").value),
          }
        : { mode },
  );
}
function updateTime() {
  const mode = currentTimeMode();
  $("range-fields").hidden = mode !== "range";
  $("calculate-end").hidden = mode !== "range";
  $("duration-fields").hidden = mode !== "duration";
  for (const id of ["time-start", "time-end"])
    $(id).disabled = mode !== "range";
  for (const id of ["time-hours", "time-minutes"])
    $(id).disabled = mode !== "duration";
  try {
    const time = readTime();
    $("time-preview").textContent =
      time.mode === "none"
        ? "留白也很好，随时可以再安排。"
        : time.mode === "duration"
          ? `预计用时 ${D.formatDuration(time.durationMinutes)}`
          : `${time.start} → ${time.overnight ? "次日 " : ""}${time.end} · ${D.formatDuration(time.durationMinutes)}`;
    $("time-preview").classList.remove("invalid");
  } catch (error) {
    $("time-preview").textContent = error.message;
    $("time-preview").classList.add("invalid");
  }
}
function openTask(values = {}, isEdit = false) {
  clearTimeout(closeTimer);
  editingId = isEdit ? values.id : null;
  $("task-form").reset();
  $("task-error").textContent = "";
  $("task-dialog-title").textContent = isEdit ? "编辑事项" : "添加事项";
  $("task-title").value = values.title || "";
  $("task-status").value =
    values.status || (D.statuses.includes(activeTab) ? activeTab : "todo");
  fillSelect("task-category", values.categoryId ?? $("quick-category").value);
  $("task-date").value = values.date || "";
  const time = values.time || { mode: "none" };
  document.querySelector(
    `input[name="time-mode"][value="${time.mode}"]`,
  ).checked = true;
  if (time.mode === "range") {
    $("time-start").value = time.start;
    $("time-end").value = time.end;
  }
  if (time.mode === "duration") {
    $("time-hours").value = Math.floor(time.durationMinutes / 60);
    $("time-minutes").value = time.durationMinutes % 60;
  }
  $("calculate-fields").hidden = true;
  updateSaveLabel();
  updateTime();
  $("task-dialog").showModal();
  $("task-title").focus();
}
function updateSaveLabel() {
  $("save-task").textContent = editingId
    ? "保存修改"
    : `添加到 ${{ todo: "To-do", doing: "Doing", done: "Done" }[$("task-status").value]}`;
}
async function quickAdd(event) {
  event.preventDefault();
  const title = $("quick-title").value.trim();
  if (!title) return;
  const next = clone(state);
  next.tasks.push(
    D.makeTask({
      title,
      categoryId: $("quick-category").value,
      status: activeTab,
    }),
  );
  if (await commit(next, "记下了，慢慢来。", true)) {
    $("quick-title").value = "";
    $("quick-title").focus();
  }
}
async function taskAction(event) {
  const action = event.target.closest("[data-action]");
  if (!action) return;
  const item = state.tasks.find(
    (t) => t.id === action.closest("[data-task-id]").dataset.taskId,
  );
  if (!item) return;
  if (action.dataset.action === "edit") return openTask(item, true);
  const next = clone(state),
    target = next.tasks.find((t) => t.id === item.id);
  if (action.dataset.action === "delete") {
    next.tasks = next.tasks.filter((t) => t.id !== item.id);
    await commit(next, "事项已删除", true);
  } else {
    target.status = { todo: "doing", doing: "done", done: "todo" }[
      target.status
    ];
    target.completedAt =
      target.status === "done" ? new Date().toISOString() : null;
    await commit(
      next,
      {
        todo: "已移回 To-do",
        doing: "已开始，加油。",
        done: "又完成了一件小事。",
      }[target.status],
      true,
    );
  }
}
function renderCategories() {
  $("category-manager").innerHTML = state.categories
    .map(
      (c) =>
        `<div class="category-edit-row" data-category-id="${esc(c.id)}"><input type="color" data-field="color" value="${c.color}" aria-label="${esc(c.name)}的颜色"><input type="text" data-field="name" value="${esc(c.name)}" maxlength="30" aria-label="分类名称"><button class="icon-button" data-remove-category="${esc(c.id)}" aria-label="删除分类 ${esc(c.name)}" title="删除分类，事项保留为未分类">${svg("close")}</button></div>`,
    )
    .join("");
}
function openSettings() {
  $("text-color").value = state.settings.textColor;
  $("opacity").value = state.settings.opacity;
  $("opacity-value").textContent = state.settings.opacity + "%";
  renderCategories();
  $("settings-dialog").showModal();
}
function scheduleClose() {
  clearTimeout(hoverTimer);
  clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    if (
      !anyDialog() &&
      !state.settings.pinned &&
      !(
        document.hasFocus() &&
        document.activeElement?.matches("input,select,textarea")
      ) &&
      !$("widget").matches(":hover")
    )
      window.desktop.collapse();
  }, 750);
}
async function initialize() {
  const loaded = await window.desktop.load();
  state = loaded.state;
  render();
  if (loaded.notice) toast(loaded.notice);
  window.desktop.onWindow((value) => {
    windowExpanded = value.expanded;
    $("panel").hidden = !value.expanded;
    $("orb-caption").hidden = !value.expanded;
    if (state.settings.pinned !== value.pinned) {
      const next = clone(state);
      next.settings.pinned = value.pinned;
      commit(next);
    }
    if (value.focusInput) {
      activeTab = "todo";
      render();
      $("quick-title").focus();
    }
  });
  // The native process can finish opening before the renderer's initial data read.
  if (window.innerWidth > 100) {
    windowExpanded = true;
    $("panel").hidden = false;
    $("orb-caption").hidden = false;
  }
  $("quick-form").addEventListener("submit", quickAdd);
  $("date-toggle").onclick = () => {
    const next = clone(state);
    next.settings.dateLanguage =
      state.settings.dateLanguage === "en" ? "zh" : "en";
    commit(next);
  };
  document.querySelectorAll("[data-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        activeTab = b.dataset.tab;
        render();
      }),
  );
  $("category-filter").onchange = (event) => {
    filter = event.target.value;
    render();
  };
  $("task-list").onclick = taskAction;
  $("task-list").onkeydown = (event) => {
    if (
      (event.key === "Enter" || event.key === " ") &&
      event.target.matches(".task-body")
    ) {
      event.preventDefault();
      event.target.click();
    }
  };
  $("schedule-button").onclick = () =>
    openTask({
      title: $("quick-title").value,
      categoryId: $("quick-category").value,
    });
  $("task-status").onchange = updateSaveLabel;
  document
    .querySelectorAll('input[name="time-mode"]')
    .forEach((el) => (el.onchange = updateTime));
  for (const id of ["time-start", "time-end", "time-hours", "time-minutes"])
    $(id).oninput = updateTime;
  document.querySelectorAll("[data-duration]").forEach(
    (b) =>
      (b.onclick = () => {
        $("time-hours").value = Math.floor(Number(b.dataset.duration) / 60);
        $("time-minutes").value = Number(b.dataset.duration) % 60;
        updateTime();
      }),
  );
  $("calculate-toggle").onclick = () => {
    $("calculate-fields").hidden = !$("calculate-fields").hidden;
  };
  $("apply-duration").onclick = () => {
    const duration =
      Number($("calc-hours").value) * 60 + Number($("calc-minutes").value);
    if (
      !Number.isInteger(duration) ||
      duration < 1 ||
      duration >= 1440 ||
      !$("time-start").value
    ) {
      toast("请填写开始时间和小于 24 小时的有效时长");
      return;
    }
    const [h, m] = $("time-start").value.split(":").map(Number),
      end = (h * 60 + m + duration) % 1440;
    $("time-end").value =
      `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
    updateTime();
  };
  $("today-button").onclick = () => {
    $("task-date").value = D.localDate();
  };
  $("clear-date").onclick = () => {
    $("task-date").value = "";
  };
  $("task-form").onsubmit = async (event) => {
    event.preventDefault();
    $("task-error").textContent = "";
    try {
      const status = $("task-status").value;
      const values = {
        title: $("task-title").value,
        status,
        categoryId: $("task-category").value,
        date: $("task-date").value,
        time: readTime(),
      };
      const next = clone(state);
      if (editingId) {
        const task = next.tasks.find((t) => t.id === editingId);
        Object.assign(task, values, {
          completedAt:
            status === "done"
              ? task.completedAt || new Date().toISOString()
              : null,
        });
      } else next.tasks.push(D.makeTask(values));
      if (
        await commit(
          next,
          editingId
            ? "修改已保存"
            : "已添加到 " +
                { todo: "To-do", doing: "Doing", done: "Done" }[status],
          true,
        )
      ) {
        $("task-dialog").close();
        if (!editingId) $("quick-title").value = "";
      }
    } catch (error) {
      $("task-error").textContent = error.message;
    }
  };
  $("settings-button").onclick = openSettings;
  $("text-color").onchange = async (event) => {
    const next = clone(state);
    next.settings.textColor = event.target.value;
    await commit(next);
  };
  $("opacity").oninput = (event) => {
    $("opacity-value").textContent = event.target.value + "%";
    document.documentElement.style.setProperty(
      "--opacity",
      event.target.value / 100,
    );
  };
  $("opacity").onchange = (event) => {
    const next = clone(state);
    next.settings.opacity = Number(event.target.value);
    commit(next);
  };
  $("category-form").onsubmit = async (event) => {
    event.preventDefault();
    const name = $("category-name").value.trim();
    if (!name) return;
    if (
      state.categories.some(
        (c) => c.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    )
      return toast("已经有这个分类了");
    const next = clone(state);
    next.categories.push({
      id: D.uid(),
      name,
      color: $("category-color").value,
    });
    if (await commit(next, "分类已添加")) {
      $("category-name").value = "";
      renderCategories();
    }
  };
  $("category-manager").onchange = async (event) => {
    if (!event.target.dataset.field) return;
    const next = clone(state),
      category = next.categories.find(
        (c) =>
          c.id ===
          event.target.closest("[data-category-id]").dataset.categoryId,
      );
    if (!event.target.value.trim()) {
      renderCategories();
      return toast("分类名称不能为空");
    }
    if (
      event.target.dataset.field === "name" &&
      next.categories.some(
        (c) =>
          c.id !== category.id &&
          c.name.toLocaleLowerCase() ===
            event.target.value.trim().toLocaleLowerCase(),
      )
    ) {
      renderCategories();
      return toast("已经有这个分类了");
    }
    category[event.target.dataset.field] = event.target.value.trim();
    await commit(next);
  };
  $("category-manager").onclick = async (event) => {
    const button = event.target.closest("[data-remove-category]");
    if (!button) return;
    const next = clone(state),
      id = button.dataset.removeCategory;
    next.categories = next.categories.filter((c) => c.id !== id);
    [...next.tasks, ...next.templates].forEach((t) => {
      if (t.categoryId === id) t.categoryId = "";
    });
    if (await commit(next, "分类已删除，事项和模板已保留", true))
      renderCategories();
  };
  $("export-data").onclick = async () => {
    try {
      if (await window.desktop.exportData()) toast("备份已导出");
    } catch (e) {
      toast("导出失败：" + e.message);
    }
  };
  $("import-data").onclick = async () => {
    try {
      const imported = await window.desktop.importData();
      if (imported) {
        state = imported;
        render();
        renderCategories();
        $("text-color").value = state.settings.textColor;
        $("opacity").value = state.settings.opacity;
        $("opacity-value").textContent = state.settings.opacity + "%";
        lastUndo = null;
        toast("备份已导入");
      }
    } catch (e) {
      toast("导入失败：" + e.message);
    }
  };
  $("new-template").onclick = () => {
    $("template-form").reset();
    $("template-error").textContent = "";
    fillSelect("template-category", filter === "all" ? "" : filter);
    $("template-dialog").showModal();
  };
  $("template-form").onsubmit = async (event) => {
    event.preventDefault();
    try {
      const title = $("template-title").value.trim();
      if (!title) return;
      const next = clone(state);
      next.templates.push({
        id: D.uid(),
        title,
        categoryId: $("template-category").value,
        durationMinutes: $("template-duration").value
          ? Number($("template-duration").value)
          : 0,
      });
      if (await commit(next, "模板已保存", true)) $("template-dialog").close();
    } catch (e) {
      $("template-error").textContent = e.message;
    }
  };
  $("template-list").onclick = async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const template = state.templates.find(
      (t) => t.id === button.closest("[data-template-id]").dataset.templateId,
    );
    if (button.dataset.action === "use-template")
      openTask({
        title: template.title,
        categoryId: template.categoryId,
        time: template.durationMinutes
          ? { mode: "duration", durationMinutes: template.durationMinutes }
          : { mode: "none" },
      });
    else {
      const next = clone(state);
      next.templates = next.templates.filter((t) => t.id !== template.id);
      await commit(next, "模板已删除", true);
    }
  };
  $("undo").onclick = async () => {
    if (!lastUndo) return;
    const before = lastUndo;
    if (await commit(before, "已撤销")) {
      renderCategories();
      window.desktop.pin(state.settings.pinned);
    }
  };
  $("dismiss-toast").onclick = () => {
    $("toast").hidden = true;
    lastUndo = null;
  };
  $("pin").onclick = () => window.desktop.pin(!state.settings.pinned);
  $("collapse").onclick = async () => {
    if (anyDialog()) return;
    if (state.settings.pinned) {
      const next = clone(state);
      next.settings.pinned = false;
      if (!(await commit(next))) return;
      window.desktop.pin(false);
    }
    document.activeElement?.blur();
    window.desktop.collapse();
  };
  document
    .querySelectorAll(".dialog-close")
    .forEach((b) => (b.onclick = () => b.closest("dialog").close()));
  dialogs.forEach((d) => d.addEventListener("close", scheduleClose));
  $("widget").addEventListener("mouseenter", () => clearTimeout(closeTimer));
  $("widget").addEventListener("mouseleave", scheduleClose);
  document.addEventListener("focusout", scheduleClose);
  window.addEventListener("blur", scheduleClose);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !anyDialog()) {
      document.activeElement?.blur();
      window.desktop.collapse();
    }
  });
  let pointer = null,
    moved = false,
    suppressClick = false;
  $("orb").onmouseenter = () => {
    if (!pointer) hoverTimer = setTimeout(() => window.desktop.expand(), 300);
  };
  $("orb").onmouseleave = () => clearTimeout(hoverTimer);
  $("orb").onpointerdown = (event) => {
    if (event.button !== 0) return;
    clearTimeout(hoverTimer);
    pointer = { x: event.screenX, y: event.screenY };
    moved = false;
    $("orb").setPointerCapture(event.pointerId);
  };
  $("orb").onpointermove = (event) => {
    if (
      pointer &&
      !moved &&
      Math.hypot(event.screenX - pointer.x, event.screenY - pointer.y) > 5
    ) {
      moved = true;
      window.desktop.drag("start");
    }
  };
  function endDrag() {
    if (moved) {
      window.desktop.drag("end");
      suppressClick = true;
      setTimeout(() => {
        suppressClick = false;
      }, 100);
    }
    pointer = null;
    moved = false;
  }
  $("orb").onpointerup = endDrag;
  $("orb").onpointercancel = endDrag;
  $("orb").onlostpointercapture = () => {
    if (pointer) endDrag();
  };
  $("orb").onclick = () => {
    if (!suppressClick) {
      window.desktop.expand();
    }
  };
  $("orb").oncontextmenu = (event) => {
    event.preventDefault();
    window.desktop.menu();
  };
  setInterval(() => {
    if (windowExpanded) renderDate();
  }, 30000);
}
initialize().catch((error) => {
  $("panel").hidden = false;
  $("task-list").innerHTML =
    '<div class="empty"><strong>暂时无法读取数据</strong><p>请重新启动 Pebble。原数据会保留。</p></div>';
  toast(error.message);
});

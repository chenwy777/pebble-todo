"use strict";
const D = window.Pebble,
  I = window.PebbleI18n;
const $ = (id) => document.getElementById(id);
const icons = {
  pin: '<path d="M8 3h8l-1 6 3 3H6l3-3-1-6ZM12 12v8"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 3-1 2 3 3-1 1-3 3-1 1-3-3-2 1-3-3-2-3 1-3-1Z"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  play: '<path d="m9 6 8 6-8 6V6Z"/>',
};
const svg = (name) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.plus}</svg>`;
document
  .querySelectorAll("[data-icon]")
  .forEach((el) => (el.innerHTML = svg(el.dataset.icon)));
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const clone = (value) => structuredClone(value);
let state,
  activeTab = "todo",
  filter = "all",
  busy = false,
  lastUndo,
  toastTimer,
  hoverTimer,
  closeTimer,
  editingId = null,
  expanded = false,
  categoryReturn = "quick-category";
const language = () => state?.settings.language || "en";
const t = (key, values) => I.t(language(), key, values);
const errorText = (error) => I.error(language(), error.message || error);
const duration = (minutes) => D.formatDuration(minutes, language());
const categoryName = (category) => I.categoryName(language(), category);
const templateName = (template) =>
  template.builtinKey ? t(template.builtinKey) : template.title;
const dialogs = [...document.querySelectorAll("dialog")];
const anyDialog = () => dialogs.some((d) => d.open);
const collapsedGroups = new Set();

function translateStatic() {
  document.documentElement.lang = language() === "zh" ? "zh-CN" : "en";
  document
    .querySelectorAll("[data-t]")
    .forEach((el) => (el.textContent = t(el.dataset.t)));
  document.querySelectorAll("[data-title]").forEach((el) => {
    el.title = t(el.dataset.title);
    el.setAttribute("aria-label", el.title);
  });
  document
    .querySelectorAll("[data-placeholder]")
    .forEach((el) => (el.placeholder = t(el.dataset.placeholder)));
  document
    .querySelectorAll("[data-label]")
    .forEach((el) => el.setAttribute("aria-label", t(el.dataset.label)));
  document
    .querySelectorAll("[data-duration]")
    .forEach((el) => (el.textContent = duration(Number(el.dataset.duration))));
  $("language-toggle").textContent = language() === "en" ? "中文" : "EN";
  $("ui-language").value = language();
  $("task-list").setAttribute("aria-label", t("Tasks"));
  $("template-list").setAttribute("aria-label", t("Templates"));
  $("orb").title =
    language() === "en"
      ? "Hover to open · Drag to move · Right-click for menu"
      : "悬停展开 · 拖动移动 · 右键菜单";
  $("orb").setAttribute("aria-label", t("Open") + " Pebble");
}
function toast(message, before) {
  clearTimeout(toastTimer);
  lastUndo = before || null;
  $("toast-message").textContent = message;
  $("undo").hidden = !lastUndo;
  $("toast").hidden = false;
  toastTimer = setTimeout(
    () => {
      $("toast").hidden = true;
      lastUndo = null;
    },
    before ? 9000 : 5000,
  );
}
async function commit(next, message, undoable = false) {
  if (busy) {
    toast(t("Saving. Please wait."));
    return false;
  }
  const before = clone(state);
  busy = true;
  document.body.classList.add("save-busy");
  try {
    state = await window.desktop.save(next);
    render();
    if (message) toast(t(message), undoable ? before : null);
    return true;
  } catch (error) {
    toast(`${t("Save failed")}: ${errorText(error)}`);
    return false;
  } finally {
    busy = false;
    document.body.classList.remove("save-busy");
  }
}
function fillSelect(id, selected, all = false) {
  const select = $(id);
  select.innerHTML =
    `<option value="${all ? "all" : ""}">${esc(t(all ? "All categories" : "Uncategorized"))}</option>` +
    state.categories
      .map(
        (c) => `<option value="${esc(c.id)}">${esc(categoryName(c))}</option>`,
      )
      .join("") +
    (!all ? `<option value="__new">${esc(t("+ New category…"))}</option>` : "");
  select.value = selected;
  if (select.selectedIndex < 0) select.value = all ? "all" : "";
}
function categoryTag(id) {
  const c = state.categories.find((c) => c.id === id);
  return c
    ? `<span class="category-tag" style="--category-color:${c.color}"><i></i>${esc(categoryName(c))}</span>`
    : "";
}
function dateLabel(value) {
  const today = D.localDate(),
    tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (value === today) return t("Today");
  if (value === D.localDate(tomorrow)) return t("Tomorrow");
  return new Date(value + "T12:00:00").toLocaleDateString(
    language() === "zh" ? "zh-CN" : "en-US",
    {
      month: "short",
      day: "numeric",
      ...(value.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}),
    },
  );
}
function scheduleLabel(task) {
  const parts = [];
  if (task.date) parts.push(dateLabel(task.date));
  if (task.time.mode === "duration")
    parts.push(
      t("Estimated {duration}", {
        duration: duration(task.time.durationMinutes),
      }),
    );
  if (task.time.mode === "range")
    parts.push(
      `${task.time.start}–${task.time.overnight ? t("next day") + " " : ""}${task.time.end}`,
      duration(task.time.durationMinutes),
    );
  return parts.join(" · ");
}
function renderDate() {
  const date = new Date(),
    locale = state.settings.dateLanguage === "zh" ? "zh-CN" : "en-US";
  $("weekday").textContent = date.toLocaleDateString(locale, {
    weekday: "long",
  });
  $("date").textContent = date.toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
  });
}
function render() {
  translateStatic();
  renderDate();
  document.documentElement.style.setProperty("--ink", state.settings.textColor);
  document.documentElement.style.setProperty(
    "--opacity",
    state.settings.opacity / 100,
  );
  const counts = { todo: 0, doing: 0, done: 0 };
  state.tasks.forEach((task) => counts[task.status]++);
  D.statuses.forEach(
    (status) => ($("count-" + status).textContent = counts[status]),
  );
  $("orb-count").textContent = counts.todo;
  $("orb-count").hidden = counts.todo === 0;
  $("orb-logo").toggleAttribute("hidden", counts.todo > 0);
  $("orb").dataset.digits = String(counts.todo).length;
  $("orb").setAttribute(
    "aria-label",
    counts.todo
      ? t("{n} to-dos. Open Pebble", { n: counts.todo })
      : t("Open") + " Pebble",
  );
  const today = D.localDate(),
    daily = state.tasks.filter(
      (task) =>
        task.date === today ||
        (task.status === "done" &&
          D.localDate(new Date(task.completedAt)) === today),
    );
  const done = daily.filter((task) => task.status === "done").length;
  $("summary").textContent = done
    ? t("{n} completed today", { n: done })
    : t("Today’s progress");
  $("progress-label").textContent = `${done} / ${daily.length}`;
  $("pin").setAttribute("aria-pressed", String(state.settings.pinned));
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("active", activeTab === button.dataset.tab);
    button.setAttribute(
      "aria-current",
      activeTab === button.dataset.tab ? "page" : "false",
    );
  });
  if (filter !== "all" && !state.categories.some((c) => c.id === filter))
    filter = "all";
  fillSelect("category-filter", filter, true);
  ["quick-category", "task-category", "template-category"].forEach((id) =>
    fillSelect(id, $(id).value),
  );
  const templates = activeTab === "templates";
  $("task-list").hidden = templates;
  $("template-list").hidden = !templates;
  $("quick-form").hidden = templates;
  $("new-template").hidden = !templates;
  if (templates) renderTemplates();
  else renderTasks();
  if ($("task-dialog").open) {
    updateSaveLabel();
    updateTime();
  }
}
function renderTasks() {
  const list = state.tasks.filter(
    (task) =>
      task.status === activeTab &&
      (filter === "all" || task.categoryId === filter),
  );
  list.sort((a, b) =>
    activeTab === "done"
      ? b.completedAt.localeCompare(a.completedAt)
      : (a.date || "9999").localeCompare(b.date || "9999") ||
        (a.time.start || "99").localeCompare(b.time.start || "99") ||
        b.createdAt.localeCompare(a.createdAt),
  );
  if (!list.length) {
    $("task-list").innerHTML =
      `<div class="empty"><strong>${esc(t(filter !== "all" ? "No tasks in this category" : { todo: "No to-dos", doing: "Nothing in progress", done: "No completed tasks" }[activeTab]))}</strong><p>${esc(t(filter !== "all" ? "Choose another category or add a task." : { todo: "Add a task below.", doing: "Start a task from To-do.", done: "Completed tasks appear here." }[activeTab]))}</p></div>`;
    return;
  }
  const row = (task) => {
    const schedule = scheduleLabel(task),
      action = {
        todo: "Start task",
        doing: "Mark complete",
        done: "Move to To-do",
      }[task.status];
    return `<article class="task-card ${task.status === "done" ? "completed" : ""}" data-task-id="${esc(task.id)}"><button class="status-button ${task.status}" data-action="advance" title="${esc(t(action))}" aria-label="${esc(t(action) + ": " + task.title)}">${task.status === "todo" ? "" : svg(task.status === "doing" ? "play" : "check")}</button><div class="task-body" role="button" tabindex="0" data-action="edit" aria-label="${esc(t("Edit task") + ": " + task.title)}"><div class="task-title">${esc(task.title)}</div><div class="task-meta">${schedule ? `<span class="task-schedule">${esc(schedule)}</span>` : ""}</div></div><button class="task-delete" data-action="delete" title="${esc(t("Delete task"))}" aria-label="${esc(t("Delete task") + ": " + task.title)}">${svg("close")}</button></article>`;
  };
  const groups = [
    ...state.categories.map((category) => ({
      id: category.id,
      name: categoryName(category),
    })),
    { id: "", name: t("Uncategorized") },
  ];
  $("task-list").innerHTML = groups
    .map((group) => {
      const items = list.filter((task) => task.categoryId === group.id);
      if (!items.length) return "";
      const collapsed = collapsedGroups.has(group.id);
      return `<section class="task-group" data-group="${esc(group.id)}"><h3 class="group-heading"><button data-action="toggle-group" aria-expanded="${!collapsed}"><span class="group-chevron" aria-hidden="true">›</span>${esc(group.name)}</button></h3><div class="task-group-items" ${collapsed ? "hidden" : ""}>${items.map(row).join("")}</div></section>`;
    })
    .join("");
}
function renderTemplates() {
  const list = state.templates.filter(
    (template) => filter === "all" || template.categoryId === filter,
  );
  $("template-list").innerHTML = list.length
    ? list
        .map(
          (template) =>
            `<article class="template-card" data-template-id="${esc(template.id)}"><button class="template-add" data-action="use-template" aria-label="${esc(t("Use template") + ": " + templateName(template))}"><span class="template-symbol">${svg("plus")}</span><div><div class="template-title">${esc(templateName(template))}</div><div class="template-meta">${categoryTag(template.categoryId)}${template.durationMinutes ? `<span>${esc(duration(template.durationMinutes))}</span>` : ""}</div></div></button><button class="template-delete icon-button" data-action="delete-template" aria-label="${esc(t("Delete template") + ": " + templateName(template))}">${svg("close")}</button></article>`,
        )
        .join("")
    : `<div class="empty"><strong>${esc(t("No templates"))}</strong><p>${esc(t("Create a template for tasks you add often."))}</p></div>`;
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
  ["time-start", "time-end"].forEach(
    (id) => ($(id).disabled = mode !== "range"),
  );
  ["time-hours", "time-minutes"].forEach(
    (id) => ($(id).disabled = mode !== "duration"),
  );
  try {
    const time = readTime();
    $("time-preview").textContent =
      time.mode === "none"
        ? t("No time set. You can add it later.")
        : time.mode === "duration"
          ? t("Estimated {duration}", {
              duration: duration(time.durationMinutes),
            })
          : `${time.start} → ${time.overnight ? t("next day") + " " : ""}${time.end} · ${duration(time.durationMinutes)}`;
    $("time-preview").classList.remove("invalid");
  } catch (error) {
    $("time-preview").textContent = errorText(error);
    $("time-preview").classList.add("invalid");
  }
}
function updateSaveLabel() {
  $("save-task").textContent = editingId
    ? t("Save changes")
    : t("Add to {status}", {
        status: t(
          { todo: "To-do", doing: "Doing", done: "Done" }[
            $("task-status").value
          ],
        ),
      });
  $("task-dialog-title").textContent = t(editingId ? "Edit task" : "Add task");
}
function openTask(values = {}, edit = false) {
  clearTimeout(closeTimer);
  editingId = edit ? values.id : null;
  $("task-form").reset();
  $("task-error").textContent = "";
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
function renderCategories() {
  const open = new Set(
    [...$("category-manager").querySelectorAll("details[open]")].map(
      (details) => details.closest("[data-category-id]").dataset.categoryId,
    ),
  );
  $("category-manager").innerHTML = state.categories
    .map(
      (category) =>
        `<div class="category-entry" data-category-id="${esc(category.id)}"><div class="category-edit-row"><input type="color" data-field="color" value="${category.color}" aria-label="${esc(t("Color") + ": " + categoryName(category))}"><input type="text" data-field="name" value="${esc(category.builtinKey ? categoryName(category) : category.name)}" maxlength="30" aria-label="${esc(t("Category name"))}"><button class="icon-button" data-remove-category="${esc(category.id)}" title="${esc(t("Delete category"))}" aria-label="${esc(t("Delete category") + ": " + categoryName(category))}">${svg("close")}</button></div><details class="category-translations"${open.has(category.id) ? " open" : ""}><summary>${esc(t("Translations (optional)"))}</summary><div class="field-pair">${["en", "zh"].map((locale) => `<label><span>${esc(t(locale === "en" ? "English name" : "Chinese name"))}</span><input type="text" data-field="translation" data-language="${locale}" value="${esc(category.translations?.[locale] || "")}" placeholder="${esc(I.categoryName(locale, { ...category, translations: {} }))}" maxlength="30" lang="${locale === "zh" ? "zh-CN" : "en"}"></label>`).join("")}</div></details></div>`,
    )
    .join("");
}
function openCategories(returnTo = "quick-category") {
  categoryReturn = returnTo;
  renderCategories();
  $("category-dialog").showModal();
  $("category-name").focus();
}
function openSettings() {
  $("text-color").value = state.settings.textColor;
  $("opacity").value = state.settings.opacity;
  $("opacity-value").textContent = state.settings.opacity + "%";
  $("ui-language").value = language();
  $("settings-dialog").showModal();
}
async function setLanguage(value) {
  if (value === language()) return;
  const next = clone(state);
  next.settings.language = value;
  next.settings.dateLanguage = value;
  if (await commit(next)) {
    $("toast").hidden = true;
    lastUndo = null;
    if ($("category-dialog").open) renderCategories();
  }
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
function applyWindowState(value) {
  expanded = value.expanded;
  $("widget").classList.toggle("orb-left", value.orbSide === "left");
  const panel = $("panel");
  panel.inert = !expanded;
  if (expanded) {
    const wasHidden = panel.hidden;
    panel.hidden = false;
    if (wasHidden) {
      $("widget").classList.remove("is-expanded");
      void panel.offsetHeight;
    }
    requestAnimationFrame(() => {
      if (expanded) $("widget").classList.add("is-expanded");
    });
  } else {
    $("widget").classList.remove("is-expanded");
    panel.hidden = !value.collapsing;
  }
}
async function initialize() {
  const loaded = await window.desktop.load();
  state = loaded.state;
  render();
  if (loaded.notice) toast(I.error(language(), loaded.notice));
  window.desktop.onWindow((value) => {
    applyWindowState(value);
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
  applyWindowState(await window.desktop.windowState());
  $("language-toggle").onclick = () =>
    setLanguage(language() === "en" ? "zh" : "en");
  $("ui-language").onchange = (event) => setLanguage(event.target.value);
  $("date-toggle").onclick = () => {
    const next = clone(state);
    next.settings.dateLanguage =
      state.settings.dateLanguage === "en" ? "zh" : "en";
    commit(next);
  };
  document.querySelectorAll("[data-tab]").forEach(
    (button) =>
      (button.onclick = () => {
        activeTab = button.dataset.tab;
        render();
      }),
  );
  $("category-filter").onchange = (event) => {
    filter = event.target.value;
    render();
  };
  $("manage-categories").onclick = () => openCategories();
  $("settings-categories").onclick = () => openCategories();
  ["quick-category", "task-category", "template-category"].forEach((id) => {
    $(id).onfocus = () => ($(id).dataset.previous = $(id).value);
    $(id).onchange = () => {
      if ($(id).value === "__new") {
        $(id).value = $(id).dataset.previous || "";
        openCategories(id);
      } else $(id).dataset.previous = $(id).value;
    };
  });
  $("quick-form").onsubmit = async (event) => {
    event.preventDefault();
    const title = $("quick-title").value.trim();
    if (!title) return;
    try {
      const next = clone(state);
      next.tasks.push(
        D.makeTask({
          title,
          categoryId: $("quick-category").value,
          status: activeTab,
        }),
      );
      if (await commit(next, "Task added", true)) {
        $("quick-title").value = "";
        $("quick-title").focus();
      }
    } catch (error) {
      toast(errorText(error));
    }
  };
  $("task-list").onclick = async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    if (button.dataset.action === "toggle-group") {
      const key = button.closest("[data-group]").dataset.group;
      if (collapsedGroups.has(key)) collapsedGroups.delete(key);
      else collapsedGroups.add(key);
      button.setAttribute("aria-expanded", String(!collapsedGroups.has(key)));
      button.closest("[data-group]").querySelector(".task-group-items").hidden =
        collapsedGroups.has(key);
      return;
    }
    const task = state.tasks.find(
      (task) => task.id === button.closest("[data-task-id]").dataset.taskId,
    );
    if (!task) return;
    if (button.dataset.action === "edit") return openTask(task, true);
    const next = clone(state),
      target = next.tasks.find((item) => item.id === task.id);
    if (button.dataset.action === "delete") {
      next.tasks = next.tasks.filter((item) => item.id !== task.id);
      await commit(next, "Task deleted", true);
    } else {
      target.status = { todo: "doing", doing: "done", done: "todo" }[
        target.status
      ];
      target.completedAt =
        target.status === "done" ? new Date().toISOString() : null;
      await commit(
        next,
        {
          todo: "Moved to To-do",
          doing: "Moved to Doing",
          done: "Marked complete",
        }[target.status],
        true,
      );
    }
  };
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
    .forEach((input) => (input.onchange = updateTime));
  ["time-start", "time-end", "time-hours", "time-minutes"].forEach(
    (id) => ($(id).oninput = updateTime),
  );
  document.querySelectorAll("[data-duration]").forEach(
    (button) =>
      (button.onclick = () => {
        $("time-hours").value = Math.floor(
          Number(button.dataset.duration) / 60,
        );
        $("time-minutes").value = Number(button.dataset.duration) % 60;
        updateTime();
      }),
  );
  $("calculate-toggle").onclick = () =>
    ($("calculate-fields").hidden = !$("calculate-fields").hidden);
  $("apply-duration").onclick = () => {
    const value =
      Number($("calc-hours").value) * 60 + Number($("calc-minutes").value);
    if (
      !Number.isInteger(value) ||
      value < 1 ||
      value >= 1440 ||
      !$("time-start").value
    )
      return toast(t("Enter a start time and a duration under 24 hours."));
    const [h, m] = $("time-start").value.split(":").map(Number),
      end = (h * 60 + m + value) % 1440;
    $("time-end").value =
      `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
    updateTime();
  };
  $("today-button").onclick = () => ($("task-date").value = D.localDate());
  $("clear-date").onclick = () => ($("task-date").value = "");
  $("task-form").onsubmit = async (event) => {
    event.preventDefault();
    $("task-error").textContent = "";
    try {
      const status = $("task-status").value,
        values = {
          title: $("task-title").value.trim(),
          status,
          categoryId: $("task-category").value,
          date: $("task-date").value,
          time: readTime(),
        },
        next = clone(state);
      if (editingId) {
        const task = next.tasks.find((task) => task.id === editingId);
        Object.assign(task, values, {
          completedAt:
            status === "done"
              ? task.completedAt || new Date().toISOString()
              : null,
        });
      } else next.tasks.push(D.makeTask(values));
      if (
        await commit(next, editingId ? "Changes saved" : "Task added", true)
      ) {
        $("task-dialog").close();
        if (!editingId) $("quick-title").value = "";
      }
    } catch (error) {
      $("task-error").textContent = errorText(error);
    }
  };
  $("settings-button").onclick = openSettings;
  $("text-color").onchange = (event) => {
    const next = clone(state);
    next.settings.textColor = event.target.value;
    commit(next);
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
        (c) =>
          categoryName(c).toLocaleLowerCase() === name.toLocaleLowerCase() ||
          c.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    )
      return toast(t("A category with this name already exists."));
    const next = clone(state),
      id = D.uid();
    next.categories.push({
      id,
      name,
      color: $("category-color").value,
      builtinKey: "",
    });
    if (await commit(next, "Category added", true)) {
      $("category-name").value = "";
      renderCategories();
      $(categoryReturn).value = id;
      $(categoryReturn).dataset.previous = id;
    }
  };
  $("category-manager").onchange = async (event) => {
    if (!event.target.dataset.field) return;
    const next = clone(state),
      category = next.categories.find(
        (c) =>
          c.id ===
          event.target.closest("[data-category-id]").dataset.categoryId,
      ),
      name = event.target.value.trim(),
      field = event.target.dataset.field;
    if (!name && field !== "translation") {
      renderCategories();
      return toast(t("Category name cannot be empty."));
    }
    if (
      field === "name" &&
      next.categories.some(
        (c) =>
          c.id !== category.id &&
          (categoryName(c).toLocaleLowerCase() === name.toLocaleLowerCase() ||
            c.name.toLocaleLowerCase() === name.toLocaleLowerCase()),
      )
    ) {
      renderCategories();
      return toast(t("A category with this name already exists."));
    }
    if (field === "translation") {
      const locale = event.target.dataset.language;
      category.translations ||= {};
      if (name) category.translations[locale] = name;
      else delete category.translations[locale];
      if (
        next.categories.some(
          (c) =>
            c.id !== category.id &&
            I.categoryName(locale, c).toLowerCase() ===
              I.categoryName(locale, category).toLowerCase(),
        )
      ) {
        renderCategories();
        return toast(t("A category with this name already exists."));
      }
    } else {
      category[field] = name;
      if (field === "name") category.builtinKey = "";
    }
    await commit(next, "Category updated", true);
  };
  $("category-manager").onclick = async (event) => {
    const button = event.target.closest("[data-remove-category]");
    if (!button) return;
    const next = clone(state),
      id = button.dataset.removeCategory;
    next.categories = next.categories.filter((c) => c.id !== id);
    [...next.tasks, ...next.templates].forEach((item) => {
      if (item.categoryId === id) item.categoryId = "";
    });
    if (await commit(next, "Category deleted. Tasks and templates kept.", true))
      renderCategories();
  };
  $("export-data").onclick = async () => {
    try {
      if (await window.desktop.exportData()) toast(t("Backup exported"));
    } catch (error) {
      toast(`${t("Export failed")}: ${errorText(error)}`);
    }
  };
  $("import-data").onclick = async () => {
    try {
      const imported = await window.desktop.importData();
      if (imported) {
        state = imported;
        render();
        $("text-color").value = state.settings.textColor;
        $("opacity").value = state.settings.opacity;
        $("opacity-value").textContent = state.settings.opacity + "%";
        toast(t("Backup imported"));
      }
    } catch (error) {
      toast(`${t("Import failed")}: ${errorText(error)}`);
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
        builtinKey: "",
      });
      if (await commit(next, "Template saved", true))
        $("template-dialog").close();
    } catch (error) {
      $("template-error").textContent = errorText(error);
    }
  };
  $("template-list").onclick = async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const template = state.templates.find(
      (template) =>
        template.id === button.closest("[data-template-id]").dataset.templateId,
    );
    if (button.dataset.action === "use-template")
      openTask({
        title: templateName(template),
        categoryId: template.categoryId,
        time: template.durationMinutes
          ? { mode: "duration", durationMinutes: template.durationMinutes }
          : { mode: "none" },
      });
    else {
      const next = clone(state);
      next.templates = next.templates.filter((item) => item.id !== template.id);
      await commit(next, "Template deleted", true);
    }
  };
  $("undo").onclick = async () => {
    if (lastUndo && (await commit(lastUndo, "Undone"))) {
      if ($("category-dialog").open) renderCategories();
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
    .forEach(
      (button) => (button.onclick = () => button.closest("dialog").close()),
    );
  dialogs.forEach((dialog) => dialog.addEventListener("close", scheduleClose));
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
      setTimeout(() => (suppressClick = false), 100);
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
    if (!suppressClick) window.desktop.expand();
  };
  $("orb").oncontextmenu = (event) => {
    event.preventDefault();
    window.desktop.menu();
  };
  setInterval(() => {
    if (expanded) renderDate();
  }, 30000);
}
initialize().catch((error) => {
  $("panel").hidden = false;
  $("task-list").innerHTML =
    `<div class="empty"><strong>${esc(t("Unable to load tasks"))}</strong><p>${esc(t("Restart Pebble. Your data has been kept."))}</p></div>`;
  toast(errorText(error));
});

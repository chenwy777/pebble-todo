const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  Menu,
  Tray,
  nativeImage,
  dialog,
  globalShortcut,
} = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { Store } = require("./store.cjs");
const { validateState } = require("../src/domain.js");
const I = require("../src/i18n.js");
const t = (key, values) => I.t(state?.settings.language || "en", key, values);

const testMode = process.argv.includes("--smoke-test");
const dataArg = process.argv.find((arg) => arg.startsWith("--data-dir="));
if (dataArg) app.setPath("userData", dataArg.slice("--data-dir=".length));
app.setName("Pebble");
let win,
  tray,
  store,
  state,
  expanded = false,
  drag = null,
  dragTimer,
  quitting = false;
let anchor,
  width = 448,
  height = 714,
  pinned = false;
const compact = 80;
const clamp = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));
function constrain(pos) {
  const area = screen.getDisplayNearestPoint({
    x: Math.round(pos.x + 40),
    y: Math.round(pos.y + 40),
  }).workArea;
  return {
    x: Math.round(clamp(pos.x, area.x, area.x + area.width - compact)),
    y: Math.round(clamp(pos.y, area.y, area.y + area.height - compact)),
  };
}
function notify() {
  win.webContents.send("window:state", { expanded, pinned });
}
function open() {
  if (!win || win.isDestroyed() || drag) return;
  if (!expanded) {
    anchor = { x: win.getBounds().x, y: win.getBounds().y };
    const area = screen.getDisplayMatching(win.getBounds()).workArea;
    width = Math.min(448, area.width);
    height = Math.min(714, area.height);
    expanded = true;
    win.setBounds({
      x: Math.round(
        clamp(anchor.x + compact - width, area.x, area.x + area.width - width),
      ),
      y: Math.round(
        clamp(
          anchor.y + compact - height,
          area.y,
          area.y + area.height - height,
        ),
      ),
      width,
      height,
    });
  }
  win.showInactive();
  win.setAlwaysOnTop(true, "floating");
  notify();
}
function close(force = false) {
  if (!win || (!force && pinned) || drag || !expanded) return;
  expanded = false;
  win.setBounds({ ...constrain(anchor), width: compact, height: compact });
  win.setAlwaysOnTop(true, "floating");
  notify();
}
function menu() {
  Menu.buildFromTemplate([
    {
      label: t(expanded ? "Collapse" : "Open"),
      click: () => (expanded ? close(true) : open()),
    },
    {
      label: t("Pin open"),
      type: "checkbox",
      checked: pinned,
      click: (item) => {
        pinned = item.checked;
        if (pinned) open();
        else notify();
      },
    },
    { type: "separator" },
    { label: t("Quit Pebble"), click: () => app.quit() },
  ]).popup({ window: win });
}
async function saveState(next) {
  // Window placement belongs to the native process, never an outdated renderer copy.
  const checked = validateState({
    ...next,
    settings: { ...next.settings, position: state.settings.position },
  });
  const saved = await store.save(checked);
  state = saved;
  return saved;
}
function registerIPC() {
  ipcMain.handle("data:load", () => ({
    state,
    notice: store.recoveryNotice || "",
  }));
  ipcMain.handle("data:save", (_, value) => saveState(value));
  ipcMain.handle("data:export", async () => {
    const result = await dialog.showSaveDialog(win, {
      title: t("Export Pebble backup"),
      defaultPath: "pebble-backup.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (result.canceled) return false;
    await store.queue;
    await fs.writeFile(result.filePath, JSON.stringify(state, null, 2), "utf8");
    return true;
  });
  ipcMain.handle("data:import", async () => {
    const result = await dialog.showOpenDialog(win, {
      title: t("Import Pebble backup"),
      properties: ["openFile"],
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (result.canceled) return null;
    const stat = await fs.stat(result.filePaths[0]);
    if (stat.size > 10 * 1024 * 1024)
      throw new Error("Backup files cannot exceed 10 MB.");
    const imported = validateState(
      JSON.parse(await fs.readFile(result.filePaths[0], "utf8")),
    );
    const confirm = await dialog.showMessageBox(win, {
      type: "question",
      message: t("Replace the current list with {n} tasks from this backup?", {
        n: imported.tasks.length,
      }),
      detail: t("The current data will be kept in the local automatic backup."),
      buttons: [t("Cancel"), t("Import")],
      defaultId: 0,
      cancelId: 0,
    });
    if (confirm.response !== 1) return null;
    const saved = await saveState(imported);
    pinned = saved.settings.pinned;
    // Return the new data before any pin event can reach the renderer's old state.
    return saved;
  });
  ipcMain.on("window:expand", open);
  ipcMain.on("window:collapse", () => close());
  ipcMain.on("window:pin", (_, value) => {
    pinned = Boolean(value);
    if (pinned) open();
    else notify();
  });
  ipcMain.on("window:menu", menu);
  ipcMain.on("app:quit", () => app.quit());
  ipcMain.on("window:drag", (_, phase) => {
    if (phase === "start" && !drag) {
      drag = { cursor: screen.getCursorScreenPoint(), bounds: win.getBounds() };
      dragTimer = setInterval(() => {
        const cursor = screen.getCursorScreenPoint();
        win.setPosition(
          Math.round(drag.bounds.x + cursor.x - drag.cursor.x),
          Math.round(drag.bounds.y + cursor.y - drag.cursor.y),
        );
      }, 16);
    } else if (phase === "end" && drag) {
      clearInterval(dragTimer);
      drag = null;
      const bounds = win.getBounds();
      const pos = constrain({
        x: bounds.x + bounds.width - compact,
        y: bounds.y + bounds.height - compact,
      });
      const area = screen.getDisplayNearestPoint(pos).workArea;
      if (pos.x - area.x < 70) pos.x = area.x + 4;
      else if (area.x + area.width - compact - pos.x < 70)
        pos.x = area.x + area.width - compact - 4;
      anchor = pos;
      if (!expanded) win.setPosition(pos.x, pos.y);
      state.settings.position = pos;
      store
        .save(state)
        .catch((error) =>
          dialog.showErrorBox(
            t("Unable to save position"),
            I.error(state.settings.language, error.message),
          ),
        );
    }
  });
}
async function createWindow() {
  store = new Store(app.getPath("userData"));
  state = await store.load();
  pinned = state.settings.pinned;
  const area = screen.getPrimaryDisplay().workArea;
  anchor = constrain(
    state.settings.position || {
      x: area.x + area.width - 104,
      y: area.y + area.height - 120,
    },
  );
  win = new BrowserWindow({
    ...anchor,
    width: compact,
    height: compact,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  registerIPC();
  await win.loadFile(path.join(__dirname, "../src/index.html"));
  win.showInactive();
  win.setAlwaysOnTop(true, "floating");
  if (pinned || testMode || process.argv.includes("--open")) open();
  win.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      close(true);
    }
  });
  if (process.platform === "darwin") {
    app.dock.hide();
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  const icon = nativeImage.createFromPath(
    path.join(__dirname, "../assets/tray.png"),
  );
  if (!icon.isEmpty()) {
    icon.setTemplateImage(true);
    tray = new Tray(icon);
    tray.setToolTip("Pebble");
    tray.on("click", () => {
      open();
      win.focus();
    });
    tray.on("right-click", menu);
  }
  globalShortcut.register("CommandOrControl+Shift+Space", () => {
    open();
    win.focus();
    win.webContents.send("window:state", {
      expanded,
      pinned,
      focusInput: true,
    });
  });
  screen.on("display-metrics-changed", () => {
    close(true);
    anchor = constrain(anchor);
    win.setBounds({ ...anchor, width: compact, height: compact });
  });
}
const lock = testMode || app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
  app.on("second-instance", () => {
    open();
    win?.focus();
  });
  app
    .whenReady()
    .then(createWindow)
    .catch((error) => {
      dialog.showErrorBox(
        t("Unable to start Pebble"),
        I.error(state?.settings.language || "en", error.message),
      );
      app.exit(1);
    });
}
app.on("before-quit", (event) => {
  if (!quitting && store) {
    event.preventDefault();
    quitting = true;
    clearInterval(dragTimer);
    globalShortcut.unregisterAll();
    store.queue.finally(() => app.quit());
  }
});
app.on("window-all-closed", () => app.quit());

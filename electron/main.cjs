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
  clipboard,
  systemPreferences,
} = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { Store } = require("./store.cjs");
const { validateState } = require("../src/domain.js");
const I = require("../src/i18n.js");
const { TaskService } = require("./task-service.cjs");
const { startBridge } = require("./ai-bridge.cjs");
const { configurations } = require("./ai-config.cjs");
const { installSkill } = require("./skill-install.cjs");
const { Voice } = require("./voice.cjs");
const {
  COMPACT,
  COLLAPSE_MS,
  placeExpanded,
  bubbleAnchor,
} = require("./layout.cjs");
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
  quitting = false,
  collapsing = false,
  collapseTimer,
  orbSide = "right",
  taskService,
  aiBridge,
  voice,
  voicePermission = false,
  voiceRequest = 0,
  bridgeQueue = Promise.resolve();
let anchor,
  width = 448,
  height = 714,
  pinned = false;
const compact = COMPACT;
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
function notify(extra = {}) {
  win.webContents.send("window:state", {
    expanded,
    collapsing,
    pinned,
    orbSide,
    ...extra,
  });
}
function updateState(change, options) {
  return taskService.update(change, options);
}
function syncBridge() {
  bridgeQueue = bridgeQueue
    .catch(() => {})
    .then(async () => {
      if (state.settings.aiEnabled && !aiBridge)
        aiBridge = await startBridge(app.getPath("userData"), (method, args) =>
          taskService.execute(method, args),
        );
      else if (!state.settings.aiEnabled && aiBridge) {
        const previous = aiBridge;
        aiBridge = null;
        await previous.close();
      }
    });
  return bridgeQueue;
}
function persistAnchor() {
  const position = { ...anchor };
  updateState(
    (current) => ({
      ...current,
      settings: { ...current.settings, position },
    }),
    { bump: false },
  ).catch((error) =>
    dialog.showErrorBox(
      t("Unable to save position"),
      I.error(state.settings.language, error.message),
    ),
  );
}
function open() {
  if (!win || win.isDestroyed() || drag) return;
  const hadRoom = expanded || collapsing;
  clearTimeout(collapseTimer);
  collapsing = false;
  if (!hadRoom) {
    const current = win.getBounds();
    const area = screen.getDisplayMatching(current).workArea;
    const placement = placeExpanded({ x: current.x, y: current.y }, area);
    anchor = placement.anchor;
    orbSide = placement.side;
    width = placement.bounds.width;
    height = placement.bounds.height;
    win.setBounds(placement.bounds);
    persistAnchor();
  }
  expanded = true;
  win.showInactive();
  win.setAlwaysOnTop(true, "floating");
  notify();
}
function finishCollapse() {
  clearTimeout(collapseTimer);
  expanded = false;
  collapsing = false;
  if (!win || win.isDestroyed()) return;
  anchor = constrain(anchor);
  win.setBounds({ ...anchor, width: compact, height: compact });
  win.setAlwaysOnTop(true, "floating");
  notify();
}
function close(force = false, instant = false) {
  if (!win || (!force && pinned) || drag || (!expanded && !collapsing)) return;
  if (instant) return finishCollapse();
  if (collapsing) return;
  expanded = false;
  collapsing = true;
  notify();
  collapseTimer = setTimeout(finishCollapse, COLLAPSE_MS);
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
async function saveState(next, replace = false) {
  const saved = await taskService.save(next, replace);
  await syncBridge();
  return saved;
}
function registerIPC() {
  voice = new Voice(app.getPath("userData"), (progress) => {
    if (!win.isDestroyed()) win.webContents.send("voice:progress", progress);
  });
  const ownVoiceFrame = (event) => {
    if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame)
      throw new Error("Invalid voice request.");
  };
  ipcMain.handle("voice:prepare", async (event) => {
    ownVoiceFrame(event);
    const request = ++voiceRequest;
    await voice.call("prepare");
    if (request !== voiceRequest) throw new Error("Voice operation cancelled.");
    if (process.platform === "darwin" && !(await systemPreferences.askForMediaAccess("microphone")))
      throw new Error("Microphone access denied. Allow Pebble in system privacy settings.");
    if (request !== voiceRequest) throw new Error("Voice operation cancelled.");
    voicePermission = true;
    return true;
  });
  ipcMain.handle("voice:transcribe", (event, audio, language) => {
    ownVoiceFrame(event);
    if (!voicePermission || !["zh", "en"].includes(language)) throw new Error("Voice model is not ready.");
    return voice.call("transcribe", { audio, language });
  });
  ipcMain.handle("voice:cancel", (event) => {
    ownVoiceFrame(event);
    voiceRequest++;
    voicePermission = false;
    voice.cancel();
  });
  ipcMain.handle("window:get-state", () => ({
    expanded,
    collapsing,
    pinned,
    orbSide,
  }));
  ipcMain.handle("data:load", () => ({
    state,
    notice: store.recoveryNotice || "",
  }));
  ipcMain.handle("data:save", (_, value) => saveState(value));
  ipcMain.handle("ai:install-skill", async (event, client) => {
    if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) throw new Error("Invalid Skill request.");
    return installSkill(client, { executable: app.getPath("exe"), directory: app.getPath("userData") });
  });
  ipcMain.handle("ai:copy-config", (_, client) => {
    if (!["codex", "claude"].includes(client))
      throw new Error("Unknown AI client.");
    const script = app.isPackaged
      ? path.join(process.resourcesPath, "mcp", "pebble-mcp.cjs")
      : path.join(__dirname, "../mcp/entry.cjs");
    const config = configurations(script, app.getPath("userData"));
    clipboard.writeText(config[client]);
    return true;
  });
  ipcMain.handle("data:export", async () => {
    const result = await dialog.showSaveDialog(win, {
      title: t("Export Pebble backup"),
      defaultPath: "pebble-backup.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (result.canceled) return false;
    await taskService.queue;
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
    const saved = await saveState(imported, true);
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
      if (collapsing) open();
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
      const pos = constrain(bubbleAnchor(bounds, orbSide));
      const area = screen.getDisplayNearestPoint(pos).workArea;
      if (pos.x - area.x < 70) pos.x = area.x + 4;
      else if (area.x + area.width - compact - pos.x < 70)
        pos.x = area.x + area.width - compact - 4;
      if (expanded) {
        const placement = placeExpanded(pos, area);
        anchor = placement.anchor;
        orbSide = placement.side;
        width = placement.bounds.width;
        height = placement.bounds.height;
        win.setBounds(placement.bounds);
        notify();
      } else {
        anchor = pos;
        win.setPosition(pos.x, pos.y);
      }
      persistAnchor();
    }
  });
}
async function createWindow() {
  store = new Store(app.getPath("userData"));
  state = await store.load();
  taskService = new TaskService(store, state, (saved, source) => {
    state = saved;
    if (source === "ai" && win && !win.isDestroyed())
      win.webContents.send("data:changed", saved);
  });
  state = taskService.state;
  if (process.argv.includes("--enable-ai"))
    await updateState((current) => ({
      ...current,
      settings: { ...current.settings, aiEnabled: true },
    }));
  pinned = state.settings.pinned;
  const area = screen.getPrimaryDisplay().workArea;
  anchor = constrain(
    state.settings.position || {
      x: area.x + area.width - 104,
      y: area.y + 36,
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
  win.webContents.session.setPermissionRequestHandler((contents, permission, callback, details) => {
    callback(contents === win.webContents && voicePermission && permission === "media" && details.mediaTypes?.length === 1 && details.mediaTypes[0] === "audio");
  });
  win.webContents.session.setPermissionCheckHandler((contents, permission, origin, details) =>
    contents === win.webContents && voicePermission && permission === "media" && details.mediaType === "audio");
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  registerIPC();
  await win.loadFile(path.join(__dirname, "../src/index.html"));
  await syncBridge();
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
    notify({ focusInput: true });
  });
  screen.on("display-metrics-changed", () => {
    close(true, true);
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
    voice?.cancel();
    clearInterval(dragTimer);
    clearTimeout(collapseTimer);
    globalShortcut.unregisterAll();
    bridgeQueue
      .then(() => aiBridge?.close())
      .then(() => taskService.queue)
      .then(() => store.queue)
      .finally(() => app.quit());
  }
});
app.on("window-all-closed", () => app.quit());

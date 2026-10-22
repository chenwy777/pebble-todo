const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  load: () => ipcRenderer.invoke("data:load"),
  windowState: () => ipcRenderer.invoke("window:get-state"),
  save: (state) => ipcRenderer.invoke("data:save", state),
  exportData: () => ipcRenderer.invoke("data:export"),
  importData: () => ipcRenderer.invoke("data:import"),
  expand: () => ipcRenderer.send("window:expand"),
  collapse: () => ipcRenderer.send("window:collapse"),
  pin: (value) => ipcRenderer.send("window:pin", value),
  drag: (phase) => ipcRenderer.send("window:drag", phase),
  menu: () => ipcRenderer.send("window:menu"),
  quit: () => ipcRenderer.send("app:quit"),
  onWindow: (callback) => {
    const listener = (_, value) => callback(value);
    ipcRenderer.on("window:state", listener);
    return () => ipcRenderer.removeListener("window:state", listener);
  },
});

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("localTaskApi", {
  loadDb: () => ipcRenderer.invoke("db:load"),
  saveDb: (data) => ipcRenderer.invoke("db:save", data),
  getDataPath: () => ipcRenderer.invoke("db:path")
});

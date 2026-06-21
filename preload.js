const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("localTaskApi", {
  loadDb: () => ipcRenderer.invoke("db:load"),
  saveDb: (data) => ipcRenderer.invoke("db:save", data),
  getDataPath: async () => "ローカルJSON保存"
});

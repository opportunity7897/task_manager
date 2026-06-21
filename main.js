const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");

const DEFAULT_DB = {
  settings: {
    theme: "system",
    accent: "#1a73e8",
    density: "comfortable",
    calendarStart: "monday",
    notifications: true
  },
  tasks: []
};

function dataFilePath() {
  if (app.isPackaged) {
    return path.join(path.dirname(process.execPath), "tasks.json");
  }
  return path.join(__dirname, "tasks.json");
}

function ensureDb() {
  const file = dataFilePath();
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(DEFAULT_DB, null, 2), "utf8");
  }

  try {
    const raw = fs.readFileSync(file, "utf8");
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return structuredClone(DEFAULT_DB);
    if (!data.settings || typeof data.settings !== "object") data.settings = structuredClone(DEFAULT_DB.settings);
    if (!Array.isArray(data.tasks)) data.tasks = [];
    return data;
  } catch {
    return structuredClone(DEFAULT_DB);
  }
}

function saveDb(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid database payload.");
  }

  if (!data.settings || typeof data.settings !== "object") {
    data.settings = structuredClone(DEFAULT_DB.settings);
  }
  if (!Array.isArray(data.tasks)) {
    data.tasks = [];
  }

  const file = dataFilePath();
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, file);
  return true;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    title: "Local Task Manager",
    backgroundColor: "#f8fafd",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadFile(path.join(__dirname, "index.html"));

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  ensureDb();

  ipcMain.handle("db:load", () => {
    return ensureDb();
  });

  ipcMain.handle("db:save", (_event, data) => {
    return saveDb(data);
  });

  ipcMain.handle("db:path", () => {
    return dataFilePath();
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

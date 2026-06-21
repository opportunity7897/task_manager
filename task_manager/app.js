const state = {
  db: {
    settings: {
      theme: "system",
      accent: "#1a73e8",
      density: "comfortable",
      calendarStart: "monday",
      notifications: true
    },
    tasks: []
  },
  view: "list",
  calendarDate: new Date(),
  remindedKeys: new Set()
};

const $ = (id) => document.getElementById(id);

const els = {
  dataPathLabel: $("dataPathLabel"),
  listViewButton: $("listViewButton"),
  calendarViewButton: $("calendarViewButton"),
  settingsButton: $("settingsButton"),
  newTaskButton: $("newTaskButton"),
  listView: $("listView"),
  calendarView: $("calendarView"),
  searchInput: $("searchInput"),
  statusFilter: $("statusFilter"),
  urgencyFilter: $("urgencyFilter"),
  taskList: $("taskList"),
  listSummary: $("listSummary"),
  calendarTitle: $("calendarTitle"),
  calendarSummary: $("calendarSummary"),
  calendarGrid: $("calendarGrid"),
  prevMonthButton: $("prevMonthButton"),
  nextMonthButton: $("nextMonthButton"),
  todayButton: $("todayButton"),
  taskDialog: $("taskDialog"),
  taskDialogTitle: $("taskDialogTitle"),
  taskForm: $("taskForm"),
  taskId: $("taskId"),
  titleInput: $("titleInput"),
  detailInput: $("detailInput"),
  startDateInput: $("startDateInput"),
  startTimeInput: $("startTimeInput"),
  endDateInput: $("endDateInput"),
  endTimeInput: $("endTimeInput"),
  remindInput: $("remindInput"),
  urgencyInput: $("urgencyInput"),
  colorInput: $("colorInput"),
  repeatInput: $("repeatInput"),
  intervalInput: $("intervalInput"),
  repeatUntilInput: $("repeatUntilInput"),
  doneInput: $("doneInput"),
  deleteTaskButton: $("deleteTaskButton"),
  settingsDialog: $("settingsDialog"),
  settingsForm: $("settingsForm"),
  themeInput: $("themeInput"),
  accentInput: $("accentInput"),
  densityInput: $("densityInput"),
  calendarStartInput: $("calendarStartInput"),
  notificationsInput: $("notificationsInput"),
  toast: $("toast")
};

function pad(n) {
  return String(n).padStart(2, "0");
}

function toDateInputValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateTime(dateStr, timeStr, fallbackEnd = false) {
  if (!dateStr) return null;
  const time = timeStr || (fallbackEnd ? "23:59" : "00:00");
  return new Date(`${dateStr}T${time}:00`);
}

function dateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== day) d.setDate(0);
  return d;
}

function addYears(date, years) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function formatDateTimeRange(task) {
  const sameDay = task.startDate === task.endDate;
  const startText = task.startTime ? `${task.startDate} ${task.startTime}` : task.startDate;
  const endText = task.endTime ? `${task.endDate} ${task.endTime}` : task.endDate;
  if (sameDay) {
    if (task.startTime || task.endTime) return `${startText} - ${task.endTime || "終日"}`;
    return task.startDate;
  }
  return `${startText} - ${endText}`;
}

function urgencyText(value) {
  return {
    low: "低",
    normal: "通常",
    high: "高",
    critical: "最優先"
  }[value] || "通常";
}

function repeatText(task) {
  if (!task.repeat || task.repeat.frequency === "none") return "";
  const unit = {
    daily: "日",
    weekly: "週",
    monthly: "か月",
    yearly: "年"
  }[task.repeat.frequency];
  const interval = task.repeat.interval || 1;
  const base = interval === 1 ? {
    daily: "毎日",
    weekly: "毎週",
    monthly: "毎月",
    yearly: "毎年"
  }[task.repeat.frequency] : `${interval}${unit}ごと`;
  return task.repeat.until ? `${base}、${task.repeat.until}まで` : base;
}

function isOverdue(task) {
  if (task.done) return false;
  const end = parseDateTime(task.endDate, task.endTime, true);
  return end && end < new Date();
}

function normalizeTask(task) {
  const today = toDateInputValue(new Date());
  return {
    id: task.id || crypto.randomUUID(),
    title: task.title || "",
    detail: task.detail || "",
    startDate: task.startDate || today,
    startTime: task.startTime || "",
    endDate: task.endDate || task.startDate || today,
    endTime: task.endTime || "",
    remindMinutes: task.remindMinutes ?? "",
    urgency: task.urgency || "normal",
    color: task.color || state.db.settings.accent || "#1a73e8",
    done: Boolean(task.done),
    repeat: {
      frequency: task.repeat?.frequency || "none",
      interval: Number(task.repeat?.interval || 1),
      until: task.repeat?.until || ""
    },
    createdAt: task.createdAt || new Date().toISOString(),
    updatedAt: task.updatedAt || new Date().toISOString()
  };
}

async function loadDb() {
  if (!window.localTaskApi) {
    throw new Error("Electronのpreload APIを取得できませんでした。npm startから起動してください。");
  }
  const data = await window.localTaskApi.loadDb();
  state.db = data;
  state.db.tasks = Array.isArray(state.db.tasks) ? state.db.tasks.map(normalizeTask) : [];
  state.db.settings = {...state.db.settings};

  try {
    const dataPath = await window.localTaskApi.getDataPath();
    els.dataPathLabel.textContent = dataPath;
    els.dataPathLabel.title = dataPath;
  } catch {
    els.dataPathLabel.textContent = "tasks.json";
  }

  applySettings();
}

async function saveDb() {
  if (!window.localTaskApi) {
    throw new Error("Electronの保存APIを取得できませんでした。");
  }
  await window.localTaskApi.saveDb(state.db);
}

function applySettings() {
  const s = state.db.settings;
  document.documentElement.style.setProperty("--accent", s.accent || "#1a73e8");

  document.body.classList.toggle("compact", s.density === "compact");

  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = s.theme === "dark" || (s.theme === "system" && prefersDark);
  document.body.classList.toggle("dark", dark);

  els.themeInput.value = s.theme || "system";
  els.accentInput.value = s.accent || "#1a73e8";
  els.densityInput.value = s.density || "comfortable";
  els.calendarStartInput.value = s.calendarStart || "monday";
  els.notificationsInput.checked = Boolean(s.notifications);
}

function setView(view) {
  state.view = view;
  els.listView.classList.toggle("hidden", view !== "list");
  els.calendarView.classList.toggle("hidden", view !== "calendar");
  els.listViewButton.classList.toggle("active", view === "list");
  els.calendarViewButton.classList.toggle("active", view === "calendar");
  render();
}

function filteredTasks() {
  const q = els.searchInput.value.trim().toLowerCase();
  const status = els.statusFilter.value;
  const urgency = els.urgencyFilter.value;

  return state.db.tasks.filter(task => {
    const textMatch = !q || `${task.title}\n${task.detail}`.toLowerCase().includes(q);
    const urgencyMatch = urgency === "all" || task.urgency === urgency;

    let statusMatch = true;
    if (status === "open") statusMatch = !task.done;
    if (status === "done") statusMatch = task.done;
    if (status === "overdue") statusMatch = isOverdue(task);

    return textMatch && urgencyMatch && statusMatch;
  }).sort((a, b) => {
    const da = parseDateTime(a.endDate, a.endTime, true)?.getTime() || 0;
    const db = parseDateTime(b.endDate, b.endTime, true)?.getTime() || 0;
    return da - db;
  });
}

function renderList() {
  const tasks = filteredTasks();
  const openCount = tasks.filter(t => !t.done).length;
  const overdueCount = tasks.filter(isOverdue).length;
  els.listSummary.textContent = `${tasks.length}件、未完了${openCount}件、期限超過${overdueCount}件`;

  if (!tasks.length) {
    els.taskList.innerHTML = `<div class="empty">表示対象のタスクはありません。</div>`;
    return;
  }

  els.taskList.innerHTML = "";
  for (const task of tasks) {
    const card = document.createElement("article");
    card.className = `task-card ${task.done ? "done" : ""}`;
    card.style.setProperty("--task-color", task.color);

    const repeat = repeatText(task);
    const overdue = isOverdue(task);

    card.innerHTML = `
      <div class="color-strip"></div>
      <div>
        <div class="task-title-row">
          <button class="task-title" type="button"></button>
          <span class="chip urgency-${task.urgency}">緊急度 ${urgencyText(task.urgency)}</span>
          ${overdue ? `<span class="chip urgency-critical">期限超過</span>` : ""}
        </div>
        <div class="task-meta">
          <span>${escapeHtml(formatDateTimeRange(task))}</span>
          ${task.remindMinutes !== "" ? `<span>リマインド ${escapeHtml(remindLabel(task.remindMinutes))}</span>` : ""}
          ${repeat ? `<span>${escapeHtml(repeat)}</span>` : ""}
        </div>
        ${task.detail ? `<div class="task-detail">${escapeHtml(task.detail)}</div>` : ""}
      </div>
      <label class="done-toggle">
        <input type="checkbox" ${task.done ? "checked" : ""}>
        <span>完了</span>
      </label>
    `;

    card.querySelector(".task-title").textContent = task.title;
    card.querySelector(".task-title").addEventListener("click", () => openTaskDialog(task.id));
    card.querySelector(".done-toggle input").addEventListener("change", async (e) => {
      task.done = e.target.checked;
      task.updatedAt = new Date().toISOString();
      await saveDb();
      render();
    });
    els.taskList.appendChild(card);
  }
}

function remindLabel(value) {
  if (value === "" || value === null || value === undefined) return "なし";
  const n = Number(value);
  if (n === 0) return "期限時刻";
  if (n < 60) return `${n}分前`;
  if (n === 60) return "1時間前";
  if (n === 1440) return "1日前";
  return `${n}分前`;
}

function getCalendarStartDate(year, month) {
  const first = new Date(year, month, 1);
  const weekStart = state.db.settings.calendarStart === "sunday" ? 0 : 1;
  const diff = (first.getDay() - weekStart + 7) % 7;
  return addDays(first, -diff);
}

function weekdayLabels() {
  return state.db.settings.calendarStart === "sunday"
    ? ["日", "月", "火", "水", "木", "金", "土"]
    : ["月", "火", "水", "木", "金", "土", "日"];
}

function visibleOccurrences(rangeStart, rangeEnd) {
  const tasks = filteredTasks();
  const occurrences = [];
  for (const task of tasks) {
    occurrences.push(...expandTask(task, rangeStart, rangeEnd));
  }
  return occurrences;
}

function expandTask(task, rangeStart, rangeEnd) {
  const baseStart = parseDateTime(task.startDate, task.startTime);
  const baseEnd = parseDateTime(task.endDate, task.endTime, true);
  if (!baseStart || !baseEnd) return [];

  const duration = baseEnd.getTime() - baseStart.getTime();
  const repeat = task.repeat || {frequency: "none"};
  const until = repeat.until ? parseDateTime(repeat.until, "23:59") : null;

  const result = [];
  let currentStart = new Date(baseStart);
  let guard = 0;

  while (currentStart <= rangeEnd && guard < 500) {
    const currentEnd = new Date(currentStart.getTime() + duration);
    if ((!until || currentStart <= until) && currentEnd >= rangeStart && currentStart <= rangeEnd) {
      result.push({...task, occurrenceStart: currentStart, occurrenceEnd: currentEnd});
    }

    if (!repeat.frequency || repeat.frequency === "none") break;

    const interval = Math.max(1, Number(repeat.interval || 1));
    if (repeat.frequency === "daily") currentStart = addDays(currentStart, interval);
    else if (repeat.frequency === "weekly") currentStart = addDays(currentStart, interval * 7);
    else if (repeat.frequency === "monthly") currentStart = addMonths(currentStart, interval);
    else if (repeat.frequency === "yearly") currentStart = addYears(currentStart, interval);
    else break;

    guard += 1;
    if (until && currentStart > until) break;
  }

  return result;
}

function renderCalendar() {
  const year = state.calendarDate.getFullYear();
  const month = state.calendarDate.getMonth();
  els.calendarTitle.textContent = `${year}年${month + 1}月`;
  const start = getCalendarStartDate(year, month);
  const end = addDays(start, 41);
  const occurrences = visibleOccurrences(dateOnly(start), new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59));
  els.calendarSummary.textContent = `表示中の予定 ${occurrences.length}件`;

  els.calendarGrid.innerHTML = "";
  for (const label of weekdayLabels()) {
    const div = document.createElement("div");
    div.className = "weekday";
    div.textContent = label;
    els.calendarGrid.appendChild(div);
  }

  const today = toDateInputValue(new Date());

  for (let i = 0; i < 42; i++) {
    const day = addDays(start, i);
    const dayStart = dateOnly(day);
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);
    const dayKey = toDateInputValue(day);

    const cell = document.createElement("div");
    cell.className = "day-cell";
    if (day.getMonth() !== month) cell.classList.add("outside");
    if (dayKey === today) cell.classList.add("today");

    const number = document.createElement("div");
    number.className = "day-number";
    number.textContent = String(day.getDate());
    cell.appendChild(number);

    const fullDayEvents = occurrences.filter(o => o.occurrenceStart <= dayEnd && o.occurrenceEnd >= dayStart);
    const dayEvents = fullDayEvents.sort((a, b) => a.occurrenceStart - b.occurrenceStart).slice(0, 6);

    for (const task of dayEvents) {
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = "event-pill";
      pill.style.setProperty("--task-color", task.color);
      pill.textContent = calendarPillText(task, dayKey);
      pill.title = `${task.title}\n${formatDateTimeRange(task)}`;
      pill.addEventListener("click", () => openTaskDialog(task.id));
      cell.appendChild(pill);
    }

    const hiddenCount = fullDayEvents.length - dayEvents.length;
    if (hiddenCount > 0) {
      const more = document.createElement("div");
      more.className = "task-meta";
      more.textContent = `他${hiddenCount}件`;
      cell.appendChild(more);
    }

    els.calendarGrid.appendChild(cell);
  }
}

function calendarPillText(task, dayKey) {
  const startKey = toDateInputValue(task.occurrenceStart);
  const endKey = toDateInputValue(task.occurrenceEnd);
  let prefix = "";
  if (startKey === dayKey && task.startTime) prefix = `${task.startTime} `;
  if (startKey !== endKey) {
    if (startKey === dayKey) prefix = "開始 ";
    else if (endKey === dayKey) prefix = "終了 ";
    else prefix = "継続 ";
  }
  return `${prefix}${task.title}`;
}

function render() {
  renderList();
  renderCalendar();
}

function openTaskDialog(id = null, datePrefill = null) {
  const task = id ? state.db.tasks.find(t => t.id === id) : null;
  els.taskDialogTitle.textContent = task ? "タスク詳細" : "新規タスク";
  els.deleteTaskButton.classList.toggle("hidden", !task);

  const today = datePrefill || toDateInputValue(new Date());

  els.taskId.value = task?.id || "";
  els.titleInput.value = task?.title || "";
  els.detailInput.value = task?.detail || "";
  els.startDateInput.value = task?.startDate || today;
  els.startTimeInput.value = task?.startTime || "";
  els.endDateInput.value = task?.endDate || today;
  els.endTimeInput.value = task?.endTime || "";
  els.remindInput.value = task?.remindMinutes ?? "";
  els.urgencyInput.value = task?.urgency || "normal";
  els.colorInput.value = task?.color || state.db.settings.accent || "#1a73e8";
  els.repeatInput.value = task?.repeat?.frequency || "none";
  els.intervalInput.value = task?.repeat?.interval || 1;
  els.repeatUntilInput.value = task?.repeat?.until || "";
  els.doneInput.checked = Boolean(task?.done);

  els.taskDialog.showModal();
}

function closeDialogs() {
  document.querySelectorAll("dialog[open]").forEach(d => d.close());
}

async function saveTaskFromForm() {
  const start = parseDateTime(els.startDateInput.value, els.startTimeInput.value);
  const end = parseDateTime(els.endDateInput.value, els.endTimeInput.value, true);
  if (!start || !end) {
    showToast("開始日と終了日は必須です。");
    return;
  }
  if (end < start) {
    showToast("終了日時は開始日時以降にしてください。");
    return;
  }

  const id = els.taskId.value || crypto.randomUUID();
  const existing = state.db.tasks.find(t => t.id === id);
  const task = normalizeTask({
    id,
    title: els.titleInput.value.trim(),
    detail: els.detailInput.value.trim(),
    startDate: els.startDateInput.value,
    startTime: els.startTimeInput.value,
    endDate: els.endDateInput.value,
    endTime: els.endTimeInput.value,
    remindMinutes: els.remindInput.value,
    urgency: els.urgencyInput.value,
    color: els.colorInput.value,
    done: els.doneInput.checked,
    repeat: {
      frequency: els.repeatInput.value,
      interval: Number(els.intervalInput.value || 1),
      until: els.repeatUntilInput.value
    },
    createdAt: existing?.createdAt
  });

  if (!task.title) {
    showToast("名称を入力してください。");
    return;
  }

  if (existing) {
    Object.assign(existing, task);
  } else {
    state.db.tasks.push(task);
  }

  await saveDb();
  closeDialogs();
  render();
  showToast("保存しました。");
}

async function deleteCurrentTask() {
  const id = els.taskId.value;
  if (!id) return;
  state.db.tasks = state.db.tasks.filter(t => t.id !== id);
  await saveDb();
  closeDialogs();
  render();
  showToast("削除しました。");
}

function openSettingsDialog() {
  applySettings();
  els.settingsDialog.showModal();
}

async function saveSettingsFromForm() {
  state.db.settings.theme = els.themeInput.value;
  state.db.settings.accent = els.accentInput.value;
  state.db.settings.density = els.densityInput.value;
  state.db.settings.calendarStart = els.calendarStartInput.value;
  state.db.settings.notifications = els.notificationsInput.checked;

  if (state.db.settings.notifications && "Notification" in window && Notification.permission === "default") {
    try { await Notification.requestPermission(); } catch {}
  }

  applySettings();
  await saveDb();
  closeDialogs();
  render();
  showToast("設定を保存しました。");
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.add("hidden"), 2400);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

function checkReminders() {
  if (!state.db.settings.notifications) return;
  const now = new Date();
  const horizon = new Date(now.getTime() + 60 * 1000);

  for (const task of state.db.tasks) {
    if (task.done || task.remindMinutes === "" || task.remindMinutes === null || task.remindMinutes === undefined) continue;

    const occurrences = expandTask(task, new Date(now.getTime() - 24 * 60 * 60 * 1000), addDays(now, 365));
    for (const occ of occurrences) {
      const trigger = new Date(occ.occurrenceEnd.getTime() - Number(task.remindMinutes) * 60 * 1000);
      const key = `${task.id}:${trigger.toISOString()}`;
      if (trigger >= now && trigger <= horizon && !state.remindedKeys.has(key)) {
        state.remindedKeys.add(key);
        notify(task);
      }
    }
  }
}

function notify(task) {
  const body = `${formatDateTimeRange(task)} / 緊急度 ${urgencyText(task.urgency)}`;
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(task.title, {body});
  } else {
    showToast(`リマインド: ${task.title}`);
  }
}

function attachEvents() {
  els.listViewButton.addEventListener("click", () => setView("list"));
  els.calendarViewButton.addEventListener("click", () => setView("calendar"));
  els.newTaskButton.addEventListener("click", () => openTaskDialog());
  els.settingsButton.addEventListener("click", openSettingsDialog);

  els.searchInput.addEventListener("input", render);
  els.statusFilter.addEventListener("change", render);
  els.urgencyFilter.addEventListener("change", render);

  els.prevMonthButton.addEventListener("click", () => {
    state.calendarDate = addMonths(state.calendarDate, -1);
    render();
  });

  els.nextMonthButton.addEventListener("click", () => {
    state.calendarDate = addMonths(state.calendarDate, 1);
    render();
  });

  els.todayButton.addEventListener("click", () => {
    state.calendarDate = new Date();
    render();
  });

  els.taskForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveTaskFromForm();
  });

  els.deleteTaskButton.addEventListener("click", deleteCurrentTask);

  els.settingsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveSettingsFromForm();
  });

  document.querySelectorAll("[data-close-dialog]").forEach(btn => {
    btn.addEventListener("click", closeDialogs);
  });

  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", applySettings);
}

async function init() {
  attachEvents();
  try {
    await loadDb();
    render();
    setInterval(checkReminders, 30000);
    checkReminders();
  } catch (err) {
    showToast(err.message || "起動に失敗しました。");
  }
}

init();

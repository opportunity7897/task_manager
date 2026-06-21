(() => {
  const MS_DAY = 86400000;
  const week = { date: new Date() };

  function byId(id) {
    return document.getElementById(id);
  }

  function endOfDayLocal(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  }

  function daysBetweenLocal(a, b) {
    return Math.round((dateOnly(a).getTime() - dateOnly(b).getTime()) / MS_DAY);
  }

  function startOfWeekLocal(date) {
    const startDay = state.db.settings.calendarStart === "sunday" ? 0 : 1;
    const d = dateOnly(date);
    const diff = (d.getDay() - startDay + 7) % 7;
    return addDays(d, -diff);
  }

  function todayText(occ) {
    const today = toDateInputValue(new Date());
    const start = toDateInputValue(occ.occurrenceStart);
    const end = toDateInputValue(occ.occurrenceEnd);

    if (start !== end) {
      if (start === today) return "今日開始";
      if (end === today) return "今日終了";
      return "継続中";
    }

    if (occ.startTime || occ.endTime) {
      return `${occ.startTime || "終日"} - ${occ.endTime || "終日"}`;
    }

    return "終日";
  }

  function renderTodayAgenda() {
    const list = byId("todayList");
    if (!list) return;

    const start = dateOnly(new Date());
    const end = endOfDayLocal(new Date());
    const items = visibleOccurrences(start, end)
      .filter(occ => occ.occurrenceStart <= end && occ.occurrenceEnd >= start)
      .sort((a, b) => a.occurrenceStart - b.occurrenceStart || a.occurrenceEnd - b.occurrenceEnd);

    if (!items.length) {
      list.innerHTML = '<div class="empty today-empty">今日の予定はありません。</div>';
      return;
    }

    list.innerHTML = "";
    for (const occ of items.slice(0, 12)) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "today-item";
      item.style.setProperty("--task-color", occ.color);
      item.innerHTML = `
        <span class="today-item-title">${escapeHtml(occ.title)}</span>
        <span class="today-item-meta">${escapeHtml(todayText(occ))}</span>
      `;
      item.addEventListener("click", () => openTaskDialog(occ.id));
      list.appendChild(item);
    }

    if (items.length > 12) {
      const more = document.createElement("div");
      more.className = "more-count";
      more.textContent = `他${items.length - 12}件`;
      list.appendChild(more);
    }
  }

  function renderWeekView() {
    const grid = byId("weekGrid");
    const title = byId("weekTitle");
    const summary = byId("weekSummary");
    if (!grid || !title || !summary) return;

    const start = startOfWeekLocal(week.date);
    const end = endOfDayLocal(addDays(start, 6));
    const occs = visibleOccurrences(start, end);
    title.textContent = `${toDateInputValue(start)} - ${toDateInputValue(end)}`;
    summary.textContent = `表示中の予定 ${occs.length}件`;

    renderConnectedGrid(grid, start, 7, null, occs, 18);
  }

  function renderConnectedCalendar() {
    const year = state.calendarDate.getFullYear();
    const month = state.calendarDate.getMonth();
    const start = getCalendarStartDate(year, month);
    const end = endOfDayLocal(addDays(start, 41));
    const occs = visibleOccurrences(start, end);

    els.calendarTitle.textContent = `${year}年${month + 1}月`;
    els.calendarSummary.textContent = `表示中の予定 ${occs.length}件`;
    renderConnectedGrid(els.calendarGrid, start, 42, month, occs, 5);
  }

  function renderConnectedGrid(container, startDate, dayCount, currentMonth, occurrences, maxSlots) {
    container.innerHTML = "";

    for (const label of weekdayLabels()) {
      const cell = document.createElement("div");
      cell.className = "weekday";
      cell.textContent = label;
      container.appendChild(cell);
    }

    const cells = [];
    const today = toDateInputValue(new Date());

    for (let i = 0; i < dayCount; i++) {
      const day = addDays(startDate, i);
      const cell = document.createElement("div");
      cell.className = "day-cell";
      if (currentMonth !== null && day.getMonth() !== currentMonth) cell.classList.add("outside");
      if (toDateInputValue(day) === today) cell.classList.add("today");

      const number = document.createElement("div");
      number.className = "day-number";
      number.textContent = String(day.getDate());
      cell.appendChild(number);

      cells.push(cell);
      container.appendChild(cell);
    }

    for (let row = 0; row < Math.ceil(dayCount / 7); row++) {
      const rowStart = addDays(startDate, row * 7);
      const rowEnd = endOfDayLocal(addDays(rowStart, 6));
      const rowOccs = occurrences
        .filter(occ => occ.occurrenceStart <= rowEnd && occ.occurrenceEnd >= rowStart)
        .sort((a, b) => {
          const as = Math.max(0, daysBetweenLocal(a.occurrenceStart, rowStart));
          const bs = Math.max(0, daysBetweenLocal(b.occurrenceStart, rowStart));
          const ae = Math.min(6, daysBetweenLocal(a.occurrenceEnd, rowStart));
          const be = Math.min(6, daysBetweenLocal(b.occurrenceEnd, rowStart));
          return as - bs || (be - bs) - (ae - as) || a.occurrenceEnd - b.occurrenceEnd;
        });

      const slots = [];
      const assignments = [];
      let hidden = 0;

      for (const occ of rowOccs) {
        const start = Math.max(0, daysBetweenLocal(occ.occurrenceStart, rowStart));
        const end = Math.min(6, daysBetweenLocal(occ.occurrenceEnd, rowStart));
        let slot = slots.findIndex(days => {
          for (let d = start; d <= end; d++) if (days[d]) return false;
          return true;
        });

        if (slot === -1) {
          slot = slots.length;
          slots.push(Array(7).fill(false));
        }

        if (slot >= maxSlots) {
          hidden++;
          continue;
        }

        for (let d = start; d <= end; d++) slots[slot][d] = true;
        assignments.push({ occ, slot, start, end });
      }

      for (let day = 0; day < 7; day++) {
        const cell = cells[row * 7 + day];
        if (!cell) continue;

        for (let slot = 0; slot < maxSlots; slot++) {
          const slotBox = document.createElement("div");
          slotBox.className = "calendar-slot";

          const a = assignments.find(item => item.slot === slot && day >= item.start && day <= item.end);
          if (a) {
            const pill = document.createElement("button");
            pill.type = "button";
            pill.className = `event-pill ${segmentClass(a, day)} ${a.occ.done ? "done" : ""}`;
            pill.style.setProperty("--task-color", a.occ.color);
            pill.textContent = day === a.start ? `${a.occ.startTime ? `${a.occ.startTime} ` : ""}${a.occ.title}` : "";
            pill.title = `${a.occ.title}\n${formatDateTimeRange(a.occ)}`;
            pill.addEventListener("click", () => openTaskDialog(a.occ.id));
            slotBox.appendChild(pill);
          }

          cell.appendChild(slotBox);
        }

        if (hidden > 0 && day === 6) {
          const more = document.createElement("div");
          more.className = "more-count";
          more.textContent = `他${hidden}件`;
          cell.appendChild(more);
        }
      }
    }
  }

  function segmentClass(a, day) {
    if (a.start === a.end) return "segment-single";
    if (day === a.start) return "segment-start";
    if (day === a.end) return "segment-end";
    return "segment-middle";
  }

  const originalSetView = setView;
  setView = (view) => {
    if (view !== "week") {
      originalSetView(view);
      byId("weekView")?.classList.add("hidden");
      byId("weekViewButton")?.classList.remove("active");
      return;
    }

    state.view = "week";
    els.listView.classList.add("hidden");
    els.calendarView.classList.add("hidden");
    byId("weekView")?.classList.remove("hidden");
    els.listViewButton.classList.remove("active");
    els.calendarViewButton.classList.remove("active");
    byId("weekViewButton")?.classList.add("active");
    render();
  };

  renderCalendar = renderConnectedCalendar;
  const originalRender = render;
  render = () => {
    renderTodayAgenda();
    originalRender();
    renderWeekView();
  };

  byId("weekViewButton")?.addEventListener("click", () => setView("week"));
  byId("prevWeekButton")?.addEventListener("click", () => {
    week.date = addDays(week.date, -7);
    render();
  });
  byId("nextWeekButton")?.addEventListener("click", () => {
    week.date = addDays(week.date, 7);
    render();
  });
  byId("weekTodayButton")?.addEventListener("click", () => {
    week.date = new Date();
    render();
  });

  queueMicrotask(() => {
    if (byId("dataPathLabel")) byId("dataPathLabel").textContent = "ローカルJSON保存";
    render();
  });
})();

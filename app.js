const STORAGE_KEY = "fasting-flow-state-v1";
const FASTING_HOURS = 16;
const EATING_HOURS = 8;
const state = loadState();
let calendarCursor = new Date();

function $(id) { return document.getElementById(id); }
const els = {
    phaseTitle: $("phase-title"), statusPill: $("status-pill"), ringCaption: $("ring-caption"), ringTime: $("ring-time"),
    ringSubtext: $("ring-subtext"), progressRing: $("progress-ring"), fastingDetail: $("fasting-detail"), eatingDetail: $("eating-detail"),
    completedDays: $("completed-days"), currentStreak: $("current-streak"), bestStreak: $("best-streak"), totalHours: $("total-fasting-hours"),
    timeline: $("timeline"), template: $("timeline-item-template"), calendarGrid: $("calendar-grid"), calendarTitle: $("calendar-title")
};

$("start-fasting").addEventListener("click", startFasting);
$("start-eating").addEventListener("click", startEating);
$("complete-day").addEventListener("click", markComplete);
$("reset-cycle").addEventListener("click", resetToday);
$("prev-month").addEventListener("click", function () { calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1); renderCalendar(); });
$("next-month").addEventListener("click", function () { calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1); renderCalendar(); });

ensureRecord(dayKey(new Date()));
refresh();
setInterval(refreshLive, 1000);
if ("serviceWorker" in navigator) window.addEventListener("load", function () { navigator.serviceWorker.register("./sw.js").catch(function () {}); });

function loadState() {
    try {
          return Object.assign({ phase: "idle", cycleStart: null, timeline: [], daily: {} }, JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"));
    } catch (error) {
          return { phase: "idle", cycleStart: null, timeline: [], daily: {} };
    }
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function dayKey(date) { return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0"); }
function ensureRecord(key) { if (!state.daily[key]) state.daily[key] = { fastingHours: 0, completed: false, completedAt: null }; return state.daily[key]; }
function formatSeconds(total) { var h = Math.floor(total / 3600), m = Math.floor(total % 3600 / 60), s = total % 60; return [h, m, s].map(function (v) { return String(v).padStart(2, "0"); }).join(":"); }
function formatTime(iso) { var d = new Date(iso); return (d.getMonth() + 1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
function elapsedHours(iso) { return Math.max(0, Number(((Date.now() - new Date(iso).getTime()) / 36e5).toFixed(1))); }
function pushLine(title, meta) { state.timeline.unshift({ title: title, meta: meta, time: new Date().toISOString() }); state.timeline = state.timeline.slice(0, 8); }

function startFasting() {
    state.phase = "fasting";
    state.cycleStart = new Date().toISOString();
    pushLine("开始断食", "目标 " + FASTING_HOURS + " 小时");
    save();
    refresh();
}
function startEating() {
    if (state.phase === "fasting" && state.cycleStart) {
          var key = dayKey(new Date(state.cycleStart));
          var record = ensureRecord(key);
          var hours = elapsedHours(state.cycleStart);
          record.fastingHours = Math.max(record.fastingHours, hours);
          if (hours >= FASTING_HOURS) { record.completed = true; record.completedAt = new Date().toISOString(); }
    }
    state.phase = "eating";
    state.cycleStart = new Date().toISOString();
    pushLine("进入饮食期", "计划 " + EATING_HOURS + " 小时");
    save();
    refresh();
}
function markComplete() {
    var key = dayKey(new Date());
    var record = ensureRecord(key);
    record.completed = true;
    record.completedAt = new Date().toISOString();
    pushLine("手动标记完成", "今日状态已更新");
    save();
    refresh();
}
function resetToday() {
    state.daily[dayKey(new Date())] = { fastingHours: 0, completed: false, completedAt: null };
    state.phase = "idle";
    state.cycleStart = null;
    pushLine("重置今天", "重新开始也没关系");
    save();
    refresh();
}
function refreshLive() {
    if (state.phase === "fasting" && state.cycleStart) {
          var key = dayKey(new Date(state.cycleStart));
          var record = ensureRecord(key);
          var hours = elapsedHours(state.cycleStart);
          record.fastingHours = Math.max(record.fastingHours, hours);
          if (hours >= FASTING_HOURS && !record.completed) { record.completed = true; record.completedAt = new Date().toISOString(); save(); }
    }
    renderTimer();
    renderStats();
    renderCalendar();
}
function refresh() { renderTimer(); renderStats(); renderTimeline(); renderCalendar(); }

function renderTimer() {
    var title = "等待开始", pill = "未开始", caption = "准备好时开始", left = FASTING_HOURS * 3600, progress = 0, accent = "#c96f4a", soft = "#f3d2c2", sub = "目标断食时长";
    if (state.phase === "fasting" && state.cycleStart) {
          var elapsed = Math.max(0, Math.floor((Date.now() - new Date(state.cycleStart).getTime()) / 1000));
          left = Math.max(0, FASTING_HOURS * 3600 - elapsed);
          progress = Math.min(1, elapsed / (FASTING_HOURS * 3600));
          title = elapsed >= FASTING_HOURS * 3600 ? "断食目标达成" : "断食进行中";
          pill = elapsed >= FASTING_HOURS * 3600 ? "已完成" : "断食";
          caption = elapsed >= FASTING_HOURS * 3600 ? "可以切换饮食期" : "距离目标还剩";
          sub = "已坚持 " + formatSeconds(elapsed);
    } else if (state.phase === "eating" && state.cycleStart) {
          var eatElapsed = Math.max(0, Math.floor((Date.now() - new Date(state.cycleStart).getTime()) / 1000));
          left = Math.max(0, EATING_HOURS * 3600 - eatElapsed);
          progress = Math.min(1, eatElapsed / (EATING_HOURS * 3600));
          title = eatElapsed >= EATING_HOURS * 3600 ? "饮食期结束" : "饮食期进行中";
          pill = eatElapsed >= EATING_HOURS * 3600 ? "待断食" : "饮食";
          caption = eatElapsed >= EATING_HOURS * 3600 ? "可以开始下一轮断食" : "饮食窗口剩余";
          sub = "饮食期已过 " + formatSeconds(eatElapsed);
          accent = "#91b8aa";
          soft = "#dce8e2";
    }
    els.phaseTitle.textContent = title;
    els.statusPill.textContent = pill;
    els.ringCaption.textContent = caption;
    els.ringTime.textContent = formatSeconds(left);
    els.ringSubtext.textContent = sub;
    els.fastingDetail.textContent = state.phase === "fasting" ? "正在累积今日断食时长" : "建议空腹时段尽量稳定";
    els.eatingDetail.textContent = state.phase === "eating" ? "记得在窗口结束前准备下一轮" : "完成断食后进入轻盈补给";
    var deg = Math.max(0.04, progress) * 360;
    els.progressRing.style.background = "conic-gradient(from -90deg, " + accent + " 0deg " + deg + "deg, " + soft + " " + deg + "deg 360deg)";
}

function renderStats() {
    var keys = Object.keys(state.daily).sort();
    var now = new Date();
    var prefix = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
    var records = keys.map(function (key) { return Object.assign({ key: key }, state.daily[key]); });
    els.completedDays.textContent = String(records.filter(function (r) { return r.key.indexOf(prefix) === 0 && r.completed; }).length);
    els.totalHours.textContent = String(Math.round(records.reduce(function (sum, r) { return sum + (r.fastingHours || 0); }, 0)));
    var streak = calcStreak(keys, dayKey(now));
    els.currentStreak.textContent = String(streak.current);
    els.bestStreak.textContent = String(streak.best);
}
function calcStreak(keys, todayKeyValue) {
    if (!keys.length) return { current: 0, best: 0 };
    var start = new Date(keys[0]);
    var end = new Date(todayKeyValue);
    var current = 0, best = 0, run = 0;
    for (var d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          var ok = !!state.daily[dayKey(d)] && !!state.daily[dayKey(d)].completed;
          run = ok ? run + 1 : 0;
          if (run > best) best = run;
          if (dayKey(d) === todayKeyValue) current = run;
    }
    return { current: current, best: best };
}
function renderTimeline() {
    els.timeline.innerHTML = "";
    var items = state.timeline.length ? state.timeline : [{ title: "等待第一次记录", meta: "点击开始断食后，这里会记下你的节奏", time: new Date().toISOString() }];
    items.forEach(function (item) {
          var node = els.template.content.cloneNode(true);
          node.querySelector('.timeline-title').textContent = item.title;
          node.querySelector('.timeline-meta').textContent = formatTime(item.time) + " · " + item.meta;
          els.timeline.appendChild(node);
    });
}
function renderCalendar() {
    var year = calendarCursor.getFullYear();
    var month = calendarCursor.getMonth();
    var first = new Date(year, month, 1);
    var days = new Date(year, month + 1, 0).getDate();
    var offset = (first.getDay() + 6) % 7;
    var today = dayKey(new Date());
    var floorToday = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    els.calendarTitle.textContent = year + " 年 " + (month + 1) + " 月";
    els.calendarGrid.innerHTML = "";
    for (var i = 0; i < offset; i += 1) {
          var empty = document.createElement('div');
          empty.className = 'calendar-day empty';
          els.calendarGrid.appendChild(empty);
    }
    for (var day = 1; day <= days; day += 1) {
          var date = new Date(year, month, day);
          var key = dayKey(date);
          var record = state.daily[key];
          var status = date > floorToday ? "" : "missed";
          if (record && record.completed) status = "success";
          else if (key === today && (state.phase === "fasting" || state.phase === "eating")) status = "partial";
          var cell = document.createElement('article');
          cell.className = 'calendar-day ' + status + (key === today ? ' today' : '');
          var label = status === 'success' ? '完成 ' + Math.round((record && record.fastingHours) || FASTING_HOURS) + 'h' : status === 'partial' ? '进行中' : status === 'missed' ? '未完成' : '';
          cell.innerHTML = '<strong>' + day + '</strong><small>' + label + '</small>';
          els.calendarGrid.appendChild(cell);
    }
}

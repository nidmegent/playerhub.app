
/* ==================================================
   NIMDGENT ESPORTS | PREMIER
   Public calendar + survey response
================================================== */

const API_URL = "https://script.google.com/macros/s/AKfycbwtDh72d1_op6qdud8xX9hwLdwlsrBPde9AtG5li2VTsCL4U8UQZiNZ3ms5UVjT9sMK/exec";

const TEAM_NAMES = ["LYXEN Div", "NOXIA Div."];
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

let selectedTeam = TEAM_NAMES[0];
let currentMonth = new Date();
let events = [];
let selectedEventId = null;
let activeSurvey = null;

function apiGet(params = {}) {
  return new Promise((resolve, reject) => {
    if (API_URL.includes("YOUR_GOOGLE")) {
      reject(new Error("script.js の API_URL を設定してください。"));
      return;
    }

    const callbackName = "ndCallback_" + Date.now() +
      "_" + Math.random().toString(36).slice(2);

    const script = document.createElement("script");
    const query = new URLSearchParams({
      ...params,
      callback: callbackName
    });

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("サーバーへの接続がタイムアウトしました。"));
    }, 15000);

    function cleanup() {
      clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = data => {
      cleanup();
      if (!data || data.ok === false) {
        reject(new Error(data?.error || "データの取得に失敗しました。"));
      } else {
        resolve(data);
      }
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("サーバーに接続できませんでした。"));
    };

    script.src = API_URL + "?" + query.toString();
    document.body.appendChild(script);
  });
}

function apiPost(payload) {
  return new Promise((resolve, reject) => {
    if (API_URL.includes("YOUR_GOOGLE")) {
      reject(new Error("script.js の API_URL を設定してください。"));
      return;
    }

    let frame = document.getElementById("apiFrame");
    if (!frame) {
      frame = document.createElement("iframe");
      frame.name = "apiFrame";
      frame.id = "apiFrame";
      frame.hidden = true;
      document.body.appendChild(frame);
    }

    const form = document.createElement("form");
    form.method = "POST";
    form.action = API_URL;
    form.target = "apiFrame";
    form.hidden = true;

    const input = document.createElement("input");
    input.name = "payload";
    input.value = JSON.stringify(payload);
    form.appendChild(input);
    document.body.appendChild(form);

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("送信結果を確認できませんでした。再読み込みして確認してください。"));
    }, 20000);

    function cleanup() {
      clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      form.remove();
    }

    function onMessage(event) {
      if (
        event.origin !== "https://script.google.com" &&
        event.origin !== "https://script.googleusercontent.com"
      ) return;

      const result = event.data;
      if (!result || result.type !== "nimdgent-api-result") return;

      cleanup();
      if (result.data?.ok) resolve(result.data);
      else reject(new Error(result.data?.error || "処理に失敗しました。"));
    }

    window.addEventListener("message", onMessage);
    form.submit();
  });
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[ch]);
}

function formatDate(value, withTime = false) {
  if (!value) return "未設定";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const options = withTime
    ? { year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit" }
    : { year: "numeric", month: "2-digit", day: "2-digit" };

  return new Intl.DateTimeFormat("ja-JP", options).format(date);
}

function localDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function eventIsOpen(event) {
  return event.status !== "closed" &&
    new Date(event.deadline).getTime() > Date.now();
}

async function loadEvents() {
  const result = await apiGet({ action: "listEvents" });
  events = result.events || [];
}

function teamEvents() {
  return events
    .filter(event => event.team === selectedTeam)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function renderCalendar() {
  const calendar = document.getElementById("calendar");
  if (!calendar) return;

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthTitle = document.getElementById("monthTitle");

  monthTitle.textContent = `${year}年 ${month + 1}月`;
  calendar.innerHTML = "";

  WEEKDAYS.forEach(day => {
    const el = document.createElement("div");
    el.className = "weekday";
    el.textContent = day;
    calendar.appendChild(el);
  });

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement("div");
    empty.className = "day-cell empty";
    calendar.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const key = localDateKey(date);
    const matches = teamEvents().filter(event => event.date === key);

    const cell = document.createElement(matches.length ? "div" : "div");
    cell.className = "day-cell";
    if (key === localDateKey(new Date())) cell.classList.add("today");

    if (matches.length) {
      cell.classList.add("has-event");
      if (matches.every(event => !eventIsOpen(event))) {
        cell.classList.add("is-closed");
      }
      if (matches.some(event => event.id === selectedEventId)) {
        cell.classList.add("selected");
      }
    }

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = day;
    cell.appendChild(number);

    if (matches.length) {
      const indicator = document.createElement("span");
      indicator.className = "day-indicator";
      indicator.textContent = matches.length > 1
        ? `${matches.length}件`
        : eventIsOpen(matches[0]) ? "受付中" : "締切済";
      cell.appendChild(indicator);
      cell.tabIndex = 0;
      cell.setAttribute("role", "button");
      cell.setAttribute("aria-label", `${key}のアンケート`);
      cell.addEventListener("click", () => {
        if (matches.length === 1) {
          selectEvent(matches[0]);
        } else {
          renderEventList(key);
          document.getElementById("eventList")?.scrollIntoView({
            behavior: "smooth", block: "start"
          });
        }
      });
      cell.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          cell.click();
        }
      });
    }

    calendar.appendChild(cell);
  }
}

function renderEventList(filterDate = "") {
  const list = document.getElementById("eventList");
  if (!list) return;

  const filtered = teamEvents().filter(event =>
    !filterDate || event.date === filterDate
  );

  if (!filtered.length) {
    list.innerHTML = '<p class="muted">この部門の日程はありません。</p>';
    return;
  }

  list.innerHTML = filtered.map(event => `
    <article class="event-card">
      <div>
        <h3>${escapeHTML(event.title)}</h3>
        <p>${escapeHTML(formatDate(event.date))} ・
          締切 ${escapeHTML(formatDate(event.deadline, true))}</p>
        <p>${eventIsOpen(event) ? "● 回答受付中" : "● 締切済み"}</p>
      </div>
      <button class="primary-button" data-event-id="${escapeHTML(event.id)}"
        ${eventIsOpen(event) ? "" : "disabled"}>
        ${eventIsOpen(event) ? "回答する →" : "締切済み"}
      </button>
    </article>
  `).join("");

  list.querySelectorAll("[data-event-id]").forEach(button => {
    button.addEventListener("click", () => {
      const event = events.find(item => item.id === button.dataset.eventId);
      if (event) selectEvent(event);
    });
  });
}

function selectEvent(event) {
  if (!eventIsOpen(event)) {
    const message = document.getElementById("calendarMessage");
    if (message) message.textContent = "このアンケートは締切済みです。";
    return;
  }

  const url = new URL("survey.html", window.location.href);
  url.searchParams.set("id", event.id);
  url.searchParams.set("team", event.team);
  window.location.href = url.toString();
}

async function initCalendar() {
  const calendar = document.getElementById("calendar");
  if (!calendar) return;

  document.querySelectorAll("[data-team]").forEach(button => {
    button.addEventListener("click", () => {
      selectedTeam = button.dataset.team;
      document.querySelectorAll("[data-team]").forEach(item => {
        item.classList.toggle("active", item === button);
      });
      document.getElementById("teamHeading").textContent = selectedTeam;
      renderCalendar();
      renderEventList();
    });
  });

  document.getElementById("prevMonth").addEventListener("click", () => {
    currentMonth = new Date(
      currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1
    );
    renderCalendar();
  });

  document.getElementById("nextMonth").addEventListener("click", () => {
    currentMonth = new Date(
      currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1
    );
    renderCalendar();
  });

  try {
    await loadEvents();
    renderCalendar();
    renderEventList();
  } catch (error) {
    calendar.innerHTML = "";
    const message = document.getElementById("calendarMessage");
    if (message) {
      message.className = "message error";
      message.textContent = error.message;
    }
  }
}

async function initSurvey() {
  const form = document.getElementById("answerForm");
  if (!form) return;

  const params = new URLSearchParams(location.search);
  const eventId = params.get("id");
  const team = params.get("team");

  if (!eventId || !TEAM_NAMES.includes(team)) {
    document.getElementById("surveyStatus").textContent = "URLが正しくありません";
    form.hidden = true;
    return;
  }

  const message = document.getElementById("answerMessage");
  const button = document.getElementById("submitAnswer");

  try {
    const result = await apiGet({ action: "getEvent", id: eventId });
    const event = result.event;

    if (!event || event.team !== team) {
      throw new Error("アンケートが見つかりません。");
    }

    activeSurvey = event;
    document.getElementById("surveyTitle").textContent = event.title;
    document.getElementById("surveyTeam").textContent = event.team;
    document.getElementById("surveyDate").textContent = formatDate(event.date);
    document.getElementById("surveyDeadline").textContent =
      formatDate(event.deadline, true);

    if (!eventIsOpen(event)) {
      document.getElementById("surveyStatus").textContent = "回答締切済み";
      document.getElementById("surveyStatus").classList.add("closed");
      button.disabled = true;
      message.textContent = "このアンケートは締切済みです。";
    } else {
      document.getElementById("surveyStatus").textContent = "回答受付中";
    }
  } catch (error) {
    message.className = "message error";
    message.textContent = error.message;
    button.disabled = true;
    return;
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!activeSurvey || !eventIsOpen(activeSurvey)) {
      message.className = "message error";
      message.textContent = "回答締切済みです。";
      return;
    }

    const activityName = document.getElementById("activityName").value.trim();
    const attendance = form.querySelector(
      'input[name="attendance"]:checked'
    )?.value;

    if (!activityName || !attendance) {
      message.className = "message error";
      message.textContent = "活動名と出場可否を入力してください。";
      return;
    }

    button.disabled = true;
    button.textContent = "送信中...";
    message.className = "message";
    message.textContent = "";

    try {
      await apiPost({
        action: "saveAnswer",
        eventId: activeSurvey.id,
        team: activeSurvey.team,
        activityName,
        attendance
      });
      message.className = "message success";
      message.textContent = "回答を送信しました！";
      form.reset();
    } catch (error) {
      message.className = "message error";
      message.textContent = error.message;
    } finally {
      button.disabled = !eventIsOpen(activeSurvey);
      button.textContent = "回答を送信する";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initCalendar();
  initSurvey();
});

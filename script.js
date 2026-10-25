
/* ==================================================
   NIMDGENT ESPORTS | PREMIER
   Public calendar + survey response
================================================== */

const API_URL = "https://script.google.com/macros/s/AKfycbwtDh72d1_op6qdud8xX9hwLdwlsrBPde9AtG5li2VTsCL4U8UQZiNZ3ms5UVjT9sMK/exec";

const TEAM_NAMES = ["LYXEN Div", "NOXIA Div."];
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const ATTENDANCE_OPTIONS = ["出場する", "出場しない", "人数次第"];

let selectedTeam = TEAM_NAMES[0];
let currentMonth = new Date();
let events = [];
let activeSurvey = null;

/* ---------- GET: JSONP ---------- */

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

/* ---------- POST: iframe + JSONP result polling ---------- */

function apiPost(payload) {
  return new Promise((resolve, reject) => {
    const requestId =
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : "nd_" + Date.now() + "_" +
          Math.random().toString(36).slice(2) + "_" +
          Math.random().toString(36).slice(2);

    const requestPayload = { ...payload, requestId };

    let frame = document.getElementById("apiFrame");

    if (!frame) {
      frame = document.createElement("iframe");
      frame.name = "apiFrame";
      frame.id = "apiFrame";
      frame.hidden = true;
      frame.title = "API送信用";
      document.body.appendChild(frame);
    }

    const form = document.createElement("form");
    form.method = "POST";
    form.action = API_URL;
    form.target = "apiFrame";
    form.hidden = true;

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "payload";
    input.value = JSON.stringify(requestPayload);
    form.appendChild(input);
    document.body.appendChild(form);

    let finished = false;
    let attempts = 0;
    const maxAttempts = 25;

    function cleanup() {
      form.remove();
    }

    function finish(callback, value) {
      if (finished) return;
      finished = true;
      cleanup();
      callback(value);
    }

    function pollResult() {
      if (finished) return;

      if (attempts >= maxAttempts) {
        finish(
          reject,
          new Error(
            "処理結果を確認できませんでした。接続設定とデプロイを確認してください。"
          )
        );
        return;
      }

      attempts++;

      apiGet({ action: "getPostResult", requestId })
        .then(result => {
          if (finished) return;

          if (result.pending) {
            setTimeout(pollResult, 800);
            return;
          }

          if (!result.result) {
            finish(
              reject,
              new Error("サーバーから処理結果が返されませんでした。")
            );
            return;
          }

          if (result.result.ok) {
            finish(resolve, result.result);
          } else {
            finish(
              reject,
              new Error(result.result.error || "処理に失敗しました。")
            );
          }
        })
        .catch(error => {
          if (finished) return;

          if (attempts < maxAttempts) {
            setTimeout(pollResult, 1000);
          } else {
            finish(reject, error);
          }
        });
    }

    try {
      form.submit();
      setTimeout(pollResult, 500);
    } catch (error) {
      finish(reject, error);
    }
  });
}

/* ---------- Common helpers ---------- */

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[ch]);
}

function formatDate(value, withTime = false) {
  if (!value) return "未設定";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const options = withTime
    ? {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit"
      }
    : {
        year: "numeric", month: "2-digit", day: "2-digit"
      };

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

/* ---------- Calendar ---------- */

function renderCalendar() {
  const calendar = document.getElementById("calendar");
  if (!calendar) return;

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  document.getElementById("monthTitle").textContent =
    `${year}年 ${month + 1}月`;

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

    const cell = document.createElement("div");
    cell.className = "day-cell";

    if (key === localDateKey(new Date())) {
      cell.classList.add("today");
    }

    if (matches.length) {
      cell.classList.add("has-event");

      if (matches.every(event => !eventIsOpen(event))) {
        cell.classList.add("is-closed");
      }

      const number = document.createElement("span");
      number.className = "day-number";
      number.textContent = day;
      cell.appendChild(number);

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
            behavior: "smooth",
            block: "start"
          });
        }
      });

      cell.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          cell.click();
        }
      });
    } else {
      const number = document.createElement("span");
      number.className = "day-number";
      number.textContent = day;
      cell.appendChild(number);
    }

    calendar.appendChild(cell);
  }
}

/* ---------- Public attendance summaries ---------- */

async function renderAttendance(event, container) {
  if (!container) return;

  container.innerHTML =
    '<p class="muted">出場状況を読み込み中...</p>';

  try {
    const result = await apiGet({
      action: "getPublicSummary",
      id: event.id
    });

    const answers = result.answers || [];

    container.innerHTML = ATTENDANCE_OPTIONS.map(status => {
      const names = answers
        .filter(answer => answer.attendance === status)
        .map(answer => answer.activityName);

      return `
        <div class="attendance-group">
          <strong>${escapeHTML(status)}（${names.length}人）</strong>
          <p>${names.length
            ? names.map(escapeHTML).join("、")
            : "該当者なし"}</p>
        </div>
      `;
    }).join("");

    if (!answers.length) {
      container.insertAdjacentHTML(
        "afterbegin",
        '<p class="muted attendance-empty">まだ回答がありません。</p>'
      );
    }
  } catch (error) {
    container.innerHTML =
      '<p class="message error">出場状況を取得できませんでした。</p>';
  }
}

/* ---------- Event list ---------- */

function renderEventList(filterDate = "") {
  const list = document.getElementById("eventList");
  if (!list) return;

  const filtered = teamEvents().filter(event =>
    !filterDate || event.date === filterDate
  );

  if (!filtered.length) {
    list.innerHTML =
      '<p class="muted">この部門の日程はありません。</p>';
    return;
  }

  list.innerHTML = filtered.map(event => `
    <article class="event-card event-card-stack">
      <div class="event-card-main">
        <h3>${escapeHTML(event.title)}</h3>
        <p>${escapeHTML(formatDate(event.date))} ・
          締切 ${escapeHTML(formatDate(event.deadline, true))}</p>
        <p>${eventIsOpen(event)
          ? "● 回答受付中"
          : "● 締切済み"}</p>
      </div>

      <button class="primary-button"
        data-event-id="${escapeHTML(event.id)}"
        ${eventIsOpen(event) ? "" : "disabled"}>
        ${eventIsOpen(event) ? "回答する →" : "締切済み"}
      </button>

      <div class="attendance-summary"
        data-attendance-id="${escapeHTML(event.id)}">
        <p class="muted">出場状況を読み込み中...</p>
      </div>
    </article>
  `).join("");

  list.querySelectorAll("[data-event-id]").forEach(button => {
    button.addEventListener("click", () => {
      const event = events.find(
        item => item.id === button.dataset.eventId
      );
      if (event) selectEvent(event);
    });
  });

  filtered.forEach(event => {
    const container = list.querySelector(
      `[data-attendance-id="${CSS.escape(event.id)}"]`
    );
    renderAttendance(event, container);
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

/* ---------- Calendar initialization ---------- */

async function initCalendar() {
  const calendar = document.getElementById("calendar");
  if (!calendar) return;

  document.querySelectorAll("[data-team]").forEach(button => {
    button.addEventListener("click", () => {
      selectedTeam = button.dataset.team;

      document.querySelectorAll("[data-team]").forEach(item => {
        item.classList.toggle("active", item === button);
      });

      const heading = document.getElementById("teamHeading");
      if (heading) heading.textContent = selectedTeam;

      renderCalendar();
      renderEventList();
    });
  });

  document.getElementById("prevMonth").addEventListener("click", () => {
    currentMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() - 1,
      1
    );
    renderCalendar();
  });

  document.getElementById("nextMonth").addEventListener("click", () => {
    currentMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      1
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

/* ---------- Survey page ---------- */

async function loadMemberOptions(team) {
  const select = document.getElementById("activityName");
  if (!select) return;

  select.innerHTML =
    '<option value="">活動名を選択してください</option>';

  const result = await apiGet({
    action: "listMembers",
    team
  });

  (result.members || []).forEach(name => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });

  if (!result.members || !result.members.length) {
    select.innerHTML =
      '<option value="">登録メンバーがいません</option>';
  }
}

async function initSurvey() {
  const form = document.getElementById("answerForm");
  if (!form) return;

  const params = new URLSearchParams(location.search);
  const eventId = params.get("id");
  const team = params.get("team");

  const status = document.getElementById("surveyStatus");
  const message = document.getElementById("answerMessage");
  const button = document.getElementById("submitAnswer");
  const activitySelect = document.getElementById("activityName");

  if (!eventId || !TEAM_NAMES.includes(team)) {
    status.textContent = "URLが正しくありません";
    form.hidden = true;
    return;
  }

  button.disabled = true;

  try {
    const result = await apiGet({
      action: "getEvent",
      id: eventId
    });

    const event = result.event;

    if (!event || event.team !== team) {
      throw new Error("アンケートが見つかりません。");
    }

    activeSurvey = event;

    document.getElementById("surveyTitle").textContent = event.title;
    document.getElementById("surveyTeam").textContent = event.team;
    document.getElementById("surveyDate").textContent =
      formatDate(event.date);
    document.getElementById("surveyDeadline").textContent =
      formatDate(event.deadline, true);

    await loadMemberOptions(event.team);

    if (!eventIsOpen(event)) {
      status.textContent = "回答締切済み";
      status.classList.add("closed");
      button.disabled = true;
      activitySelect.disabled = true;
      message.textContent = "このアンケートは締切済みです。";
      return;
    }

    status.textContent = "回答受付中";
    button.disabled = false;

    if (activitySelect.options.length <= 1) {
      button.disabled = true;
      message.className = "message error";
      message.textContent =
        "登録メンバーがありません。管理者にMembersシートの確認を依頼してください。";
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

    const activityName = activitySelect.value;
    const attendance = form.querySelector(
      'input[name="attendance"]:checked'
    )?.value;

    if (!activityName || !attendance) {
      message.className = "message error";
      message.textContent = "活動名と出場可否を選択してください。";
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
      message.textContent =
        "回答を送信しました！変更する場合は再度回答してください。";
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

/* ---------- Boot ---------- */

document.addEventListener("DOMContentLoaded", () => {
  initCalendar();
  initSurvey();
});

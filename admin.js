/* ==================================================
   NIDMEGENT ESPORTS | PREMIER
   Admin frontend
   - Login
   - Event create / edit / delete
   - Notification toggles
   - Role mention toggles
   - Response summary
================================================== */

const API_URL =
  "https://script.google.com/macros/s/AKfycbwtDh72d1_op6qdud8xX9hwLdwlsrBPde9AtG5li2VTsCL4U8UQZiNZ3ms5UVjT9sMK/exec";

const ADMIN_TEAMS = ["LYXEN Div", "NOXIA Div."];

let adminToken = "";
let adminEvents = [];
let editingEventId = "";

/* ==================================================
   API GET: JSONP
================================================== */

function adminApiGet(params = {}) {
  return new Promise((resolve, reject) => {
    const callbackName =
      "ndAdminCallback_" +
      Date.now() +
      "_" +
      Math.random().toString(36).slice(2);

    const script = document.createElement("script");

    const query = new URLSearchParams({
      ...params,
      callback: callbackName
    });

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("サーバーへの接続がタイムアウトしました。"));
    }, 15000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = data => {
      cleanup();

      if (!data || data.ok === false) {
        reject(
          new Error(
            data?.error || "データの取得に失敗しました。"
          )
        );
        return;
      }

      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(
        new Error("サーバーに接続できませんでした。")
      );
    };

    script.src = API_URL + "?" + query.toString();

    document.body.appendChild(script);
  });
}

/* ==================================================
   API POST: hidden iframe + getPostResult
================================================== */

function adminApiPost(payload) {
  return new Promise((resolve, reject) => {
    const requestId =
      "admin_" +
      Date.now() +
      "_" +
      Math.random().toString(36).slice(2, 14);

    const actualPayload = {
      ...payload,
      requestId
    };

    let frame = document.getElementById("adminApiFrame");

    if (!frame) {
      frame = document.createElement("iframe");
      frame.id = "adminApiFrame";
      frame.name = "adminApiFrame";
      frame.hidden = true;
      document.body.appendChild(frame);
    }

    const form = document.createElement("form");

    form.method = "POST";
    form.action = API_URL;
    form.target = "adminApiFrame";
    form.hidden = true;

    const input = document.createElement("input");

    input.type = "hidden";
    input.name = "payload";
    input.value = JSON.stringify(actualPayload);

    form.appendChild(input);
    document.body.appendChild(form);

    let finished = false;
    let polling = false;

    const timeoutAt = Date.now() + 25000;

    const timeout = setTimeout(() => {
      finish();

      reject(
        new Error(
          "送信結果を確認できませんでした。ページを更新して状態を確認してください。"
        )
      );
    }, 25000);

    function finish() {
      if (finished) return;

      finished = true;

      clearTimeout(timeout);
      form.remove();
    }

    function schedulePoll() {
      if (finished) return;

      if (Date.now() >= timeoutAt) {
        finish();

        reject(
          new Error(
            "サーバーから処理結果が返ってきませんでした。"
          )
        );

        return;
      }

      setTimeout(checkResult, 1000);
    }

    async function checkResult() {
      if (finished || polling) return;

      polling = true;

      try {
        const result = await adminApiGet({
          action: "getPostResult",
          requestId: requestId
        });

        polling = false;

        // サーバー側で処理が完了していない場合は再確認
        if (
          result.pending === true ||
          result.found === false ||
          result.ready === false
        ) {
          schedulePoll();
          return;
        }

        // GAS側が結果を包んで返す形式にも対応
        const response =
          result.result ||
          result.data ||
          result;

        if (!response || response.ok === false) {
          finish();

          reject(
            new Error(
              response?.error ||
              "サーバー側の処理に失敗しました。"
            )
          );

          return;
        }

        finish();
        resolve(response);

      } catch (error) {
        polling = false;

        // 結果がまだ取得できない場合も、制限時間内は再確認する
        schedulePoll();
      }
    }

    try {
      // POST送信
      form.submit();

      // 結果の取得を開始
      schedulePoll();

    } catch (error) {
      finish();

      reject(
        new Error(
          "サーバーへの送信に失敗しました：" +
          error.message
        )
      );
    }
  });
}

/* ==================================================
   HELPERS
================================================== */

function byId(id) {
  return document.getElementById(id);
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[ch]);
}

function setMessage(id, message, type = "") {
  const element = byId(id);
  if (!element) return;

  element.textContent = message;
  element.className = "message" + (type ? " " + type : "");
}

function formatDate(value, withTime = false) {
  if (!value) return "未設定";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const options = withTime
    ? {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      }
    : {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      };

  return new Intl.DateTimeFormat("ja-JP", options).format(date);
}

function toDateTimeLocal(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = n => String(n).padStart(2, "0");

  return (
    date.getFullYear() +
    "-" + pad(date.getMonth() + 1) +
    "-" + pad(date.getDate()) +
    "T" + pad(date.getHours()) +
    ":" + pad(date.getMinutes())
  );
}

function localDateString(date = new Date()) {
  const pad = n => String(n).padStart(2, "0");

  return (
    date.getFullYear() +
    "-" + pad(date.getMonth() + 1) +
    "-" + pad(date.getDate())
  );
}

function eventIsOpen(event) {
  return (
    event.status !== "closed" &&
    new Date(event.deadline).getTime() > Date.now()
  );
}

function boolValue(value) {
  return value === true || String(value).toLowerCase() === "true";
}

function getChecked(id) {
  return Boolean(byId(id)?.checked);
}

function setChecked(id, value) {
  const element = byId(id);
  if (element) element.checked = boolValue(value);
}

/* ==================================================
   LOGIN / LOGOUT
================================================== */

async function loginAdmin() {
  const password = byId("adminPassword").value;

  if (!password) {
    setMessage("loginMessage", "パスワードを入力してください。", "error");
    return;
  }

  const button = byId("loginBtn");
  button.disabled = true;
  button.textContent = "ログイン中...";

  setMessage("loginMessage", "認証しています...");

  try {
    const result = await adminApiPost({
      action: "adminLogin",
      password
    });

    adminToken = result.token || "";

    if (!adminToken) {
      throw new Error("管理者トークンを取得できませんでした。");
    }

    byId("loginCard").hidden = true;
    byId("adminPanel").hidden = false;
    byId("adminPassword").value = "";

    setMessage("loginMessage", "");
    await loadAdminEvents();

  } catch (error) {
    setMessage("loginMessage", error.message, "error");

  } finally {
    button.disabled = false;
    button.textContent = "ログイン";
  }
}

function logoutAdmin() {
  adminToken = "";
  adminEvents = [];
  editingEventId = "";

  byId("adminPanel").hidden = true;
  byId("loginCard").hidden = false;
  byId("adminPassword").value = "";

  resetEventForm();
  setMessage("loginMessage", "ログアウトしました。", "success");
}

/* ==================================================
   LOAD EVENTS
================================================== */

async function loadAdminEvents() {
  setMessage("eventsMessage", "アンケートを読み込んでいます...");

  byId("reloadEventsBtn").disabled = true;

  try {
    const result = await adminApiPost({
      action: "adminListEvents",
      token: adminToken
    });

    adminEvents = Array.isArray(result.events)
      ? result.events
      : [];

    renderAdminEvents();
    renderSummaryEventOptions();

    setMessage(
      "eventsMessage",
      adminEvents.length + "件のアンケートを読み込みました。",
      "success"
    );

  } catch (error) {
    setMessage("eventsMessage", error.message, "error");

  } finally {
    byId("reloadEventsBtn").disabled = false;
  }
}

/* ==================================================
   RENDER EVENT LIST
================================================== */

function renderAdminEvents() {
  const container = byId("eventsList");
  const filter = byId("teamFilter").value;

  const filtered = adminEvents
    .filter(event => filter === "all" || event.team === filter)
    .sort((a, b) => {
      const dateA = String(a.date || "");
      const dateB = String(b.date || "");
      return dateA.localeCompare(dateB);
    });

  if (!filtered.length) {
    container.innerHTML =
      '<div class="empty">登録済みアンケートはありません。</div>';
    return;
  }

  container.innerHTML = filtered.map(event => {
    const open = eventIsOpen(event);

    const notificationLabels = [
      event.notifyCreate ? "作成通知ON" : "作成通知OFF",
      event.notifyReminder ? "5日前通知ON" : "5日前通知OFF",
      event.notifyDeadline ? "締切通知ON" : "締切通知OFF"
    ];

    const mentionLabels = [
      event.mentionCreate ? "作成メンションON" : "作成メンションOFF",
      event.mentionReminder ? "5日前メンションON" : "5日前メンションOFF",
      event.mentionDeadline ? "締切メンションON" : "締切メンションOFF"
    ];

    return `
      <article class="event-card">
        <div class="event-card-top">
          <div>
            <span class="team-pill">${escapeHTML(event.team)}</span>
            <h3 class="event-title">${escapeHTML(event.title)}</h3>
            <p class="event-meta">試合日：${escapeHTML(formatDate(event.date))}</p>
            <p class="event-meta">回答締切：${escapeHTML(formatDate(event.deadline, true))}</p>
            <p class="event-meta">回答数：${Number(event.responseCount || 0)}件</p>
          </div>

          <span class="status ${open ? "" : "closed"}">
            ${open ? "回答受付中" : "締切済み"}
          </span>
        </div>

        <p class="event-meta">${notificationLabels.map(escapeHTML).join(" ・ ")}</p>
        <p class="event-meta">${mentionLabels.map(escapeHTML).join(" ・ ")}</p>

        <div class="event-actions">
          <button
            type="button"
            class="btn secondary small-btn"
            data-edit="${escapeHTML(event.id)}"
          >編集</button>

          <button
            type="button"
            class="btn secondary small-btn"
            data-summary="${escapeHTML(event.id)}"
          >回答集計</button>

          <button
            type="button"
            class="btn danger small-btn"
            data-delete="${escapeHTML(event.id)}"
          >削除</button>
        </div>
      </article>
    `;
  }).join("");

  container.querySelectorAll("[data-edit]").forEach(button => {
    button.addEventListener("click", () => {
      const event = adminEvents.find(
        item => String(item.id) === button.dataset.edit
      );

      if (event) beginEditEvent(event);
    });
  });

  container.querySelectorAll("[data-summary]").forEach(button => {
    button.addEventListener("click", () => {
      byId("summaryEvent").value = button.dataset.summary;
      loadEventSummary();
      byId("summaryCard").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  });

  container.querySelectorAll("[data-delete]").forEach(button => {
    button.addEventListener("click", () => {
      deleteAdminEvent(button.dataset.delete);
    });
  });
}

/* ==================================================
   CREATE / EDIT FORM
================================================== */

function resetEventForm() {
  editingEventId = "";

  byId("eventForm").reset();
  byId("eventId").value = "";

  byId("formHeading").textContent = "アンケートを新規作成";
  byId("saveEventBtn").textContent = "アンケートを保存";
  byId("cancelEditBtn").hidden = true;

  // 新規作成のデフォルト
  setChecked("notifyCreate", true);
  setChecked("notifyReminder", true);
  setChecked("notifyDeadline", true);

  setChecked("mentionCreate", false);
  setChecked("mentionReminder", false);
  setChecked("mentionDeadline", false);

  byId("date").value = localDateString();

  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  future.setHours(23, 59, 0, 0);
  byId("deadline").value = toDateTimeLocal(future);

  setMessage("eventFormMessage", "");
}

function beginEditEvent(event) {
  editingEventId = String(event.id);

  byId("eventId").value = event.id;
  byId("team").value = event.team;
  byId("title").value = event.title;
  byId("date").value = String(event.date || "").slice(0, 10);
  byId("deadline").value = toDateTimeLocal(event.deadline);

  setChecked("notifyCreate", event.notifyCreate);
  setChecked("notifyReminder", event.notifyReminder);
  setChecked("notifyDeadline", event.notifyDeadline);

  setChecked("mentionCreate", event.mentionCreate);
  setChecked("mentionReminder", event.mentionReminder);
  setChecked("mentionDeadline", event.mentionDeadline);

  byId("formHeading").textContent = "アンケートを編集";
  byId("saveEventBtn").textContent = "変更を保存";
  byId("cancelEditBtn").hidden = false;

  setMessage(
    "eventFormMessage",
    "編集中：" + event.title,
    "success"
  );

  byId("eventFormCard").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function buildEventPayload() {
  const deadlineValue = byId("deadline").value;

  if (!deadlineValue) {
    throw new Error("回答締切日時を入力してください。");
  }

  const deadline = new Date(deadlineValue);

  if (Number.isNaN(deadline.getTime())) {
    throw new Error("回答締切日時が正しくありません。");
  }

  return {
    id: byId("eventId").value || "",
    team: byId("team").value,
    title: byId("title").value.trim(),
    date: byId("date").value,
    deadline: deadline.toISOString(),

    notifyCreate: getChecked("notifyCreate"),
    notifyReminder: getChecked("notifyReminder"),
    notifyDeadline: getChecked("notifyDeadline"),

    mentionCreate: getChecked("mentionCreate"),
    mentionReminder: getChecked("mentionReminder"),
    mentionDeadline: getChecked("mentionDeadline")
  };
}

async function saveAdminEvent(event) {
  event.preventDefault();

  if (!adminToken) {
    setMessage("eventFormMessage", "再ログインしてください。", "error");
    return;
  }

  let eventData;

  try {
    eventData = buildEventPayload();
  } catch (error) {
    setMessage("eventFormMessage", error.message, "error");
    return;
  }

  if (!eventData.title) {
    setMessage("eventFormMessage", "イベント名を入力してください。", "error");
    return;
  }

  if (!eventData.date) {
    setMessage("eventFormMessage", "試合日を入力してください。", "error");
    return;
  }

  if (new Date(eventData.deadline).getTime() <= Date.now()) {
    setMessage(
      "eventFormMessage",
      "回答締切は未来の日時に設定してください。",
      "error"
    );
    return;
  }

  const button = byId("saveEventBtn");
  button.disabled = true;
  button.textContent = "保存中...";

  setMessage("eventFormMessage", "保存しています...");

  try {
    const result = await adminApiPost({
      action: "adminSaveEvent",
      token: adminToken,
      event: eventData
    });

    setMessage(
      "eventFormMessage",
      editingEventId
        ? "アンケートを更新しました。"
        : "アンケートを作成しました。",
      "success"
    );

    resetEventForm();

    await loadAdminEvents();

    if (result.event?.id) {
      byId("summaryEvent").value = result.event.id;
    }

  } catch (error) {
    setMessage("eventFormMessage", error.message, "error");

  } finally {
    button.disabled = false;
    button.textContent = editingEventId
      ? "変更を保存"
      : "アンケートを保存";
  }
}

/* ==================================================
   DELETE EVENT
================================================== */

async function deleteAdminEvent(id) {
  const event = adminEvents.find(
    item => String(item.id) === String(id)
  );

  if (!event) {
    setMessage("eventsMessage", "対象のアンケートが見つかりません。", "error");
    return;
  }

  const confirmed = window.confirm(
    "「" + event.title + "」を削除しますか？\n\n" +
    "この操作では、アンケートとその回答データが削除されます。"
  );

  if (!confirmed) return;

  setMessage("eventsMessage", "削除しています...");

  try {
    await adminApiPost({
      action: "adminDeleteEvent",
      token: adminToken,
      id: id
    });

    setMessage("eventsMessage", "アンケートを削除しました。", "success");

    if (editingEventId === String(id)) {
      resetEventForm();
    }

    await loadAdminEvents();

    if (byId("summaryEvent").value === String(id)) {
      byId("summaryEvent").value = "";
      byId("summaryResult").innerHTML =
        '<div class="empty">アンケートを選択してください。</div>';
    }

  } catch (error) {
    setMessage("eventsMessage", error.message, "error");
  }
}

/* ==================================================
   SUMMARY
================================================== */

function renderSummaryEventOptions() {
  const select = byId("summaryEvent");
  const previousValue = select.value;

  const sorted = [...adminEvents].sort((a, b) =>
    String(b.date || "").localeCompare(String(a.date || ""))
  );

  select.innerHTML =
    '<option value="">アンケートを選択</option>' +
    sorted.map(event => `
      <option value="${escapeHTML(event.id)}">
        ${escapeHTML(event.team)}｜${escapeHTML(event.title)}｜${escapeHTML(event.date)}
      </option>
    `).join("");

  if (sorted.some(event => String(event.id) === previousValue)) {
    select.value = previousValue;
  }
}

async function loadEventSummary() {
  const eventId = byId("summaryEvent").value;

  if (!eventId) {
    setMessage("summaryMessage", "アンケートを選択してください。", "error");
    return;
  }

  byId("loadSummaryBtn").disabled = true;
  setMessage("summaryMessage", "集計を取得しています...");

  try {
    const result = await adminApiPost({
      action: "adminGetSummary",
      token: adminToken,
      eventId: eventId
    });

    renderSummary(result.summary);

    setMessage("summaryMessage", "集計を更新しました。", "success");

  } catch (error) {
    setMessage("summaryMessage", error.message, "error");

  } finally {
    byId("loadSummaryBtn").disabled = false;
  }
}

function renderSummary(summary) {
  const container = byId("summaryResult");

  if (!summary || !summary.event) {
    container.innerHTML =
      '<div class="empty">集計データを取得できませんでした。</div>';
    return;
  }

  const counts = summary.counts || {};
  const responses = Array.isArray(summary.responses)
    ? summary.responses
    : [];

  const yes = Number(counts["出場する"] || 0);
  const no = Number(counts["出場しない"] || 0);
  const maybe = Number(counts["人数次第"] || 0);

  const rows = responses.length
    ? responses.map(response => `
        <tr>
          <td>${escapeHTML(response.activityName)}</td>
          <td>${escapeHTML(response.attendance)}</td>
          <td>${escapeHTML(formatDate(response.updatedAt, true))}</td>
        </tr>
      `).join("")
    : `
        <tr>
          <td colspan="3" style="text-align:center;color:#999">
            まだ回答がありません。
          </td>
        </tr>
      `;

  container.innerHTML = `
    <div>
      <span class="team-pill">${escapeHTML(summary.event.team)}</span>
      <h3>${escapeHTML(summary.event.title)}</h3>
      <p class="muted small">
        試合日：${escapeHTML(formatDate(summary.event.date))}
        ／ 締切：${escapeHTML(formatDate(summary.event.deadline, true))}
      </p>
    </div>

    <div class="summary-grid">
      <div class="summary-box">
        <span>出場する</span>
        <strong>${yes}</strong>
      </div>
      <div class="summary-box">
        <span>出場しない</span>
        <strong>${no}</strong>
      </div>
      <div class="summary-box">
        <span>人数次第</span>
        <strong>${maybe}</strong>
      </div>
    </div>

    <p class="muted small">回答合計：${responses.length}件</p>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>活動名</th>
            <th>出場可否</th>
            <th>最終更新</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

/* ==================================================
   INITIALIZATION
================================================== */

document.addEventListener("DOMContentLoaded", () => {
  byId("loginBtn").addEventListener("click", loginAdmin);

  byId("adminPassword").addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      loginAdmin();
    }
  });

  byId("eventForm").addEventListener("submit", saveAdminEvent);

  byId("resetFormBtn").addEventListener("click", resetEventForm);
  byId("cancelEditBtn").addEventListener("click", resetEventForm);

  byId("reloadEventsBtn").addEventListener("click", loadAdminEvents);
  byId("teamFilter").addEventListener("change", renderAdminEvents);

  byId("loadSummaryBtn").addEventListener("click", loadEventSummary);
  byId("logoutBtn").addEventListener("click", logoutAdmin);

  resetEventForm();
});

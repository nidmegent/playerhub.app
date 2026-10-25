
/* ==================================================
   NIMDGENT ESPORTS | ADMIN
================================================== */

let adminToken = "";
let adminTeam = "LYXEN Div";
let adminEvents = [];

function adminPost(action, extra = {}) {
  return apiPost({ action, token: adminToken, ...extra });
}

function adminMessage(text, type = "") {
  const el = document.getElementById("eventMessage");
  if (!el) return;
  el.textContent = text;
  el.className = "message " + type;
}

function resetEventForm() {
  document.getElementById("eventForm").reset();
  document.getElementById("eventId").value = "";
  document.getElementById("formHeading").textContent = "アンケートを作成";
  document.getElementById("cancelEdit").hidden = true;
  document.getElementById("notifyCreate").checked = true;
  document.getElementById("notifyReminder").checked = true;
  document.getElementById("notifyDeadline").checked = true;
}

function fillEventForm(event) {
  document.getElementById("eventId").value = event.id;
  document.getElementById("eventTitle").value = event.title;
  document.getElementById("eventDate").value = event.date;
  document.getElementById("eventDeadline").value = event.deadline.slice(0, 16);
  document.getElementById("notifyCreate").checked = !!event.notifyCreate;
  document.getElementById("notifyReminder").checked = !!event.notifyReminder;
  document.getElementById("notifyDeadline").checked = !!event.notifyDeadline;
  document.getElementById("formHeading").textContent = "アンケートを編集";
  document.getElementById("cancelEdit").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function loadAdminEvents() {
  const result = await adminPost("adminListEvents");
  adminEvents = result.events || [];
  renderAdminEvents();
  renderSummaryOptions();
}

function renderAdminEvents() {
  const list = document.getElementById("adminEventList");
  const filtered = adminEvents
    .filter(event => event.team === adminTeam)
    .sort((a, b) => a.date.localeCompare(b.date));

  document.getElementById("adminListTitle").textContent =
    `${adminTeam} のアンケート`;

  if (!filtered.length) {
    list.innerHTML = '<p class="muted">まだアンケートはありません。</p>';
    return;
  }

  list.innerHTML = filtered.map(event => {
    const count = event.responseCount ?? "—";
    const closed = event.status === "closed" ||
      new Date(event.deadline).getTime() <= Date.now();

    return `
      <article class="admin-event">
        <div>
          <h3>${escapeHTML(event.title)}</h3>
          <p class="muted">${escapeHTML(formatDate(event.date))}</p>
          <p class="muted">締切：${escapeHTML(formatDate(event.deadline, true))}</p>
          <p class="muted">回答数：${count} ／ ${closed ? "締切済み" : "受付中"}</p>
        </div>
        <div class="admin-actions">
          <button class="secondary-button" data-edit="${escapeHTML(event.id)}">編集</button>
          <button class="secondary-button danger-button" data-delete="${escapeHTML(event.id)}">削除</button>
        </div>
      </article>`;
  }).join("");

  list.querySelectorAll("[data-edit]").forEach(button => {
    button.addEventListener("click", () => {
      const event = adminEvents.find(item => item.id === button.dataset.edit);
      if (event) fillEventForm(event);
    });
  });

  list.querySelectorAll("[data-delete]").forEach(button => {
    button.addEventListener("click", async () => {
      const event = adminEvents.find(item => item.id === button.dataset.delete);
      if (!event) return;
      if (!confirm(`「${event.title}」を削除しますか？\n回答データも削除されます。`)) return;

      try {
        await adminPost("adminDeleteEvent", { id: event.id });
        adminMessage("アンケートを削除しました。", "success");
        await loadAdminEvents();
      } catch (error) {
        adminMessage(error.message, "error");
      }
    });
  });
}

function renderSummaryOptions() {
  const select = document.getElementById("summaryEvent");
  const oldValue = select.value;
  const filtered = adminEvents.filter(event => event.team === adminTeam);

  select.innerHTML = '<option value="">アンケートを選択</option>' +
    filtered.map(event =>
      `<option value="${escapeHTML(event.id)}">${escapeHTML(event.title)} (${escapeHTML(event.date)})</option>`
    ).join("");

  if (filtered.some(event => event.id === oldValue)) select.value = oldValue;
}

async function loadSummary() {
  const eventId = document.getElementById("summaryEvent").value;
  const resultBox = document.getElementById("summaryResult");

  if (!eventId) {
    resultBox.innerHTML = '<p class="muted">アンケートを選択してください。</p>';
    return;
  }

  resultBox.innerHTML = '<p class="muted">集計中...</p>';

  try {
    const result = await adminPost("adminGetSummary", { eventId });
    const summary = result.summary;
    const rows = summary.responses || [];

    resultBox.innerHTML = `
      <div class="event-card">
        <div>
          <h3>出場する：${summary.counts["出場する"] || 0}人</h3>
          <p>出場しない：${summary.counts["出場しない"] || 0}人</p>
          <p>人数次第：${summary.counts["人数次第"] || 0}人</p>
          <p>回答合計：${rows.length}人</p>
        </div>
      </div>
      <div class="event-list">
        ${rows.map(row => `
          <article class="event-card">
            <div>
              <h3>${escapeHTML(row.activityName)}</h3>
              <p>${escapeHTML(row.attendance)}</p>
            </div>
          </article>`).join("")}
      </div>`;

  } catch (error) {
    resultBox.innerHTML = `<p class="message error">${escapeHTML(error.message)}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return;

  loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    const password = document.getElementById("adminPassword").value;
    const message = document.getElementById("loginMessage");
    message.textContent = "認証中...";

    try {
      const result = await apiPost({ action: "adminLogin", password });
      adminToken = result.token;
      document.getElementById("loginPanel").hidden = true;
      document.getElementById("adminContent").hidden = false;
      await loadAdminEvents();
    } catch (error) {
      message.className = "message error";
      message.textContent = error.message;
    }
  });

  document.querySelectorAll("#adminContent [data-team]").forEach(button => {
    button.addEventListener("click", async () => {
      adminTeam = button.dataset.team;
      document.querySelectorAll("#adminContent [data-team]").forEach(item => {
        item.classList.toggle("active", item === button);
      });
      resetEventForm();
      renderAdminEvents();
      renderSummaryOptions();
      document.getElementById("summaryResult").innerHTML =
        '<p class="muted">アンケートを選択してください。</p>';
    });
  });

  document.getElementById("eventForm").addEventListener("submit", async event => {
    event.preventDefault();
    const id = document.getElementById("eventId").value;
    const title = document.getElementById("eventTitle").value.trim();
    const date = document.getElementById("eventDate").value;
    const deadline = document.getElementById("eventDeadline").value;

    if (!title || !date || !deadline) {
      adminMessage("すべての必須項目を入力してください。", "error");
      return;
    }

    if (new Date(deadline).getTime() <= Date.now()) {
      adminMessage("締切日時は未来に設定してください。", "error");
      return;
    }

    try {
      await adminPost("adminSaveEvent", {
        event: {
          id, team: adminTeam, title, date,
          deadline: new Date(deadline).toISOString(),
          notifyCreate: document.getElementById("notifyCreate").checked,
          notifyReminder: document.getElementById("notifyReminder").checked,
          notifyDeadline: document.getElementById("notifyDeadline").checked
        }
      });
      adminMessage("保存しました。", "success");
      resetEventForm();
      await loadAdminEvents();
    } catch (error) {
      adminMessage(error.message, "error");
    }
  });

  document.getElementById("cancelEdit").addEventListener("click", resetEventForm);
  document.getElementById("refreshButton").addEventListener("click", async () => {
    try { await loadAdminEvents(); }
    catch (error) { adminMessage(error.message, "error"); }
  });
  document.getElementById("summaryEvent").addEventListener("change", loadSummary);

  document.getElementById("logoutButton").addEventListener("click", () => {
    adminToken = "";
    adminEvents = [];
    document.getElementById("adminContent").hidden = true;
    document.getElementById("loginPanel").hidden = false;
    document.getElementById("adminPassword").value = "";
    resetEventForm();
  });
});

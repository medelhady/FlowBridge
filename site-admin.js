const form = document.querySelector("#siteSettingsForm");
const message = document.querySelector("#adminMessage");
const previewButton = document.querySelector("#previewButton");
const resetButton = document.querySelector("#resetButton");
const adminLogin = document.querySelector("#adminLogin");
const adminLoginForm = document.querySelector("#adminLoginForm");
const loginMessage = document.querySelector("#loginMessage");
const logoutButton = document.querySelector("#logoutButton");
const adminEmailInput = document.querySelector("#adminEmail");
const adminPasswordInput = document.querySelector("#adminPassword");
const newAdminEmail = document.querySelector("#newAdminEmail");
const newAdminPassword = document.querySelector("#newAdminPassword");
const addAdminButton = document.querySelector("#addAdminButton");
const addAdminMessage = document.querySelector("#addAdminMessage");
const refreshAnalytics = document.querySelector("#refreshAnalytics");
const analyticsTotal = document.querySelector("#analyticsTotal");
const analyticsCountries = document.querySelector("#analyticsCountries");
const analyticsBeta = document.querySelector("#analyticsBeta");
const analyticsInstall = document.querySelector("#analyticsInstall");
const analyticsDownloads = document.querySelector("#analyticsDownloads");
const analyticsRows = document.querySelector("#analyticsRows");
const refreshWaitlist = document.querySelector("#refreshWaitlist");
const copyWaitlistEmails = document.querySelector("#copyWaitlistEmails");
const copyPendingEmails = document.querySelector("#copyPendingEmails");
const waitlistTotal = document.querySelector("#waitlistTotal");
const waitlistToday = document.querySelector("#waitlistToday");
const waitlistLatest = document.querySelector("#waitlistLatest");
const waitlistRows = document.querySelector("#waitlistRows");
const waitlistMessage = document.querySelector("#waitlistMessage");
const roadmapInput = document.querySelector("#roadmapInput");
const addRoadmapNote = document.querySelector("#addRoadmapNote");
const clearDoneNotes = document.querySelector("#clearDoneNotes");
const roadmapList = document.querySelector("#roadmapList");
const roadmapMessage = document.querySelector("#roadmapMessage");
const tabs = document.querySelectorAll(".admin-tab");
const panels = document.querySelectorAll(".admin-section");

const statusGate = document.querySelector("#statusGate");
const statusSeats = document.querySelector("#statusSeats");
const statusSolo = document.querySelector("#statusSolo");
const statusDuo = document.querySelector("#statusDuo");
const gateBadge = document.querySelector("#gateBadge");
const previewLaunchLabel = document.querySelector("#previewLaunchLabel");
const previewLaunchTitle = document.querySelector("#previewLaunchTitle");
const previewLaunchCopy = document.querySelector("#previewLaunchCopy");
const previewSeats = document.querySelector("#previewSeats");
const previewBar = document.querySelector("#previewBar");
const previewSolo = document.querySelector("#previewSolo");
const previewDuo = document.querySelector("#previewDuo");

const ADMIN_SESSION_KEY = "flowbridge_admin_signed_in";
const ADMIN_EMAIL_KEY = "flowbridge_admin_email";
const ADMIN_PASSWORD_KEY = "flowbridge_admin_password";
const DEFAULT_ROADMAP = [
  "When FlowBridge is sleeping, hide all Bridge buttons from code blocks immediately.",
  "Add a recognizable FlowBridge logo and match the tool colors with the coding website theme.",
  "Connect Resend later to email the beta download link automatically and mark waitlist emails as sent.",
  "Prevent running two bridge server instances at the same time.",
  "Add direct download from the website instead of relying on GitHub releases.",
  "Add launch offer progress: first 100 users at $39/year, with a slow live counter animation.",
];
let waitlistCache = [];
let roadmapNotes = [];

function setAdminVisible(isSignedIn) {
  adminLogin.hidden = isSignedIn;
  document.body.classList.toggle("admin-locked", !isSignedIn);
}

function checkAdminSession() {
  setAdminVisible(sessionStorage.getItem(ADMIN_SESSION_KEY) === "1");
}

function fillForm(settings) {
  Object.entries(settings).forEach(([key, value]) => {
    const field = form.elements[key];
    if (!field) return;
    if (field.type === "checkbox") {
      field.checked = Boolean(value);
      return;
    }
    field.value = value;
  });
  renderPreview();
}

function readForm() {
  const data = Object.fromEntries(new FormData(form).entries());
  data.betaGateEnabled = Boolean(form.elements.betaGateEnabled?.checked);
  data.launchClaimed = Number(data.launchClaimed || 0);
  data.launchTotal = Number(data.launchTotal || 100);
  return data;
}

function setMessage(text) {
  message.textContent = text;
}

function formatPrice(price, period) {
  return `${price || "$0"}${period}`;
}

function renderPreview() {
  const settings = {
    ...window.FLOWBRIDGE_SITE_DEFAULTS,
    ...readForm(),
  };

  const claimed = Number(settings.launchClaimed || 0);
  const total = Number(settings.launchTotal || 100);
  const percent = Math.min(100, Math.round((claimed / total) * 100));

  statusGate.textContent = settings.betaGateEnabled ? "On" : "Off";
  statusGate.style.color = settings.betaGateEnabled ? "#047857" : "";
  statusSeats.textContent = `${claimed} / ${total}`;
  statusSolo.textContent = formatPrice(settings.soloMonthly, "/mo");
  statusDuo.textContent = formatPrice(settings.duoMonthly, "/mo");

  gateBadge.textContent = settings.betaGateEnabled ? "On" : "Off";
  gateBadge.classList.toggle("on", settings.betaGateEnabled);

  previewLaunchLabel.textContent = settings.launchLabel;
  previewLaunchTitle.textContent = settings.launchTitle;
  previewLaunchCopy.textContent = settings.launchCopy;
  previewSeats.textContent = `${claimed} / ${total} claimed`;
  previewBar.style.width = `${percent}%`;
  previewSolo.innerHTML = `${settings.soloMonthly || "$9"} <small>/ mo</small>`;
  previewDuo.innerHTML = `${settings.duoMonthly || "$15"} <small>/ mo</small>`;
}

function showTab(tabId) {
  document.body.classList.toggle("wide-admin-panel", tabId === "analytics" || tabId === "waitlist");

  tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabId);
  });
  panels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === tabId);
  });
  if (tabId === "analytics") loadAnalytics();
  if (tabId === "waitlist") loadWaitlist();
  if (tabId === "roadmap") loadRoadmap();
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  })[char]);
}

function shortReferrer(value) {
  if (!value) return "Direct";
  try {
    return new URL(value).hostname;
  } catch (error) {
    return value;
  }
}

async function loadAnalytics() {
  if (!window.flowbridgeDb || !analyticsRows) return;

  analyticsRows.innerHTML = '<tr><td colspan="4">Loading visits...</td></tr>';

  const [
    visitsResult,
    totalResult,
    betaResult,
    installResult,
    downloadResult,
  ] = await Promise.all([
    window.flowbridgeDb
      .from("visitor_events")
      .select("created_at,page,country,city,region,referrer")
      .order("created_at", { ascending: false })
      .limit(120),
    window.flowbridgeDb
      .from("visitor_events")
      .select("id", { count: "exact", head: true }),
    window.flowbridgeDb
      .from("visitor_events")
      .select("id", { count: "exact", head: true })
      .eq("page", "/beta"),
    window.flowbridgeDb
      .from("visitor_events")
      .select("id", { count: "exact", head: true })
      .eq("page", "/install"),
    window.flowbridgeDb
      .from("visitor_events")
      .select("id", { count: "exact", head: true })
      .eq("page", "/download"),
  ]);

  const { data, error } = visitsResult;

  if (error || totalResult.error || betaResult.error || installResult.error || downloadResult.error) {
    analyticsRows.innerHTML = `<tr><td colspan="4">Could not load visitors: ${(error || totalResult.error || betaResult.error || installResult.error || downloadResult.error).message}</td></tr>`;
    return;
  }

  const rows = data || [];
  const countries = new Set(rows.map((row) => row.country).filter(Boolean));

  analyticsTotal.textContent = String(totalResult.count ?? rows.length);
  analyticsCountries.textContent = String(countries.size);
  analyticsBeta.textContent = String(betaResult.count ?? 0);
  analyticsInstall.textContent = String(installResult.count ?? 0);
  analyticsDownloads.textContent = String(downloadResult.count ?? 0);

  if (!rows.length) {
    analyticsRows.innerHTML = '<tr><td colspan="4">No visits yet.</td></tr>';
    return;
  }

  analyticsRows.innerHTML = rows.map((row) => {
    const location = [row.city, row.region, row.country].filter(Boolean).join(", ") || "Unknown";
    return `
      <tr>
        <td>${formatDate(row.created_at)}</td>
        <td>${row.page || "/"}</td>
        <td>${location}</td>
        <td>${shortReferrer(row.referrer)}</td>
      </tr>
    `;
  }).join("");
}

function isToday(value) {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

async function loadWaitlist() {
  if (!window.flowbridgeDb || !waitlistRows) return;

  waitlistRows.innerHTML = '<tr><td colspan="5">Loading waitlist...</td></tr>';

  const { data, error } = await window.flowbridgeDb
    .from("beta_waitlist")
    .select("id,email,source,status,sent_at,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    waitlistRows.innerHTML = `<tr><td colspan="5">Could not load waitlist: ${error.message}</td></tr>`;
    return;
  }

  waitlistCache = data || [];
  waitlistTotal.textContent = String(waitlistCache.length);
  waitlistToday.textContent = String(waitlistCache.filter((row) => isToday(row.created_at)).length);
  waitlistLatest.textContent = waitlistCache[0]?.created_at ? new Date(waitlistCache[0].created_at).toLocaleDateString() : "-";

  if (!waitlistCache.length) {
    waitlistRows.innerHTML = '<tr><td colspan="5">No waitlist emails yet.</td></tr>';
    return;
  }

  waitlistRows.innerHTML = waitlistCache.map((row) => {
    const status = row.status || "pending";
    const email = escapeHtml(row.email);
    return `
    <tr>
      <td>
        <div class="email-cell">
          <span>${email}</span>
          <button class="mini-action" type="button" data-copy-email="${email}">Copy</button>
        </div>
      </td>
      <td><span class="status-chip ${status}">${status}</span></td>
      <td>${escapeHtml(row.source || "beta_page")}</td>
      <td>${formatDate(row.created_at)}</td>
      <td class="waitlist-actions">
        <button class="table-action" type="button" data-resend-link="${email}">Resend link</button>
        ${status === "sent"
          ? `<span class="sent-time">${formatDate(row.sent_at)}</span>`
          : `<button class="table-action muted" type="button" data-mark-sent="${row.id}">Mark sent</button>`}
      </td>
    </tr>
  `;
  }).join("");
}

async function markWaitlistSent(id) {
  const { error } = await window.flowbridgeDb
    .from("beta_waitlist")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
    })
    .eq("id", id);

  waitlistMessage.textContent = error ? `Could not mark sent: ${error.message}` : "Marked as sent.";
  loadWaitlist();
}

async function resendBetaLink(email) {
  if (!email) return;

  waitlistMessage.textContent = `Sending beta link to ${email}...`;

  try {
    const response = await fetch("/api/send-beta-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || "Could not resend link.");
    }

    waitlistMessage.textContent = `Beta link sent to ${email}.`;
    loadWaitlist();
  } catch (error) {
    waitlistMessage.textContent = `Could not resend: ${error.message}`;
    loadWaitlist();
  }
}

function loadRoadmap() {
  const saved = localStorage.getItem(ROADMAP_KEY);
  if (saved) {
    roadmapNotes = JSON.parse(saved);
    return;
  }

  roadmapNotes = DEFAULT_ROADMAP.map((text, index) => ({
    id: `default-${index}`,
    text,
    done: false,
    createdAt: new Date().toISOString(),
  }));
  saveRoadmap();
}

function saveRoadmap() {
  localStorage.setItem(ROADMAP_KEY, JSON.stringify(roadmapNotes));
}

function renderRoadmap() {
  if (!roadmapList) return;

  if (!roadmapNotes.length) {
    roadmapList.innerHTML = '<div class="admin-note"><p>No roadmap notes yet.</p></div>';
    return;
  }

  roadmapList.innerHTML = roadmapNotes.map((note) => `
    <article class="roadmap-item ${note.done ? "done" : ""}">
      <input type="checkbox" data-roadmap-toggle="${note.id}" ${note.done ? "checked" : ""} aria-label="Mark note done" />
      <div>
        <strong>${note.text}</strong>
        <small>${note.done ? "Done" : "Open"} · ${new Date(note.createdAt).toLocaleDateString()}</small>
      </div>
      <button class="roadmap-delete" type="button" data-roadmap-delete="${note.id}">Remove</button>
    </article>
  `).join("");
}

function addNote() {
  const text = roadmapInput.value.trim();
  if (!text) return;

  roadmapNotes.unshift({
    id: `${Date.now()}`,
    text,
    done: false,
    createdAt: new Date().toISOString(),
  });
  roadmapInput.value = "";
  saveRoadmap();
  renderRoadmap();
  roadmapMessage.textContent = "Note added.";
}

function seedLocalRoadmap() {
  roadmapNotes = DEFAULT_ROADMAP.map((text, index) => ({
    id: `local-${index}`,
    text,
    done: false,
    created_at: new Date().toISOString(),
  }));
}

function renderRoadmapNoteDate(note) {
  return new Date(note.created_at || note.createdAt || Date.now()).toLocaleDateString();
}

function renderRoadmap() {
  if (!roadmapList) return;

  if (!roadmapNotes.length) {
    roadmapList.innerHTML = '<div class="admin-note"><p>No roadmap notes yet.</p></div>';
    return;
  }

  roadmapList.innerHTML = roadmapNotes.map((note) => `
    <article class="roadmap-item ${note.done ? "done" : ""}">
      <input type="checkbox" data-roadmap-toggle="${note.id}" ${note.done ? "checked" : ""} aria-label="Mark note done" />
      <div>
        <strong>${note.text}</strong>
        <small>${note.done ? "Done" : "Open"} - ${renderRoadmapNoteDate(note)}</small>
      </div>
      <button class="roadmap-delete" type="button" data-roadmap-delete="${note.id}">Remove</button>
    </article>
  `).join("");
}

async function loadRoadmap() {
  if (!roadmapList) return;

  roadmapList.innerHTML = '<div class="admin-note"><p>Loading roadmap notes...</p></div>';

  if (!window.flowbridgeDb) {
    seedLocalRoadmap();
    renderRoadmap();
    roadmapMessage.textContent = "Supabase is not connected. Showing starter notes only.";
    return;
  }

  const { data, error } = await window.flowbridgeDb
    .from("roadmap_notes")
    .select("id,text,done,created_at")
    .order("done", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    seedLocalRoadmap();
    renderRoadmap();
    roadmapMessage.textContent = "Roadmap table is not ready yet. Run the Supabase SQL first.";
    return;
  }

  if (!data.length) {
    await seedRoadmapDefaults();
    return;
  }

  roadmapNotes = data;
  roadmapMessage.textContent = "";
  renderRoadmap();
}

async function seedRoadmapDefaults() {
  const rows = DEFAULT_ROADMAP.map((text) => ({
    text,
    done: false,
  }));

  const { error } = await window.flowbridgeDb.from("roadmap_notes").insert(rows);
  if (error) {
    roadmapMessage.textContent = `Could not add starter notes: ${error.message}`;
    return;
  }

  loadRoadmap();
}

async function addNote() {
  const text = roadmapInput.value.trim();
  if (!text) return;

  if (!window.flowbridgeDb) {
    roadmapMessage.textContent = "Supabase is not connected.";
    return;
  }

  const { error } = await window.flowbridgeDb.from("roadmap_notes").insert({
    text,
    done: false,
  });

  if (error) {
    roadmapMessage.textContent = `Could not add note: ${error.message}`;
    return;
  }

  roadmapInput.value = "";
  roadmapMessage.textContent = "Note added.";
  loadRoadmap();
}

async function updateRoadmapDone(id, done) {
  const { error } = await window.flowbridgeDb
    .from("roadmap_notes")
    .update({ done })
    .eq("id", id);

  roadmapMessage.textContent = error ? `Could not update note: ${error.message}` : "";
  loadRoadmap();
}

async function removeRoadmapNote(id) {
  const { error } = await window.flowbridgeDb
    .from("roadmap_notes")
    .delete()
    .eq("id", id);

  roadmapMessage.textContent = error ? `Could not remove note: ${error.message}` : "Note removed.";
  loadRoadmap();
}

async function clearDoneRoadmapNotes() {
  const { error } = await window.flowbridgeDb
    .from("roadmap_notes")
    .delete()
    .eq("done", true);

  roadmapMessage.textContent = error ? `Could not clear done notes: ${error.message}` : "Done notes cleared.";
  loadRoadmap();
}

adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = adminEmailInput.value.trim().toLowerCase();
  const password = adminPasswordInput.value;

  loginMessage.textContent = "Checking...";

  if (!window.flowbridgeDb) {
    loginMessage.textContent = "Supabase is not connected.";
    return;
  }

  const { data, error } = await window.flowbridgeDb.rpc("admin_login", {
    admin_email: email,
    admin_password: password,
  });

  if (!error && data === true) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
    sessionStorage.setItem(ADMIN_EMAIL_KEY, email);
    sessionStorage.setItem(ADMIN_PASSWORD_KEY, password);
    loginMessage.textContent = "";
    adminLoginForm.reset();
    setAdminVisible(true);
    return;
  }

  loginMessage.textContent = "Email or password is incorrect.";
});

logoutButton.addEventListener("click", () => {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  sessionStorage.removeItem(ADMIN_EMAIL_KEY);
  sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
  setAdminVisible(false);
});

checkAdminSession();
loadRoadmap();

addAdminButton.addEventListener("click", async () => {
  const currentEmail = sessionStorage.getItem(ADMIN_EMAIL_KEY);
  const currentPassword = sessionStorage.getItem(ADMIN_PASSWORD_KEY);
  const email = newAdminEmail.value.trim().toLowerCase();
  const password = newAdminPassword.value;

  if (!email || !password) {
    addAdminMessage.textContent = "Add email and password first.";
    return;
  }

  addAdminButton.disabled = true;
  addAdminButton.textContent = "Adding...";
  addAdminMessage.textContent = "Saving admin...";

  const { data, error } = await window.flowbridgeDb.rpc("add_admin_user", {
    current_email: currentEmail,
    current_password: currentPassword,
    new_email: email,
    new_password: password,
  });

  addAdminButton.disabled = false;
  addAdminButton.textContent = "Add admin";

  if (error || data !== true) {
    addAdminMessage.textContent = error?.message || "Could not add admin.";
    return;
  }

  newAdminEmail.value = "";
  newAdminPassword.value = "";
  addAdminMessage.textContent = "Admin added successfully.";
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => showTab(tab.dataset.tab));
});

addRoadmapNote?.addEventListener("click", addNote);
roadmapInput?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  addNote();
});
clearDoneNotes?.addEventListener("click", () => {
  clearDoneRoadmapNotes();
});
roadmapList?.addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-roadmap-toggle]");
  const remove = event.target.closest("[data-roadmap-delete]");

  if (toggle) {
    updateRoadmapDone(toggle.dataset.roadmapToggle, toggle.checked);
  }

  if (remove) {
    removeRoadmapNote(remove.dataset.roadmapDelete);
  }
});

refreshAnalytics?.addEventListener("click", loadAnalytics);
refreshWaitlist?.addEventListener("click", loadWaitlist);
waitlistRows?.addEventListener("click", (event) => {
  const markButton = event.target.closest("[data-mark-sent]");
  const resendButton = event.target.closest("[data-resend-link]");
  const copyButton = event.target.closest("[data-copy-email]");

  if (markButton) {
    markWaitlistSent(markButton.dataset.markSent);
    return;
  }

  if (resendButton) {
    resendBetaLink(resendButton.dataset.resendLink);
    return;
  }

  if (copyButton) {
    navigator.clipboard.writeText(copyButton.dataset.copyEmail);
    waitlistMessage.textContent = "Email copied.";
  }
});

copyWaitlistEmails?.addEventListener("click", async () => {
  const emails = waitlistCache.map((row) => row.email).filter(Boolean).join(", ");
  if (!emails) {
    waitlistMessage.textContent = "No emails to copy yet.";
    return;
  }

  await navigator.clipboard.writeText(emails);
  waitlistMessage.textContent = "Waitlist emails copied.";
});

copyPendingEmails?.addEventListener("click", async () => {
  const emails = waitlistCache
    .filter((row) => (row.status || "pending") !== "sent")
    .map((row) => row.email)
    .filter(Boolean)
    .join(", ");

  if (!emails) {
    waitlistMessage.textContent = "No pending emails to copy.";
    return;
  }

  await navigator.clipboard.writeText(emails);
  waitlistMessage.textContent = "Pending emails copied.";
});

form.addEventListener("input", renderPreview);

window.addEventListener("flowbridge:settings-ready", (event) => {
  fillForm(event.detail);
});

previewButton.addEventListener("click", () => {
  localStorage.setItem("flowbridge_site_settings_preview", JSON.stringify(readForm()));
  setMessage("Preview saved on this browser. Refresh the site to see it.");
});

resetButton.addEventListener("click", () => {
  localStorage.removeItem("flowbridge_site_settings_preview");
  fillForm(window.FLOWBRIDGE_SITE_DEFAULTS);
  setMessage("Local preview reset.");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const content = readForm();
  localStorage.setItem("flowbridge_site_settings_preview", JSON.stringify(content));

  if (!window.flowbridgeDb) {
    setMessage("Saved locally. Supabase is not connected yet.");
    return;
  }

  setMessage("Saving...");
  const { error } = await window.flowbridgeDb
    .from("site_settings")
    .upsert({
      id: "main",
      content,
      updated_at: new Date().toISOString(),
    });

  setMessage(error ? `Local saved. Supabase error: ${error.message}` : "Saved live and locally.");
});

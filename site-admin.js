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
  tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabId);
  });
  panels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === tabId);
  });
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

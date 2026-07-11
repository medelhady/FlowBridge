const form = document.querySelector("#siteSettingsForm");
const message = document.querySelector("#adminMessage");
const previewButton = document.querySelector("#previewButton");
const resetButton = document.querySelector("#resetButton");
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

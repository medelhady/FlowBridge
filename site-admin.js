const form = document.querySelector("#siteSettingsForm");
const message = document.querySelector("#adminMessage");
const previewButton = document.querySelector("#previewButton");
const resetButton = document.querySelector("#resetButton");

function fillForm(settings) {
  Object.entries(settings).forEach(([key, value]) => {
    const field = form.elements[key];
    if (field) field.value = value;
  });
}

function readForm() {
  const data = Object.fromEntries(new FormData(form).entries());
  data.launchClaimed = Number(data.launchClaimed || 0);
  data.launchTotal = Number(data.launchTotal || 100);
  return data;
}

function setMessage(text) {
  message.textContent = text;
}

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

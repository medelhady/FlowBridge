window.FLOWBRIDGE_SITE_DEFAULTS = {
  launchLabel: "Limited beta launch",
  launchTitle: "First 100 users get FlowBridge for $39/year.",
  launchCopy: "Windows beta is open now with a 14-day trial. After the first 100 seats, yearly pricing returns to the regular plan.",
  launchClaimed: 34,
  launchTotal: 100,
  downloadUrl: "https://github.com/medelhady/FlowBridge/releases/download/beta-v1/FlowBridge-Beta-v1.zip",
  soloMonthly: "$9",
  soloYearly: "$90",
  duoMonthly: "$15",
  duoYearly: "$150",
  lifetimePrice: "$149",
  lifetimeCopy: "Launch offer: $99 for the first 50 users, then $149. Includes FlowBridge features, future updates for one device, and early access to security improvements.",
};

window.FLOWBRIDGE_SITE_SETTINGS = { ...window.FLOWBRIDGE_SITE_DEFAULTS };

function applyStoredSettings(settings) {
  window.FLOWBRIDGE_SITE_SETTINGS = {
    ...window.FLOWBRIDGE_SITE_DEFAULTS,
    ...(settings || {}),
  };
  window.dispatchEvent(new CustomEvent("flowbridge:settings-ready", {
    detail: window.FLOWBRIDGE_SITE_SETTINGS,
  }));
}

async function loadSiteSettings() {
  const localDraft = localStorage.getItem("flowbridge_site_settings_preview");
  if (localDraft) {
    try {
      applyStoredSettings(JSON.parse(localDraft));
    } catch (error) {
      applyStoredSettings();
    }
  } else {
    applyStoredSettings();
  }

  if (!window.flowbridgeDb) return;

  try {
    const { data, error } = await window.flowbridgeDb
      .from("site_settings")
      .select("content")
      .eq("id", "main")
      .maybeSingle();

    if (!error && data?.content) {
      applyStoredSettings(data.content);
    }
  } catch (error) {
    // Keep defaults/local preview if the remote settings table is not ready yet.
  }
}

loadSiteSettings();

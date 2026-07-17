window.FLOWBRIDGE_SITE_DEFAULTS = {
  betaGateEnabled: false,
  launchLabel: "Limited launch offer",
  launchTitle: "First 100 paid users get FlowBridge for $49/year.",
  launchCopy: "Start with a 7-day free trial. After the first 100 seats, yearly pricing returns to the regular plan.",
  launchClaimed: 34,
  launchTotal: 100,
  downloadUrl: "https://www.useflowbridge.com/download",
  soloMonthly: "$9",
  soloYearly: "$90",
  duoMonthly: "$15",
  duoYearly: "$150",
  lifetimePrice: "$149",
  lifetimeCopy: "Lock in lifetime access for one device, future updates, and early security improvements without another subscription.",
};

window.FLOWBRIDGE_SITE_SETTINGS = { ...window.FLOWBRIDGE_SITE_DEFAULTS };

function canUseLocalPreview() {
  return location.protocol === "file:"
    || location.hostname === "localhost"
    || location.hostname === "127.0.0.1";
}

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
  const localDraft = canUseLocalPreview()
    ? localStorage.getItem("flowbridge_site_settings_preview")
    : null;
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

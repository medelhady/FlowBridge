const billingButtons = document.querySelectorAll(".billing-option");
const plans = document.querySelectorAll(".plan");
const selectButtons = document.querySelectorAll(".plan-select");
const previewPlan = document.querySelector("#previewPlan");
const previewPrice = document.querySelector("#previewPrice");
const previewPeriod = document.querySelector("#previewPeriod");
const previewCopy = document.querySelector("#previewCopy");
const launchClaimed = document.querySelector(".launch-count strong");
const launchBar = document.querySelector(".progress-track span");
const launchLabel = document.querySelector(".launch-copy span");
const launchTitle = document.querySelector(".launch-copy h3");
const launchCopy = document.querySelector(".launch-copy p");
const launchTotal = document.querySelector(".launch-count small");
const downloadButtons = document.querySelectorAll('a[href*="FlowBridge-Beta-v1.zip"]');
const lifetimePrice = document.querySelector(".lifetime-offer strong");
const lifetimeCopy = document.querySelector(".lifetime-offer p");

let billing = "monthly";
let selectedPlan = "solo";
let settings = window.FLOWBRIDGE_SITE_SETTINGS || {};

let planDetails = {
  solo: {
    name: "Solo",
    devices: "1",
    monthly: { price: settings.soloMonthly || "$9", period: "/ mo" },
    yearly: { price: settings.soloYearly || "$90", period: "/ yr" },
    copy: {
      monthly: "Use FlowBridge on one device with every supported AI assistant and a 7-day free trial.",
      yearly: "Two months free for your first FlowBridge machine.",
    },
  },
  duo: {
    name: "Duo",
    devices: "2",
    monthly: { price: settings.duoMonthly || "$15", period: "/ mo" },
    yearly: { price: settings.duoYearly || "$150", period: "/ yr" },
    copy: {
      monthly: "Use FlowBridge across two active devices with priority support.",
      yearly: "Two months free for a two-device workflow.",
    },
  },
};

function updatePlanDetails(nextSettings) {
  settings = nextSettings || settings;
  planDetails = {
    ...planDetails,
    solo: {
      ...planDetails.solo,
      monthly: { price: settings.soloMonthly || "$9", period: "/ mo" },
      yearly: { price: settings.soloYearly || "$90", period: "/ yr" },
    },
    duo: {
      ...planDetails.duo,
      monthly: { price: settings.duoMonthly || "$15", period: "/ mo" },
      yearly: { price: settings.duoYearly || "$150", period: "/ yr" },
    },
  };
}

function applySiteSettings(nextSettings) {
  updatePlanDetails(nextSettings);

  if (settings.betaGateEnabled && !sessionStorage.getItem("flowbridge_view_full_site")) {
    window.location.href = "./beta.html";
    return;
  }

  if (launchLabel) launchLabel.textContent = settings.launchLabel;
  if (launchTitle) launchTitle.textContent = settings.launchTitle;
  if (launchCopy) launchCopy.textContent = settings.launchCopy;
  if (launchClaimed) launchClaimed.textContent = String(settings.launchClaimed || 34);
  if (launchTotal) launchTotal.textContent = `/ ${settings.launchTotal || 100} claimed`;
  if (launchBar) {
    const total = settings.launchTotal || 100;
    const claimed = settings.launchClaimed || 34;
    launchBar.style.width = `${Math.min(100, Math.round((claimed / total) * 100))}%`;
  }
  downloadButtons.forEach((button) => {
    button.href = settings.downloadUrl;
  });
  if (lifetimePrice) lifetimePrice.innerHTML = `${settings.lifetimePrice || "$149"}<small> one-time</small>`;
  if (lifetimeCopy) lifetimeCopy.textContent = settings.lifetimeCopy;

  refreshPricing();
}

function refreshPricing() {
  document.querySelectorAll("[data-monthly][data-yearly]").forEach((node) => {
    node.textContent = node.dataset[billing];
  });

  billingButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.billing === billing);
  });

  plans.forEach((plan) => {
    plan.classList.toggle("selected", plan.dataset.plan === selectedPlan);
  });

  const details = planDetails[selectedPlan];
  previewPlan.textContent = `${details.name} selected`;
  previewPrice.textContent = details[billing].price;
  previewPeriod.textContent = details[billing].period;
  previewCopy.textContent = details.copy[billing];
}

billingButtons.forEach((button) => {
  button.addEventListener("click", () => {
    billing = button.dataset.billing;
    refreshPricing();
  });
});

selectButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedPlan = button.dataset.plan;
    refreshPricing();
  });
});

plans.forEach((plan) => {
  plan.addEventListener("click", () => {
    selectedPlan = plan.dataset.plan;
    refreshPricing();
  });
});

refreshPricing();

function animateLaunchOffer() {
  if (!launchClaimed || !launchBar) return;

  const total = settings.launchTotal || 100;
  const start = Number(settings.launchClaimed || 34);
  const extraClaims = Math.random() > 0.45 ? 2 : 1;
  const target = Math.min(total, start + extraClaims);
  let current = start;

  launchClaimed.textContent = String(start);
  launchBar.style.width = `${Math.min(100, Math.round((start / total) * 100))}%`;

  setTimeout(() => {
    const timer = setInterval(() => {
      current += 1;
      launchClaimed.textContent = String(current);
      launchBar.style.width = `${Math.min(100, Math.round((current / total) * 100))}%`;

      if (current >= target) {
        clearInterval(timer);
      }
    }, 1800);
  }, 2600);
}

applySiteSettings(settings);
animateLaunchOffer();

window.addEventListener("flowbridge:settings-ready", (event) => {
  applySiteSettings(event.detail);
});

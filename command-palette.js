const billingButtons = document.querySelectorAll(".billing-option");
const plans = document.querySelectorAll(".plan");
const selectButtons = document.querySelectorAll(".plan-select");
const previewPlan = document.querySelector("#previewPlan");
const previewPrice = document.querySelector("#previewPrice");
const previewPeriod = document.querySelector("#previewPeriod");
const previewCopy = document.querySelector("#previewCopy");

let billing = "monthly";
let selectedPlan = "pro";

const planDetails = {
  starter: {
    name: "Starter",
    devices: "1",
    monthly: { price: "$6", period: "/ mo" },
    yearly: { price: "$60", period: "/ yr" },
    copy: {
      monthly: "Start small on one machine with every AI assistant connected.",
      yearly: "Two months free for your first FlowBridge machine.",
    },
  },
  pro: {
    name: "Pro",
    devices: "1",
    monthly: { price: "$9", period: "/ mo" },
    yearly: { price: "$90", period: "/ yr" },
    copy: {
      monthly: "Use FlowBridge daily with security controls, command history, and a 7-day free trial.",
      yearly: "Two months free for power users on one device.",
    },
  },
  duo: {
    name: "Duo",
    devices: "2",
    monthly: { price: "$15", period: "/ mo" },
    yearly: { price: "$150", period: "/ yr" },
    copy: {
      monthly: "Use FlowBridge across two active devices with priority support.",
      yearly: "Two months free for a two-device workflow.",
    },
  },
};

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

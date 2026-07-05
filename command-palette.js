const billingButtons = document.querySelectorAll(".billing-option");
const plans = document.querySelectorAll(".plan");
const selectButtons = document.querySelectorAll(".plan-select");
const previewPlan = document.querySelector("#previewPlan");
const previewPrice = document.querySelector("#previewPrice");
const previewPeriod = document.querySelector("#previewPeriod");
const previewCopy = document.querySelector("#previewCopy");

let billing = "monthly";
let selectedPlan = "starter";

const planDetails = {
  starter: {
    name: "Starter",
    devices: "1",
    monthly: { price: "$9", period: "/ mo" },
    yearly: { price: "$79", period: "/ yr" },
    copy: {
      monthly: "Bridge one local machine to Claude, ChatGPT, and Gemini with a 7-day free trial.",
      yearly: "One clean yearly payment for your main development machine, with $29 saved.",
    },
  },
  pro: {
    name: "Pro Duo",
    devices: "2",
    monthly: { price: "$12", period: "/ mo" },
    yearly: { price: "$99", period: "/ yr" },
    copy: {
      monthly: "Use FlowBridge across two active devices with priority support.",
      yearly: "Best value for working across two machines, with $45 saved.",
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

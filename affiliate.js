const referralRange = document.querySelector("#referralRange");
const paidUsers = document.querySelector("#paidUsers");
const estimatedPayout = document.querySelector("#estimatedPayout");
const payoutNote = document.querySelector("#payoutNote");
const bonusSteps = document.querySelectorAll(".bonus-step");

let previewPausedUntil = 0;
const annualSaleExample = 150;
const commissionRate = 0.3;

function calculatePayout(referrals) {
  return Math.round(referrals * annualSaleExample * commissionRate);
}

function updatePreview() {
  if (!referralRange || !paidUsers || !estimatedPayout) return;

  const referrals = Number(referralRange.value);
  const total = calculatePayout(referrals);

  paidUsers.textContent = referrals;
  estimatedPayout.textContent = `$${total}`;
  referralRange.style.setProperty(
    "--range-progress",
    `${((referrals - Number(referralRange.min)) / (Number(referralRange.max) - Number(referralRange.min))) * 100}%`
  );

  if (payoutNote) {
    payoutNote.textContent = "Real payouts are tracked automatically inside the Affonso partner portal.";
  }

  bonusSteps.forEach((step) => {
    const stepReferrals = Number(step.dataset.step);
    const stepValue = step.querySelector("strong");
    step.classList.toggle("active", referrals >= stepReferrals);

    if (stepValue) {
      stepValue.textContent = `$${calculatePayout(stepReferrals)}`;
    }
  });
}

if (referralRange) {
  referralRange.addEventListener("input", updatePreview);
  referralRange.addEventListener("pointerdown", () => {
    previewPausedUntil = Date.now() + 3500;
  });
  referralRange.addEventListener("keydown", () => {
    previewPausedUntil = Date.now() + 3500;
  });

  const movePreview = () => {
    if (Date.now() < previewPausedUntil) return;

    const min = Number(referralRange.min);
    const max = Number(referralRange.max);
    let nextValue = Number(referralRange.value) + 1;

    if (nextValue > max) {
      nextValue = min;
    }

    referralRange.value = String(nextValue);
    updatePreview();
  };

  setTimeout(movePreview, 700);
  setInterval(movePreview, 780);
}

updatePreview();

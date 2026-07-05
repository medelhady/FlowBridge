const referralRange = document.querySelector("#referralRange");
const paidUsers = document.querySelector("#paidUsers");
const estimatedPayout = document.querySelector("#estimatedPayout");
const payoutNote = document.querySelector("#payoutNote");
const payoutButtons = [document.querySelector("#openPayout"), document.querySelector("#openPayoutBottom")];
const bonusSteps = document.querySelectorAll(".bonus-step");
const payoutModal = document.querySelector("#payoutModal");

function calculatePayout(referrals) {
  let total = referrals * 5;
  if (referrals >= 10) total += 25;
  if (referrals >= 20) total += 50;
  return total;
}

function updatePreview() {
  const referrals = Number(referralRange.value);
  const total = calculatePayout(referrals);
  const unlocked = referrals >= 10;

  paidUsers.textContent = referrals;
  estimatedPayout.textContent = `$${total}`;
  payoutNote.textContent = unlocked
    ? "Payout unlocked. Add your PayPal to request payment."
    : `Payout unlocks after ${10 - referrals} more paid referral${10 - referrals === 1 ? "" : "s"}.`;

  bonusSteps.forEach((step) => {
    step.classList.toggle("active", referrals >= Number(step.dataset.step));
  });

  payoutButtons.forEach((button) => {
    button.disabled = !unlocked;
    button.classList.toggle("locked", !unlocked);
  });
}

payoutButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!button.disabled) payoutModal.showModal();
  });
});

referralRange.addEventListener("input", updatePreview);
updatePreview();

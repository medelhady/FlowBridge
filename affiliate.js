const referralRange = document.querySelector("#referralRange");
const paidUsers = document.querySelector("#paidUsers");
const estimatedPayout = document.querySelector("#estimatedPayout");
const payoutNote = document.querySelector("#payoutNote");
const payoutButtons = [document.querySelector("#openPayout"), document.querySelector("#openPayoutBottom")];
const bonusSteps = document.querySelectorAll(".bonus-step");
const payoutModal = document.querySelector("#payoutModal");
const joinModal = document.querySelector("#joinModal");
const openJoin = document.querySelector("#openJoin");
const submitAffiliate = document.querySelector("#submitAffiliate");
const affiliateResult = document.querySelector("#affiliateResult");
const submitPayout = document.querySelector("#submitPayout");
const db = window.flowbridgeDb;
let previewPausedUntil = 0;

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

openJoin.addEventListener("click", () => {
  affiliateResult.textContent = "";
  joinModal.showModal();
});

submitAffiliate.addEventListener("click", async (event) => {
  event.preventDefault();

  const name = document.querySelector("#affiliateName").value.trim();
  const email = document.querySelector("#affiliateEmail").value.trim().toLowerCase();

  if (!name || !email) {
    affiliateResult.textContent = "Add your name and email first.";
    return;
  }

  submitAffiliate.disabled = true;
  submitAffiliate.textContent = "Creating...";

  const referralCode = window.createReferralCode(email);
  const { error } = await db.from("affiliates").insert({
    name,
    email,
    referral_code: referralCode,
  });

  submitAffiliate.disabled = false;
  submitAffiliate.textContent = "Create account";

  if (error) {
    affiliateResult.textContent = error.code === "23505"
      ? "This email is already registered as an affiliate."
      : "Could not create the affiliate account. Try again.";
    return;
  }

  affiliateResult.textContent = `Account created. Your referral code is ${referralCode}`;
});

submitPayout.addEventListener("click", async (event) => {
  event.preventDefault();

  const paypalEmail = document.querySelector("#payoutPaypal").value.trim().toLowerCase();
  const referralCode = document.querySelector("#payoutCode").value.trim();

  if (!paypalEmail || !referralCode) return;

  submitPayout.disabled = true;
  submitPayout.textContent = "Submitting...";

  const { data: affiliate, error: affiliateError } = await db
    .from("affiliates")
    .select("id,total_earnings,paid_referrals")
    .eq("referral_code", referralCode)
    .single();

  if (affiliateError || !affiliate) {
    submitPayout.disabled = false;
    submitPayout.textContent = "Submit request";
    payoutNote.textContent = "Referral code not found.";
    return;
  }

  if (affiliate.paid_referrals < 10 || Number(affiliate.total_earnings) < 50) {
    submitPayout.disabled = false;
    submitPayout.textContent = "Submit request";
    payoutNote.textContent = "This affiliate has not reached the payout threshold yet.";
    return;
  }

  const { error } = await db.from("payout_requests").insert({
    affiliate_id: affiliate.id,
    paypal_email: paypalEmail,
    amount: affiliate.total_earnings,
  });

  submitPayout.disabled = false;
  submitPayout.textContent = "Submit request";
  payoutModal.close();
  payoutNote.textContent = error
    ? "Could not submit payout request. Try again."
    : "Payout request submitted successfully.";
});

referralRange.addEventListener("input", updatePreview);
referralRange.addEventListener("pointerdown", () => {
  previewPausedUntil = Date.now() + 5000;
});
referralRange.addEventListener("keydown", () => {
  previewPausedUntil = Date.now() + 5000;
});

setInterval(() => {
  if (Date.now() < previewPausedUntil) return;

  const min = Number(referralRange.min);
  const max = Number(referralRange.max);
  let nextValue = Number(referralRange.value) + 1;

  if (nextValue >= max) {
    nextValue = min;
  }

  referralRange.value = String(nextValue);
  updatePreview();
}, 380);

updatePreview();

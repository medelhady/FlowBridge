const lookupForm = document.querySelector("#lookupForm");
const lookupValue = document.querySelector("#lookupValue");
const lookupMessage = document.querySelector("#lookupMessage");
const dashboardContent = document.querySelector("#dashboardContent");
const payoutForm = document.querySelector("#dashboardPayoutForm");
const payoutButton = document.querySelector("#dashboardPayoutButton");
const db = window.flowbridgeDb;

let currentAffiliate = null;

function calculateEarnings(referrals) {
  let total = referrals * 5;
  if (referrals >= 10) total += 25;
  if (referrals >= 20) total += 50;
  return total;
}

function renderAffiliate(affiliate) {
  const referrals = affiliate.paid_referrals || 0;
  const earnings = Number(affiliate.total_earnings || calculateEarnings(referrals));
  const unlocked = referrals >= 10 && earnings >= 50;
  const code = affiliate.referral_code;
  const link = `${window.location.origin}/?ref=${encodeURIComponent(code)}`;
  const nextBonus = referrals >= 20 ? "Unlocked" : referrals >= 10 ? "20 referrals" : "10 referrals";
  const progressTarget = referrals >= 10 ? 20 : 10;
  const progress = Math.min((referrals / progressTarget) * 100, 100);

  document.querySelector("#partnerName").textContent = affiliate.name || "Affiliate";
  document.querySelector("#partnerEmail").textContent = affiliate.email;
  document.querySelector("#referralLink").textContent = link;
  document.querySelector("#dashReferrals").textContent = referrals;
  document.querySelector("#dashEarnings").textContent = `$${earnings.toLocaleString()}`;
  document.querySelector("#dashNextBonus").textContent = nextBonus;
  document.querySelector("#dashPayoutStatus").textContent = unlocked ? "Unlocked" : "Locked";
  document.querySelector("#progressText").textContent = `${referrals} / ${progressTarget}`;
  document.querySelector("#progressBar").style.width = `${progress}%`;
  document.querySelector("#payoutHelp").textContent = unlocked
    ? "Your payout is unlocked. Add your PayPal email to request payment."
    : "Payout unlocks after 10 paid referrals and at least $50 in eligible earnings.";

  payoutButton.disabled = !unlocked;
  dashboardContent.hidden = false;
}

lookupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const value = lookupValue.value.trim();
  if (!value) return;

  lookupMessage.textContent = "Loading dashboard...";

  const column = value.includes("@") ? "email" : "referral_code";
  const { data, error } = await db.from("affiliates").select("*").eq(column, value).single();

  if (error || !data) {
    lookupMessage.textContent = "Affiliate account not found.";
    dashboardContent.hidden = true;
    return;
  }

  currentAffiliate = data;
  lookupMessage.textContent = "Dashboard loaded.";
  renderAffiliate(data);
});

document.querySelector("#copyLink").addEventListener("click", async () => {
  const link = document.querySelector("#referralLink").textContent;
  await navigator.clipboard.writeText(link);
  document.querySelector("#copyLink").textContent = "Copied";
  window.setTimeout(() => {
    document.querySelector("#copyLink").textContent = "Copy link";
  }, 1200);
});

payoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentAffiliate) return;

  const paypalEmail = document.querySelector("#dashboardPaypal").value.trim().toLowerCase();
  const amount = Number(currentAffiliate.total_earnings || calculateEarnings(currentAffiliate.paid_referrals || 0));

  payoutButton.disabled = true;
  payoutButton.textContent = "Submitting...";

  const { error } = await db.from("payout_requests").insert({
    affiliate_id: currentAffiliate.id,
    paypal_email: paypalEmail,
    amount,
  });

  payoutButton.textContent = error ? "Try again" : "Request submitted";
  if (!error) document.querySelector("#payoutHelp").textContent = "Your payout request was submitted.";
});

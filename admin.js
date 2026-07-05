const navButtons = document.querySelectorAll(".side-nav button");
const panels = document.querySelectorAll(".panel");
const saveButton = document.querySelector("#saveChanges");
const toast = document.querySelector("#toast");
const db = window.flowbridgeDb;

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    navButtons.forEach((item) => item.classList.remove("active"));
    panels.forEach((panel) => panel.classList.remove("active"));

    button.classList.add("active");
    document.querySelector(`#${button.dataset.panel}`).classList.add("active");
  });
});

saveButton.addEventListener("click", () => {
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1800);
});

async function getCount(table, filter) {
  let query = db.from(table).select("*", { count: "exact", head: true });
  if (filter) query = filter(query);
  const { count } = await query;
  return count || 0;
}

async function loadAdminStats() {
  const [profiles, paidUsers, affiliates, pendingPayouts] = await Promise.all([
    getCount("profiles"),
    getCount("profiles", (query) => query.eq("is_paid", true)),
    getCount("affiliates"),
    getCount("payout_requests", (query) => query.eq("status", "pending")),
  ]);

  document.querySelector("#registeredUsers").textContent = profiles.toLocaleString();
  document.querySelector("#paidSubscribers").textContent = paidUsers.toLocaleString();
  document.querySelector("#monthlyRevenue").textContent = `$${(paidUsers * 11).toLocaleString()}`;
  document.querySelector("#affiliateRevenue").textContent = `$${(affiliates * 25).toLocaleString()}`;

  const { data } = await db
    .from("payout_requests")
    .select("id,paypal_email,amount,status,affiliates(name,referral_code,paid_referrals)")
    .order("created_at", { ascending: false })
    .limit(5);

  if (!data || data.length === 0) return;

  const table = document.querySelector("#payoutTable");
  table.querySelectorAll(".table-row:not(.table-head)").forEach((row) => row.remove());

  data.forEach((request) => {
    const affiliate = request.affiliates || {};
    const row = document.createElement("div");
    row.className = "table-row";
    row.innerHTML = `
      <span>${affiliate.name || affiliate.referral_code || request.paypal_email}</span>
      <span>${affiliate.paid_referrals || 0}</span>
      <span>$${Number(request.amount).toLocaleString()}</span>
      <span class="status ${request.status === "paid" ? "paid" : "pending"}">${request.status}</span>
      <button ${request.status === "paid" ? "disabled" : ""}>${request.status === "paid" ? "Paid" : "Approve"}</button>
    `;
    table.appendChild(row);
  });
}

loadAdminStats();

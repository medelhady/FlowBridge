const supabaseConfig = window.FLOWBRIDGE_SUPABASE;

window.flowbridgeDb = window.supabase.createClient(
  supabaseConfig.url,
  supabaseConfig.anonKey
);

window.createReferralCode = function createReferralCode(email) {
  const namePart = email.split("@")[0].replace(/[^a-z0-9]/gi, "").slice(0, 8);
  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `FB-${namePart || "AFF"}-${randomPart}`;
};

const fallbackDownloadUrl = "https://github.com/medelhady/FlowBridge/releases/download/beta-v1/FlowBridge-Beta-v1.1-native-launcher.zip";
const directDownload = document.querySelector("#directDownload");

if (directDownload) {
  directDownload.href = fallbackDownloadUrl;
}

async function trackDownloadClick() {
  if (!window.flowbridgeDb) return;

  const sessionKey = "flowbridge_visit_session";
  const existingSession = sessionStorage.getItem(sessionKey);
  const sessionId = existingSession || crypto.randomUUID();
  sessionStorage.setItem(sessionKey, sessionId);

  await window.flowbridgeDb.from("visitor_events").insert({
    session_id: sessionId,
    page: "/beta-download",
    url: location.href,
    referrer: document.referrer || null,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    user_agent: navigator.userAgent,
  });
}

trackDownloadClick().finally(() => {
  setTimeout(() => {
    location.href = fallbackDownloadUrl;
  }, 900);
});

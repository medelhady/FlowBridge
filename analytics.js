async function getVisitorGeo() {
  try {
    const response = await fetch("https://ipapi.co/json/", { cache: "no-store" });
    if (!response.ok) return {};
    const data = await response.json();
    return {
      ip: data.ip,
      country: data.country_name,
      country_code: data.country_code,
      city: data.city,
      region: data.region,
    };
  } catch (error) {
    return {};
  }
}

async function trackVisit() {
  if (!window.flowbridgeDb) return;

  const sessionKey = "flowbridge_visit_session";
  const existingSession = sessionStorage.getItem(sessionKey);
  const sessionId = existingSession || crypto.randomUUID();
  sessionStorage.setItem(sessionKey, sessionId);

  const geo = await getVisitorGeo();
  const page = location.pathname.replace(/\/$/, "") || "/";

  await window.flowbridgeDb.from("visitor_events").insert({
    session_id: sessionId,
    page,
    url: location.href,
    referrer: document.referrer || null,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    user_agent: navigator.userAgent,
    ...geo,
  });
}

trackVisit();

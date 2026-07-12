const SUPABASE_URL = "https://sztjlrowzagweqwhvgpm.supabase.co";
const WAITLIST_TABLE = "beta_waitlist";

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function saveWaitlistEmail(email, status, sentAt = null) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${WAITLIST_TABLE}?on_conflict=email`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      email,
      source: "beta_page",
      status,
      sent_at: sentAt,
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

async function sendEmail(email) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    throw new Error("Missing RESEND_API_KEY");
  }

  const downloadUrl = process.env.FLOWBRIDGE_BETA_DOWNLOAD_URL
    || "https://github.com/medelhady/FlowBridge/releases/download/beta-v1/FlowBridge-Beta-v1.zip";
  const fromEmail = process.env.FLOWBRIDGE_FROM_EMAIL || "FlowBridge <onboarding@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: email,
      subject: "Your FlowBridge beta link",
      html: `
        <div style="font-family:Inter,Arial,sans-serif;line-height:1.55;color:#0f172a;max-width:560px;margin:auto;padding:28px">
          <h1 style="font-size:24px;margin:0 0 12px">Your FlowBridge beta is ready</h1>
          <p>Thanks for helping test FlowBridge. Your feedback will shape the public launch.</p>
          <p>
            <a href="${downloadUrl}" style="display:inline-block;background:#101827;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">
              Download FlowBridge Beta
            </a>
          </p>
          <p style="color:#64748b;font-size:14px">If the button does not work, copy this link:<br>${downloadUrl}</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

function send(res, payload, status = 200) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.status(status).send(JSON.stringify(payload));
}

function readBody(request) {
  if (!request.body) return {};
  if (typeof request.body === "string") {
    return JSON.parse(request.body || "{}");
  }
  return request.body;
}

module.exports = async function handler(request, response) {
  if (request.method === "OPTIONS") {
    send(response, {});
    return;
  }

  if (request.method !== "POST") {
    send(response, { error: "Method not allowed" }, 405);
    return;
  }

  try {
    const body = readBody(request);
    const email = String(body.email || "").trim().toLowerCase();

    if (!isEmail(email)) {
      send(response, { error: "Invalid email" }, 400);
      return;
    }

    await saveWaitlistEmail(email, "pending");
    await sendEmail(email);
    await saveWaitlistEmail(email, "sent", new Date().toISOString());

    send(response, { ok: true });
  } catch (error) {
    send(response, { error: error.message || "Could not send beta link" }, 500);
  }
};

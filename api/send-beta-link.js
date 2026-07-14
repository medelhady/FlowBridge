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

  const downloadUrl = process.env.BETA_DOWNLOAD_URL
    || process.env.FLOWBRIDGE_BETA_DOWNLOAD_URL
    || "https://github.com/medelhady/FlowBridge/releases/download/beta-v1/FlowBridge-Beta-v1.zip";
  const installUrl = process.env.INSTALL_GUIDE_URL || "https://useflowbridge.com/install";
  const fromEmail = process.env.FROM_EMAIL
    || process.env.FLOWBRIDGE_FROM_EMAIL
    || "FlowBridge <support@useflowbridge.com>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: email,
      reply_to: "support@useflowbridge.com",
      subject: "Your FlowBridge beta link",
      text: `Your FlowBridge beta is ready.\n\nDownload it here:\n${downloadUrl}\n\nInstallation guide:\n${installUrl}\n\nWindows may show SmartScreen because this beta is not code-signed yet. Click More info, then Run anyway.\n\nThanks for helping test FlowBridge.\n\nFlowBridge Support\nsupport@useflowbridge.com`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;line-height:1.55;color:#0f172a;max-width:620px;margin:auto;padding:28px;background:#f8fafc">
          <div style="background:white;border:1px solid #e2e8f0;border-radius:18px;padding:28px;box-shadow:0 18px 50px rgba(15,23,42,.08)">
          <p style="margin:0 0 8px;color:#2563eb;font-size:12px;font-weight:800;text-transform:uppercase">FlowBridge private beta</p>
          <h1 style="font-size:26px;line-height:1.1;margin:0 0 14px;color:#07111f">Your beta download is ready</h1>
          <p style="margin:0 0 18px">Thanks for helping test FlowBridge. Your honest feedback will shape the public launch.</p>
          <p>
            <a href="${downloadUrl}" style="display:inline-block;background:#101827;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">
              Download FlowBridge Beta
            </a>
            <a href="${installUrl}" style="display:inline-block;margin-left:8px;background:#e0f2fe;color:#075985;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">
              How to install
            </a>
          </p>
          <div style="margin:18px 0 0;padding:14px;border:1px solid #bae6fd;border-radius:12px;background:#f0f9ff;color:#0f172a;font-size:14px">
            <strong>Windows note:</strong> If SmartScreen appears, click <strong>More info</strong>, then <strong>Run anyway</strong>. This happens because the beta is not code-signed yet.
          </div>
          <p style="color:#64748b;font-size:14px;margin:20px 0 0">If the button does not work, copy this link:<br><a href="${downloadUrl}" style="color:#0f766e">${downloadUrl}</a></p>
          <p style="color:#64748b;font-size:14px;margin:14px 0 0">Install guide:<br><a href="${installUrl}" style="color:#0f766e">${installUrl}</a></p>
          <p style="color:#64748b;font-size:13px;margin:22px 0 0">Need help? Reply to this email or contact support@useflowbridge.com.</p>
          </div>
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
    try {
      await sendEmail(email);
      await saveWaitlistEmail(email, "sent", new Date().toISOString());
    } catch (emailError) {
      await saveWaitlistEmail(email, "failed");
      throw emailError;
    }

    send(response, { ok: true });
  } catch (error) {
    send(response, { error: error.message || "Could not send beta link" }, 500);
  }
};

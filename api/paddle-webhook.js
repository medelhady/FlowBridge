const crypto = require("crypto");
const SUPABASE_URL = "https://sztjlrowzagweqwhvgpm.supabase.co";
const WEBHOOK_LOGS_TABLE = "paddle_webhook_logs";

function send(response, payload, status = 200) {
  response.setHeader("Content-Type", "application/json");
  response.status(status).send(JSON.stringify(payload));
}

function readRawBody(request) {
  return new Promise((resolve, reject) => {
    if (typeof request.body === "string") {
      resolve(request.body);
      return;
    }

    const chunks = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function parseSignature(header) {
  return String(header || "")
    .split(";")
    .reduce((parts, item) => {
      const [key, value] = item.split("=");
      if (key && value) parts[key.trim()] = value.trim();
      return parts;
    }, {});
}

function verifyPaddleSignature(rawBody, signatureHeader) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("Missing PADDLE_WEBHOOK_SECRET");
  }

  const signature = parseSignature(signatureHeader);
  if (!signature.ts || !signature.h1) {
    throw new Error("Missing Paddle signature");
  }

  const signedPayload = `${signature.ts}:${rawBody}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  const received = Buffer.from(signature.h1, "hex");
  const calculated = Buffer.from(expected, "hex");

  if (received.length !== calculated.length || !crypto.timingSafeEqual(received, calculated)) {
    throw new Error("Invalid Paddle signature");
  }
}

function findCustomerEmail(event) {
  const data = event && event.data ? event.data : {};
  return [
    data.customer && data.customer.email,
    data.customer && data.customer.email_address,
    data.customer_email,
    data.email,
    data.checkout && data.checkout.customer && data.checkout.customer.email,
    data.custom_data && data.custom_data.email,
  ].find(Boolean);
}

function findCustomerId(event) {
  const data = event && event.data ? event.data : {};
  return [
    data.customer_id,
    data.customer && data.customer.id,
    data.customer && data.customer.customer_id,
  ].find(Boolean);
}

async function saveWebhookLog(payload) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return;
  }

  await fetch(`${SUPABASE_URL}/rest/v1/${WEBHOOK_LOGS_TABLE}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

async function fetchCustomerEmail(customerId) {
  const paddleKey = process.env.PADDLE_API_KEY;
  if (!customerId || !paddleKey) {
    return null;
  }

  const response = await fetch(`https://api.paddle.com/customers/${customerId}`, {
    headers: {
      Authorization: `Bearer ${paddleKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Could not fetch Paddle customer: ${await response.text()}`);
  }

  const payload = await response.json();
  return payload && payload.data ? payload.data.email : null;
}

async function sendPurchaseEmail(email) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    throw new Error("Missing RESEND_API_KEY");
  }

  const trackedDownloadUrl = process.env.TRACKED_DOWNLOAD_URL || "https://useflowbridge.com/download";
  const installUrl = process.env.INSTALL_GUIDE_URL || "https://useflowbridge.com/install";
  const fromEmail = process.env.FROM_EMAIL || "FlowBridge <support@useflowbridge.com>";

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
      subject: "Your FlowBridge download is ready",
      text: `Welcome to FlowBridge.\n\nDownload FlowBridge:\n${trackedDownloadUrl}\n\nInstall guide:\n${installUrl}\n\nAfter download, extract the ZIP and open Install FlowBridge.bat.\n\nWindows may show an Unknown Publisher warning because this beta installer is not code-signed yet. Click Run to continue. If SmartScreen appears instead, click More info, then Run anyway.\n\nNeed help? Reply to this email or contact support@useflowbridge.com.`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;line-height:1.55;color:#0f172a;max-width:620px;margin:auto;padding:28px;background:#f8fafc">
          <div style="background:white;border:1px solid #e2e8f0;border-radius:18px;padding:28px;box-shadow:0 18px 50px rgba(15,23,42,.08)">
            <p style="margin:0 0 8px;color:#2563eb;font-size:12px;font-weight:800;text-transform:uppercase">FlowBridge access</p>
            <h1 style="font-size:26px;line-height:1.1;margin:0 0 14px;color:#07111f">Your FlowBridge download is ready</h1>
            <p style="margin:0 0 18px">Thanks for joining FlowBridge. Start with the download, then follow the short install guide.</p>
            <p>
              <a href="${trackedDownloadUrl}" style="display:inline-block;background:#101827;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">
                Download FlowBridge
              </a>
              <a href="${installUrl}" style="display:inline-block;margin-left:8px;background:#e0f2fe;color:#075985;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">
                How to install
              </a>
            </p>
            <div style="margin:18px 0 0;padding:14px;border:1px solid #bae6fd;border-radius:12px;background:#f0f9ff;color:#0f172a;font-size:14px">
              <strong>Install note:</strong> After download, extract the ZIP and open <strong>Install FlowBridge.bat</strong>. If Windows shows <strong>Unknown Publisher</strong>, click <strong>Run</strong>. If SmartScreen appears instead, click <strong>More info</strong>, then <strong>Run anyway</strong>.
            </div>
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

async function handler(request, response) {
  if (request.method !== "POST") {
    send(response, { error: "Method not allowed" }, 405);
    return;
  }

  try {
    const rawBody = await readRawBody(request);
    verifyPaddleSignature(rawBody, request.headers["paddle-signature"]);

    const event = JSON.parse(rawBody || "{}");
    const eventType = event.event_type || "unknown";
    const customerId = findCustomerId(event) || null;
    const allowedEvents = new Set([
      "transaction.completed",
      "transaction.paid",
      "subscription.created",
      "subscription.activated",
    ]);

    if (!allowedEvents.has(eventType)) {
      await saveWebhookLog({
        status: "ignored",
        event_type: eventType,
        customer_id: customerId,
        message: "Event type ignored",
      });
      send(response, { ok: true, ignored: eventType });
      return;
    }

    let email = findCustomerEmail(event);
    if (!email) {
      email = await fetchCustomerEmail(customerId);
    }

    if (!email) {
      await saveWebhookLog({
        status: "skipped",
        event_type: eventType,
        customer_id: customerId,
        message: "Customer email not found",
      });
      send(response, { ok: true, skipped: "customer email not found" });
      return;
    }

    await sendPurchaseEmail(String(email).trim().toLowerCase());
    await saveWebhookLog({
      status: "sent",
      event_type: eventType,
      customer_id: customerId,
      email: String(email).trim().toLowerCase(),
      message: "Purchase email sent",
    });
    send(response, { ok: true });
  } catch (error) {
    await saveWebhookLog({
      status: "failed",
      message: error.message || "Webhook failed",
    });
    send(response, { error: error.message || "Webhook failed" }, 400);
  }
}

module.exports = handler;
module.exports.config = {
  api: {
    bodyParser: false,
  },
};

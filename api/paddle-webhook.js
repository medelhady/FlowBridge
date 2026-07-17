const crypto = require("crypto");
const SUPABASE_URL = "https://sztjlrowzagweqwhvgpm.supabase.co";
const WEBHOOK_LOGS_TABLE = "paddle_webhook_logs";
const LICENSES_TABLE = "license_keys";

const PRICE_PLANS = {
  pri_01kxg9hparr886d3qk06cmt1pz: { plan: "solo", billing: "monthly", devices: 1 },
  pri_01kxgdasy6ttq8tjh3g084c699: { plan: "solo", billing: "yearly", devices: 1 },
  pri_01kxqz8pxkd5kgbbsx6yf4j996: { plan: "solo", billing: "launch-yearly", devices: 1 },
  pri_01kxgdtfrz4dkcmtex46s19p6w: { plan: "duo", billing: "monthly", devices: 2 },
  pri_01kxgdw20df49am0jrmv33s6fd: { plan: "duo", billing: "yearly", devices: 2 },
};

const TRIAL_DAYS = 7;

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

function findTransactionId(event) {
  const data = event && event.data ? event.data : {};
  return [
    data.id,
    data.transaction_id,
    data.checkout && data.checkout.transaction_id,
  ].find(Boolean);
}

function findPurchasedPlan(event) {
  const data = event && event.data ? event.data : {};
  const priceIds = [];
  const items = data.items || data.details && data.details.line_items || [];

  if (Array.isArray(items)) {
    items.forEach((item) => {
      const priceId = item.price_id || item.price && item.price.id;
      if (priceId) priceIds.push(priceId);
    });
  }

  const directPriceId = data.price_id || data.custom_data && data.custom_data.price_id;
  if (directPriceId) priceIds.push(directPriceId);

  const matchedPriceId = priceIds.find((priceId) => PRICE_PLANS[priceId]);
  return matchedPriceId
    ? { priceId: matchedPriceId, ...PRICE_PLANS[matchedPriceId] }
    : { priceId: priceIds[0] || null, plan: "solo", billing: "unknown", devices: 1 };
}

function generateLicenseKey() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(20);
  let raw = "";

  for (let index = 0; index < 20; index += 1) {
    raw += alphabet[bytes[index] % alphabet.length];
  }

  return `FB-${raw.match(/.{1,4}/g).join("-")}`;
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

async function createLicense(email, customerId, transactionId, planInfo) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  const licenseKey = generateLicenseKey();
  const payload = {
    license_key: licenseKey,
    email,
    customer_id: customerId,
    transaction_id: transactionId,
    price_id: planInfo.priceId,
    plan: planInfo.plan,
    billing: planInfo.billing,
    device_limit: planInfo.devices,
    trial_days: TRIAL_DAYS,
    active: true,
  };

  async function insertLicense(insertPayload) {
    return await fetch(`${SUPABASE_URL}/rest/v1/${LICENSES_TABLE}`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(insertPayload),
    });
  }

  let response = await insertLicense(payload);

  if (!response.ok) {
    const message = await response.text();

    if (message.includes("trial_days")) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.trial_days;
      response = await insertLicense(fallbackPayload);
    } else {
      response = {
        ok: false,
        text: async () => message,
      };
    }
  }

  if (!response.ok) {
    const message = await response.text();
    if (message.includes("duplicate") && transactionId) {
      const existing = await fetch(
        `${SUPABASE_URL}/rest/v1/${LICENSES_TABLE}?transaction_id=eq.${encodeURIComponent(transactionId)}&select=license_key,plan,billing,device_limit&limit=1`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
        }
      );
      const rows = existing.ok ? await existing.json() : [];
      if (rows[0] && rows[0].license_key) {
        return rows[0];
      }
    }

    throw new Error(`Could not create license: ${message}`);
  }

  const rows = await response.json();
  return rows[0] || payload;
}

async function findExistingLicense(customerId, email) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || (!customerId && !email)) {
    return null;
  }

  async function lookup(field, value) {
    if (!value) return null;

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${LICENSES_TABLE}?${field}=eq.${encodeURIComponent(value)}&select=license_key,email,plan,billing,device_limit,active&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) return null;

    const rows = await response.json();
    return rows[0] || null;
  }

  return await lookup("customer_id", customerId) || await lookup("email", email);
}

async function deactivateLicenses(customerId, email, reason) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || (!customerId && !email)) {
    return;
  }

  const filters = customerId
    ? `customer_id=eq.${encodeURIComponent(customerId)}`
    : `email=eq.${encodeURIComponent(email)}`;

  await fetch(`${SUPABASE_URL}/rest/v1/${LICENSES_TABLE}?${filters}`, {
    method: "PATCH",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      active: false,
      notes: reason || "Subscription inactive",
    }),
  });
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

function formatLicensePlan(license) {
  const plan = String(license.plan || "solo").toLowerCase();
  const billing = String(license.billing || "").toLowerCase();

  if (plan === "solo" && billing === "launch-yearly") {
    return "Solo Launch Yearly";
  }

  const planName = plan === "duo" ? "Duo" : "Solo";
  if (billing === "yearly") return `${planName} Yearly`;
  if (billing === "monthly") return `${planName} Monthly`;
  return `${planName} plan`;
}

async function sendPurchaseEmail(email, license) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    throw new Error("Missing RESEND_API_KEY");
  }

  const trackedDownloadUrl = process.env.TRACKED_DOWNLOAD_URL || "https://useflowbridge.com/download";
  const installUrl = process.env.INSTALL_GUIDE_URL || "https://useflowbridge.com/install";
  const fromEmail = process.env.FROM_EMAIL || "FlowBridge <support@useflowbridge.com>";
  const licensePlanLabel = formatLicensePlan(license);
  const deviceText = `${license.device_limit || 1} active device${Number(license.device_limit || 1) > 1 ? "s" : ""}`;

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
      text: `Welcome to FlowBridge.\n\nYour license key:\n${license.license_key}\n\nPlan: ${licensePlanLabel}\nDevices: ${license.device_limit || 1}\nFree trial: ${TRIAL_DAYS} days\n\nDownload FlowBridge:\n${trackedDownloadUrl}\n\nInstall guide:\n${installUrl}\n\nAfter download, extract the ZIP and open Install FlowBridge.bat.\n\nWindows may show an Unknown Publisher warning because this installer is not code-signed yet. Click Run to continue. If SmartScreen appears instead, click More info, then Run anyway.\n\nNeed help? Reply to this email or contact support@useflowbridge.com.`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;line-height:1.55;color:#0f172a;max-width:620px;margin:auto;padding:28px;background:#f8fafc">
          <div style="background:white;border:1px solid #e2e8f0;border-radius:18px;padding:28px;box-shadow:0 18px 50px rgba(15,23,42,.08)">
            <p style="margin:0 0 8px;color:#2563eb;font-size:12px;font-weight:800;text-transform:uppercase">FlowBridge access</p>
            <h1 style="font-size:26px;line-height:1.1;margin:0 0 14px;color:#07111f">Your FlowBridge download is ready</h1>
            <p style="margin:0 0 18px">Thanks for joining FlowBridge. Start with the download, then follow the short install guide.</p>
            <div style="margin:0 0 18px;padding:14px;border:1px solid #99f6e4;border-radius:12px;background:#f0fdfa">
              <p style="margin:0 0 6px;color:#0f766e;font-size:12px;font-weight:800;text-transform:uppercase">Your license key</p>
              <p style="margin:0;font-family:Consolas,Menlo,monospace;font-size:20px;font-weight:800;letter-spacing:.04em;color:#07111f">${license.license_key}</p>
              <p style="margin:8px 0 0;color:#475569;font-size:13px">${licensePlanLabel} - ${deviceText} - ${TRIAL_DAYS}-day free trial</p>
            </div>
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

    const inactiveEvents = new Set([
      "subscription.canceled",
      "subscription.paused",
      "subscription.past_due",
    ]);

    let email = findCustomerEmail(event);
    if (!email && customerId) {
      email = await fetchCustomerEmail(customerId);
    }

    if (inactiveEvents.has(eventType)) {
      const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
      await deactivateLicenses(customerId, normalizedEmail, `Paddle event: ${eventType}`);
      await saveWebhookLog({
        status: "updated",
        event_type: eventType,
        customer_id: customerId,
        email: normalizedEmail,
        message: "License deactivated",
      });
      send(response, { ok: true, deactivated: true });
      return;
    }

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

    const normalizedEmail = String(email).trim().toLowerCase();
    const planInfo = findPurchasedPlan(event);
    const transactionId = findTransactionId(event) || null;

    const existingLicense = await findExistingLicense(customerId, normalizedEmail);
    if (existingLicense) {
      await saveWebhookLog({
        status: "already_sent",
        event_type: eventType,
        customer_id: customerId,
        email: normalizedEmail,
        message: `License already exists: ${existingLicense.license_key}`,
      });
      send(response, { ok: true, already_has_license: true });
      return;
    }

    const license = await createLicense(normalizedEmail, customerId, transactionId, planInfo);

    await sendPurchaseEmail(normalizedEmail, license);
    await saveWebhookLog({
      status: "sent",
      event_type: eventType,
      customer_id: customerId,
      email: normalizedEmail,
      message: `Purchase email sent with license ${license.license_key}`,
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


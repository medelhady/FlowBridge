const SUPABASE_URL = "https://sztjlrowzagweqwhvgpm.supabase.co";
const LICENSES_TABLE = "license_keys";

function send(response, payload, status = 200) {
  response.setHeader("Content-Type", "application/json");
  response.status(status).send(JSON.stringify(payload));
}

function normalizeLicenseKey(value) {
  return String(value || "").trim().toUpperCase();
}

async function handler(request, response) {
  if (request.method !== "POST") {
    send(response, { error: "Method not allowed" }, 405);
    return;
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    send(response, { valid: false, error: "License service is not configured" }, 500);
    return;
  }

  const licenseKey = normalizeLicenseKey(request.body && request.body.license_key);
  if (!licenseKey) {
    send(response, { valid: false, error: "Missing license key" }, 400);
    return;
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/${LICENSES_TABLE}?license_key=eq.${encodeURIComponent(licenseKey)}&active=eq.true&select=license_key,email,plan,billing,device_limit&limit=1`;
    const lookup = await fetch(url, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!lookup.ok) {
      throw new Error(await lookup.text());
    }

    const rows = await lookup.json();
    if (!rows[0]) {
      send(response, { valid: false });
      return;
    }

    send(response, {
      valid: true,
      plan: rows[0].plan,
      billing: rows[0].billing,
      device_limit: rows[0].device_limit,
    });
  } catch (error) {
    send(response, { valid: false, error: error.message || "License check failed" }, 500);
  }
}

module.exports = handler;

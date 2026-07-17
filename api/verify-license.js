const SUPABASE_URL = "https://sztjlrowzagweqwhvgpm.supabase.co";
const LICENSES_TABLE = "license_keys";
const LICENSE_DEVICES_TABLE = "license_devices";

function send(response, payload, status = 200) {
  response.setHeader("Content-Type", "application/json");
  response.status(status).send(JSON.stringify(payload));
}

function normalizeLicenseKey(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeDeviceId(value) {
  return String(value || "").trim().slice(0, 120);
}

function normalizeDeviceName(value) {
  return String(value || "").trim().slice(0, 120);
}

async function supabaseFetch(path, serviceKey, options = {}) {
  return await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
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

  const deviceId = normalizeDeviceId(request.body && request.body.device_id);
  const deviceName = normalizeDeviceName(request.body && request.body.device_name);
  if (!deviceId) {
    send(response, { valid: false, error: "Missing device id" }, 400);
    return;
  }

  try {
    const lookup = await supabaseFetch(
      `${LICENSES_TABLE}?license_key=eq.${encodeURIComponent(licenseKey)}&active=eq.true&select=id,license_key,email,plan,billing,device_limit&limit=1`,
      serviceKey
    );

    if (!lookup.ok) {
      throw new Error(await lookup.text());
    }

    const rows = await lookup.json();
    if (!rows[0]) {
      send(response, { valid: false });
      return;
    }

    const license = rows[0];
    const limit = Number(license.device_limit || 1);
    const devicesLookup = await supabaseFetch(
      `${LICENSE_DEVICES_TABLE}?license_id=eq.${encodeURIComponent(license.id)}&select=id,device_id&order=created_at.asc`,
      serviceKey
    );

    if (!devicesLookup.ok) {
      throw new Error(await devicesLookup.text());
    }

    const devices = await devicesLookup.json();
    const existingDevice = devices.find((device) => device.device_id === deviceId);
    if (!existingDevice && devices.length >= limit) {
      send(response, {
        valid: false,
        error: `This license is already active on ${limit} device${limit > 1 ? "s" : ""}.`,
        device_limit: limit,
        devices_used: devices.length,
      }, 403);
      return;
    }

    if (!existingDevice) {
      const registerDevice = await supabaseFetch(LICENSE_DEVICES_TABLE, serviceKey, {
        method: "POST",
        headers: {
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          license_id: license.id,
          device_id: deviceId,
          device_name: deviceName || null,
        }),
      });

      if (!registerDevice.ok) {
        throw new Error(await registerDevice.text());
      }
    }

    send(response, {
      valid: true,
      plan: license.plan,
      billing: license.billing,
      device_limit: license.device_limit,
      devices_used: existingDevice ? devices.length : devices.length + 1,
    });
  } catch (error) {
    send(response, { valid: false, error: error.message || "License check failed" }, 500);
  }
}

module.exports = handler;

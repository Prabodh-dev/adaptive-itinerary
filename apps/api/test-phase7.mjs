const BASE_URL = process.env.API_BASE_URL || "http://localhost:8080";
const ADMIN_KEY = process.env.ADMIN_REVIEW_KEY || "change_me";

function logStep(step, msg) {
  console.log(`[${step}] ${msg}`);
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { ok: response.ok, status: response.status, json };
}

function ensure(ok, message, payload) {
  if (!ok) {
    console.error("FAIL:", message);
    if (payload !== undefined) console.error(payload);
    process.exit(1);
  }
}

async function submitReport(contributorId, { withPhoto, lat, lng }) {
  const form = new FormData();
  form.append("type", "traffic");
  form.append("severity", "4");
  form.append("message", withPhoto ? "Major local road closure reported with proof" : "Major local road closure reported");
  form.append("lat", String(lat));
  form.append("lng", String(lng));
  form.append("locationText", "Test location");
  form.append("ttlMin", "180");

  if (withPhoto) {
    const fileBlob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
    form.append("photo", fileBlob, "phase7-test.png");
  }

  return requestJson("/contributor/reports", {
    method: "POST",
    headers: { "X-CONTRIBUTOR-ID": contributorId },
    body: form,
  });
}

async function main() {
  logStep("1", "Register contributor");
  const contributorIdInput = `phase7_tester_${Date.now()}`;
  const registerRes = await requestJson("/contributor/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contributorId: contributorIdInput,
      name: "Phase7 Tester",
      contact: "phase7@example.com",
    }),
  });
  ensure(registerRes.ok, "Contributor registration failed", registerRes.json);
  const contributorId = registerRes.json.contributorId;
  ensure(Boolean(contributorId), "Missing contributorId in register response", registerRes.json);

  const baseLat = 12.9716;
  const baseLng = 77.5946;

  logStep("2a", "Submit report without photo");
  const reportNoPhoto = await submitReport(contributorId, { withPhoto: false, lat: baseLat, lng: baseLng });
  ensure(reportNoPhoto.ok, "Submit report without photo failed", reportNoPhoto.json);
  const firstReportId = reportNoPhoto.json.reportId;

  let secondReportId = null;
  logStep("2b", "Submit report with photo (if Cloudinary configured)");
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_UPLOAD_PRESET) {
    const reportWithPhoto = await submitReport(contributorId, {
      withPhoto: true,
      lat: baseLat + 0.001,
      lng: baseLng + 0.001,
    });
    ensure(reportWithPhoto.ok, "Submit report with photo failed", reportWithPhoto.json);
    secondReportId = reportWithPhoto.json.reportId;
  } else {
    console.log("[2b] SKIPPED: CLOUDINARY_CLOUD_NAME/CLOUDINARY_UPLOAD_PRESET not set");
  }

  logStep("3", "Approve first report as admin");
  const approveRes = await requestJson(`/admin/reports/${firstReportId}/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-ADMIN-KEY": ADMIN_KEY,
    },
    body: JSON.stringify({}),
  });
  ensure(approveRes.ok, "Admin approval failed", approveRes.json);

  if (secondReportId) {
    logStep("3b", "Approve second (photo) report");
    const approvePhotoRes = await requestJson(`/admin/reports/${secondReportId}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ADMIN-KEY": ADMIN_KEY,
      },
      body: JSON.stringify({}),
    });
    ensure(approvePhotoRes.ok, "Admin approval for photo report failed", approvePhotoRes.json);
  }

  logStep("4", "Create trip and add nearby activity");
  const createTripRes = await requestJson("/trip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      city: "Bengaluru",
      date: "2026-03-01",
      startTime: "09:00",
      endTime: "18:00",
      preferences: {
        pace: "medium",
        interests: [],
        avoid: [],
        budget: "medium",
      },
    }),
  });
  ensure(createTripRes.ok, "Trip creation failed", createTripRes.json);
  const tripId = createTripRes.json.tripId;

  const addActivitiesRes = await requestJson(`/trip/${tripId}/activities`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      activities: [
        {
          place: {
            provider: "manual",
            providerPlaceId: "phase7-place-1",
            name: "Phase7 Nearby Place",
            lat: baseLat + 0.002,
            lng: baseLng + 0.001,
            category: "Landmark",
          },
          durationMin: 60,
          locked: false,
        },
        {
          place: {
            provider: "manual",
            providerPlaceId: "phase7-place-2",
            name: "Phase7 Indoor Place",
            lat: baseLat + 0.003,
            lng: baseLng + 0.002,
            category: "Museum",
            isIndoor: true,
          },
          durationMin: 45,
          locked: false,
        },
      ],
    }),
  });
  ensure(addActivitiesRes.ok, "Adding activities failed", addActivitiesRes.json);

  const itineraryRes = await requestJson(`/trip/${tripId}/itinerary/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "driving" }),
  });
  ensure(itineraryRes.ok, "Generate itinerary failed", itineraryRes.json);

  logStep("5", "Verify community reports are included in signals");
  const signalsRes = await requestJson(`/trip/${tripId}/signals`, { method: "GET" });
  ensure(signalsRes.ok, "Get trip signals failed", signalsRes.json);
  const reports = signalsRes.json?.community?.reports || [];
  ensure(
    reports.some((report) => report.id === firstReportId),
    "Approved community report not present in trip signals",
    signalsRes.json
  );

  logStep("6", "Trigger recompute and check suggestions list");
  const recomputeRes = await requestJson(`/internal/trip/${tripId}/recompute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  ensure(recomputeRes.ok, "Recompute failed", recomputeRes.json);

  const suggestionsRes = await requestJson(`/trip/${tripId}/suggestions?status=pending`, {
    method: "GET",
  });
  ensure(suggestionsRes.ok, "List suggestions failed", suggestionsRes.json);
  console.log(`[6] Pending suggestions: ${suggestionsRes.json?.suggestions?.length ?? 0}`);

  logStep("PASS", "Phase 7 flow completed");
}

main().catch((error) => {
  console.error("FAIL:", error);
  process.exit(1);
});

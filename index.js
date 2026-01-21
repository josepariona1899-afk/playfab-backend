import express from "express";

const app = express();
app.use(express.json());

const TITLE_ID = process.env.PLAYFAB_TITLE_ID;          // 10B59A
const SECRET_KEY = process.env.PLAYFAB_SECRET_KEY;      // TU SECRET KEY (solo env)
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;      // clave tuya para proteger endpoints

if (!TITLE_ID || !SECRET_KEY || !ROBLOX_API_KEY) {
  console.error("Faltan env vars: PLAYFAB_TITLE_ID, PLAYFAB_SECRET_KEY, ROBLOX_API_KEY");
  process.exit(1);
}

const PLAYFAB_URL = `https://${TITLE_ID}.playfabapi.com/Server/`;

async function playFabRequest(endpoint, body) {
  const res = await fetch(PLAYFAB_URL + endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SecretKey": SECRET_KEY
    },
    body: JSON.stringify(body)
  });

  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}

  if (!res.ok) {
    return { ok: false, status: res.status, body: json ?? text };
  }
  return { ok: true, body: json };
}

function requireAuth(req, res, next) {
  const key = req.header("x-api-key");
  if (!key || key !== ROBLOX_API_KEY) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  next();
}

// 1) Login con CustomId = userId
app.post("/login", requireAuth, async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ ok: false, error: "missing userId" });

  const r = await playFabRequest("LoginWithCustomID", {
    CustomId: String(userId),
    CreateAccount: true
  });

  if (!r.ok) return res.status(500).json({ ok: false, error: "playfab", detail: r.body });

  const playFabId = r.body?.data?.PlayFabId;
  if (!playFabId) return res.status(500).json({ ok: false, error: "no PlayFabId", detail: r.body });

  res.json({ ok: true, playFabId });
});

// 2) Leer puntos
app.post("/getPoints", requireAuth, async (req, res) => {
  const { playFabId } = req.body;
  if (!playFabId) return res.status(400).json({ ok: false, error: "missing playFabId" });

  const r = await playFabRequest("GetUserData", { PlayFabId: playFabId, Keys: ["Points"] });
  if (!r.ok) return res.status(500).json({ ok: false, error: "playfab", detail: r.body });

  const v = r.body?.data?.Data?.Points?.Value;
  res.json({ ok: true, points: v ? Number(v) : 0 });
});

// 3) Guardar puntos
app.post("/setPoints", requireAuth, async (req, res) => {
  const { playFabId, points } = req.body;
  if (!playFabId || typeof points !== "number") {
    return res.status(400).json({ ok: false, error: "missing playFabId or points(number)" });
  }

  const r = await playFabRequest("UpdateUserData", {
    PlayFabId: playFabId,
    Data: { Points: String(points) }
  });

  if (!r.ok) return res.status(500).json({ ok: false, error: "playfab", detail: r.body });

  res.json({ ok: true });
});

app.get("/", (req, res) => res.send("OK"));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Running on", port));

import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.ts";

const app = new Hono();

app.use('*', logger(console.log));

app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

/** Rutas API (montadas en / y en /make-server-f6cf3a30 según cómo Supabase envíe el path). */
const routes = new Hono();

const BUCKET_NAME = "make-e725a348-player-photos";

// Initialize bucket on first request
let bucketReady = false;
const ensureBucket = async () => {
  if (bucketReady) return;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some((bucket: any) => bucket.name === BUCKET_NAME);
  if (!bucketExists) {
    await supabase.storage.createBucket(BUCKET_NAME, { public: false });
    console.log(`Bucket ${BUCKET_NAME} created`);
  }
  bucketReady = true;
};

// Health check (path relativo al slug de la función en Supabase)
routes.get("/health", (c) => {
  return c.json({ status: "ok" });
});

// Upload player photo
routes.post("/upload-photo", async (c) => {
  try {
    await ensureBucket();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const formData = await c.req.formData();
    const file = formData.get("file") as File;
    const playerId = formData.get("playerId") as string;

    if (!file || !playerId) {
      return c.json({ error: "Missing file or playerId" }, 400);
    }

    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `${playerId}-${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (error) {
      console.log(`Upload error for player ${playerId}: ${error.message}`);
      return c.json({ error: `Error uploading photo: ${error.message}` }, 500);
    }

    // Create signed URL (valid 1 year)
    const { data: signedData, error: signError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, 60 * 60 * 24 * 365);

    if (signError) {
      console.log(`Signed URL error: ${signError.message}`);
      return c.json({ error: `Error creating signed URL: ${signError.message}` }, 500);
    }

    console.log(`Photo uploaded for player ${playerId}: ${filePath}`);
    return c.json({ url: signedData.signedUrl, path: filePath });
  } catch (err) {
    console.log(`Unexpected error uploading photo: ${err}`);
    return c.json({ error: `Unexpected error: ${err}` }, 500);
  }
});

// Save tactic (formation + players + arrows)
routes.post("/save-tactic", async (c) => {
  try {
    const body = await c.req.json();
    const players = body.players || [];

    // Save tactic metadata as separate keys
    await kv.set("tactic-formation", body.formation || "4-3-3");
    await kv.set("tactic-arrows", body.arrows || []);
    await kv.set("tactic-opponents", body.opponents || []);
    await kv.set("tactic-lasers", body.laserStrokes || []);
    await kv.set("tactic-customFormations", body.customFormations || []);
    await kv.set("tactic-savedAt", body.savedAt || new Date().toISOString());
    await kv.set("tactic-coach-photo", body.coachPhotoUrl ?? "");
    await kv.set("tactic-coach-name", String(body.coachName ?? "").trim() || "D.T.");
    await kv.set("tactic-captain-id", body.captainPlayerId != null && body.captainPlayerId !== "" ? String(body.captainPlayerId) : "");

    // Save each player: key = dorsal number, value = player data
    const keys = players.map((p: any) => `jugador-${p.number}`);
    const values = players.map((p: any) => ({
      id: p.id,
      name: p.name,
      number: p.number,
      foto: p.photoUrl || "",
      position: p.position,
      pitchX: p.pitchX,
      pitchY: p.pitchY,
      isOnPitch: p.isOnPitch,
    }));
    if (keys.length > 0) {
      await kv.mset(keys, values);
    }

    // Save player dorsals list for loading
    const currentNumbers = players.map((p: any) => String(p.number));
    await kv.set("tactic-playerNumbers", currentNumbers);

    // Clean up removed players
    try {
      const currentSet = new Set(currentNumbers);
      const existingNumbers = await kv.get("tactic-playerNumbers-prev");
      if (existingNumbers && Array.isArray(existingNumbers)) {
        const toDelete = existingNumbers
          .filter((n: string) => !currentSet.has(n))
          .map((n: string) => `jugador-${n}`);
        if (toDelete.length > 0) await kv.mdel(toDelete);
      }
    } catch (cleanErr) {
      console.log(`Warning: cleanup error: ${cleanErr}`);
    }
    await kv.set("tactic-playerNumbers-prev", currentNumbers);

    console.log(`Tactic saved: ${players.length} players + metadata`);
    return c.json({ saved: true, playerCount: players.length });
  } catch (err) {
    console.log(`Error saving tactic: ${err}`);
    return c.json({ error: `Error saving tactic: ${err}` }, 500);
  }
});

// Load tactic
routes.get("/load-tactic/:id", async (c) => {
  try {
    // Load metadata
    const [formation, arrows, opponents, lasers, customFormations, savedAt, playerNumbers, coachPhoto, coachName, captainId] =
      await kv.mget([
        "tactic-formation", "tactic-arrows", "tactic-opponents", "tactic-lasers",
        "tactic-customFormations", "tactic-savedAt", "tactic-playerNumbers",
        "tactic-coach-photo", "tactic-coach-name", "tactic-captain-id",
      ]);

    if (!playerNumbers) return c.json({ error: "Tactic not found" }, 404);

    // Load each player by dorsal
    const playerKeys = playerNumbers.map((n: string) => `jugador-${n}`);
    let players: any[] = [];
    if (playerKeys.length > 0) {
      const playerValues = await kv.mget(playerKeys);
      players = playerValues
        .filter((v: any) => v != null)
        .map((v: any) => ({
          id: v.id || String(v.number),
          name: v.name || "",
          number: v.number || 0,
          photoUrl: v.foto || "",
          position: v.position || "MED",
          pitchX: v.pitchX ?? 50,
          pitchY: v.pitchY ?? 50,
          isOnPitch: v.isOnPitch ?? false,
        }));
    }

    return c.json({
      players,
      formation: formation || "4-3-3",
      arrows: arrows || [],
      opponents: opponents || [],
      laserStrokes: lasers || [],
      customFormations: customFormations || [],
      savedAt,
      coachPhotoUrl: coachPhoto != null ? String(coachPhoto) : "",
      coachName: coachName != null ? String(coachName) : "",
      captainPlayerId: captainId != null && String(captainId).trim() !== "" ? String(captainId) : null,
    });
  } catch (err) {
    console.log(`Error loading tactic: ${err}`);
    return c.json({ error: `Error loading tactic: ${err}` }, 500);
  }
});

// List saved tactics (legacy: prefijo tactic- en KV)
routes.get("/tactics", async (c) => {
  try {
    const tactics = await kv.getByPrefix("tactic-");
    const parsed = tactics.map((t: any) => {
      try { return JSON.parse(t.value); } catch { return t; }
    });
    return c.json(parsed);
  } catch (err) {
    console.log(`Error listing tactics: ${err}`);
    return c.json({ error: `Error listing tactics: ${err}` }, 500);
  }
});

const MAX_SAVED_SNAPSHOTS = 40;

// Lista de tácticas guardadas (copias con nombre)
routes.get("/saved-tactics", async (c) => {
  try {
    const index = await kv.get("saved-tactics-index");
    const list = Array.isArray(index) ? index : [];
    return c.json(list);
  } catch (err) {
    console.log(`Error listing saved tactics: ${err}`);
    return c.json({ error: `Error listing saved tactics: ${err}` }, 500);
  }
});

// Guardar copia nombrada de la táctica actual
routes.post("/save-snapshot", async (c) => {
  try {
    const body = await c.req.json();
    const name = String(body.name || "").trim();
    if (!name) return c.json({ error: "Falta el nombre" }, 400);

    const id = crypto.randomUUID();
    const savedAt = new Date().toISOString();
    const snapshot = {
      id,
      name,
      savedAt,
      players: body.players || [],
      arrows: body.arrows || [],
      opponents: body.opponents || [],
      laserStrokes: body.laserStrokes || [],
      formation: body.formation || "4-3-3",
      customFormations: body.customFormations || [],
    };

    await kv.set(`saved-tactic-${id}`, snapshot);

    let index: any[] = (await kv.get("saved-tactics-index")) || [];
    if (!Array.isArray(index)) index = [];
    index.unshift({ id, name, savedAt });

    if (index.length > MAX_SAVED_SNAPSHOTS) {
      const removed = index.slice(MAX_SAVED_SNAPSHOTS);
      index = index.slice(0, MAX_SAVED_SNAPSHOTS);
      for (const row of removed) {
        try {
          await kv.del(`saved-tactic-${row.id}`);
        } catch (_) { /* ignore */ }
      }
    }
    await kv.set("saved-tactics-index", index);

    console.log(`Snapshot saved: ${name} (${id})`);
    return c.json({ id, name, savedAt });
  } catch (err) {
    console.log(`Error save snapshot: ${err}`);
    return c.json({ error: `Error save snapshot: ${err}` }, 500);
  }
});

// Cargar una copia completa
routes.get("/saved-tactic/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const data = await kv.get(`saved-tactic-${id}`);
    if (!data) return c.json({ error: "No encontrada" }, 404);
    return c.json(data);
  } catch (err) {
    console.log(`Error load snapshot: ${err}`);
    return c.json({ error: `Error load snapshot: ${err}` }, 500);
  }
});

// Actualizar copia existente (misma pizarra + nombre opcional)
routes.put("/saved-tactic/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const prev = await kv.get(`saved-tactic-${id}`);
    if (!prev) return c.json({ error: "No encontrada" }, 404);

    const body = await c.req.json();
    const name = String(body.name ?? prev.name ?? "").trim();
    if (!name) return c.json({ error: "Falta el nombre" }, 400);

    const savedAt = new Date().toISOString();
    const snapshot = {
      id,
      name,
      savedAt,
      players: body.players ?? prev.players ?? [],
      arrows: body.arrows ?? prev.arrows ?? [],
      opponents: body.opponents ?? prev.opponents ?? [],
      laserStrokes: body.laserStrokes ?? prev.laserStrokes ?? [],
      formation: body.formation ?? prev.formation ?? "4-3-3",
      customFormations: body.customFormations ?? prev.customFormations ?? [],
    };

    await kv.set(`saved-tactic-${id}`, snapshot);

    let index: any[] = (await kv.get("saved-tactics-index")) || [];
    if (!Array.isArray(index)) index = [];
    const next = index.map((row: any) =>
      row.id === id ? { id, name, savedAt } : row
    );
    await kv.set("saved-tactics-index", next);

    console.log(`Snapshot updated: ${name} (${id})`);
    return c.json({ id, name, savedAt });
  } catch (err) {
    console.log(`Error update snapshot: ${err}`);
    return c.json({ error: `Error update snapshot: ${err}` }, 500);
  }
});

// Eliminar copia
routes.delete("/saved-tactic/:id", async (c) => {
  try {
    const id = c.req.param("id");
    let index: any[] = (await kv.get("saved-tactics-index")) || [];
    if (!Array.isArray(index)) index = [];
    const next = index.filter((row: any) => row.id !== id);
    await kv.set("saved-tactics-index", next);
    await kv.del(`saved-tactic-${id}`);
    return c.json({ ok: true });
  } catch (err) {
    console.log(`Error delete snapshot: ${err}`);
    return c.json({ error: `Error delete snapshot: ${err}` }, 500);
  }
});

app.route("/", routes);
app.route("/make-server-f6cf3a30", routes);

Deno.serve(app.fetch);
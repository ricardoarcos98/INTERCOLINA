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

// Health check
app.get("/make-server-f6cf3a30/health", (c) => {
  return c.json({ status: "ok" });
});

// Upload player photo
app.post("/make-server-f6cf3a30/upload-photo", async (c) => {
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
app.post("/make-server-f6cf3a30/save-tactic", async (c) => {
  try {
    const body = await c.req.json();
    const players = body.players || [];

    // Save tactic metadata as separate keys
    await kv.set("tactic-formation", body.formation || "4-3-3");
    await kv.set("tactic-arrows", body.arrows || []);
    await kv.set("tactic-opponents", body.opponents || []);
    await kv.set("tactic-customFormations", body.customFormations || []);
    await kv.set("tactic-savedAt", body.savedAt || new Date().toISOString());

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
app.get("/make-server-f6cf3a30/load-tactic/:id", async (c) => {
  try {
    // Load metadata
    const [formation, arrows, opponents, customFormations, savedAt, playerNumbers] = await kv.mget([
      "tactic-formation", "tactic-arrows", "tactic-opponents",
      "tactic-customFormations", "tactic-savedAt", "tactic-playerNumbers"
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
      customFormations: customFormations || [],
      savedAt,
    });
  } catch (err) {
    console.log(`Error loading tactic: ${err}`);
    return c.json({ error: `Error loading tactic: ${err}` }, 500);
  }
});

// List saved tactics
app.get("/make-server-f6cf3a30/tactics", async (c) => {
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

Deno.serve(app.fetch);
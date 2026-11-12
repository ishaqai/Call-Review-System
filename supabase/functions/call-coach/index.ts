import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://ishaqai.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return json({ error: "Sign in before requesting coaching." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !geminiApiKey) {
    return json({ error: "The coaching function needs Supabase and Gemini secrets configured." }, 500);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "Your sign-in session is invalid. Sign in again." }, 401);

  let body: { mode?: string; recordId?: string };
  try { body = await request.json(); } catch { return json({ error: "Invalid request body." }, 400); }
  const mode = body.mode === "history" ? "history" : "call";

  let query = userClient.from("call_records").select("id,record").eq("user_id", user.id);
  if (mode === "call") {
    if (!body.recordId) return json({ error: "A call record is required." }, 400);
    query = query.eq("id", body.recordId);
  }
  const { data: rows, error: queryError } = await query;
  if (queryError) return json({ error: "Could not load your saved call records." }, 500);
  const records = (rows || []).map((row) => row.record).filter(Boolean);
  if (!records.length) return json({ error: mode === "history" ? "Save some synced calls first to review patterns." : "That call is not available in your cloud records." }, 404);

  const prompt = mode === "history"
    ? `Review these call notes and give practical coaching patterns. Only use evidence present in these records; do not invent facts or claim statistical certainty from a small sample. Return JSON with keys summary (string), strengths (string array), improvement_areas (string array), patterns (string array), next_steps (string array). Records: ${JSON.stringify(records).slice(0, 24000)}`
    : `Coach the user on this call using only the saved notes. Be specific and supportive; do not infer things the notes do not support. Return JSON with keys summary (string), strengths (string array), improvement_areas (string array), suggested_phrasing (string array), follow_up_steps (string array). Record: ${JSON.stringify(records[0]).slice(0, 12000)}`;

  const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiApiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
    }),
  });
  if (!geminiResponse.ok) {
    const details = await geminiResponse.text();
    console.error("Gemini request failed", geminiResponse.status, details);
    return json({ error: "Gemini could not generate the review. Check the API key and Gemini API access." }, 502);
  }
  const responseData = await geminiResponse.json();
  const text = responseData.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("");
  if (!text) return json({ error: "Gemini returned an empty review. Try again." }, 502);
  try { return json(JSON.parse(text)); } catch { return json({ error: "Gemini returned an unreadable response. Try again." }, 502); }
});

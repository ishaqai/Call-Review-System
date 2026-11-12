import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders as supabaseCorsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://ishaqai.github.io",
  "Access-Control-Allow-Headers": supabaseCorsHeaders["Access-Control-Allow-Headers"],
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const rowMatchesLead = (candidate: Record<string, any>, target: Record<string, any>) =>
  Boolean(target.leadId && candidate.leadId === target.leadId) ||
  Boolean(target.person && candidate.person === target.person && (!target.company || candidate.company === target.company));

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

  let body: { mode?: string; recordId?: string; focus?: string; excludeSensitive?: boolean; notes?: string; practiceResponse?: string };
  try { body = await request.json(); } catch { return json({ error: "Invalid request body." }, 400); }
  const supported = ["call", "history", "brief", "practice", "practice_feedback", "cleanup"];
  const mode = supported.includes(body.mode || "") ? body.mode! : "call";

  let query = userClient.from("call_records").select("id,record").eq("user_id", user.id);
  if (["call", "brief", "practice", "practice_feedback"].includes(mode)) {
    if (!body.recordId) return json({ error: "A call record is required." }, 400);
    if (mode !== "brief") query = query.eq("id", body.recordId);
  }
  let records: Record<string, any>[] = [];
  if (mode !== "cleanup") {
    const { data: rows, error: queryError } = await query;
    if (queryError) return json({ error: "Could not load your saved call records." }, 500);
    if (mode === "brief") {
      const target = (rows || []).find((row) => row.id === body.recordId)?.record;
      if (target) records = [target, ...(rows || []).filter((row) => row.id !== body.recordId).map((row) => row.record).filter((candidate) => candidate && rowMatchesLead(candidate, target) && (!candidate.callDate || !target.callDate || candidate.callDate < target.callDate))].slice(0, 12);
    } else records = (rows || []).map((row) => row.record).filter(Boolean);
  }
  if (body.excludeSensitive) records = records.map((record) => {
    const { leadId, leadOwner, assignedBy, person, ...lessSensitive } = record;
    return { ...lessSensitive, person: "[excluded]" };
  });
  if (mode === "cleanup" && !body.notes?.trim()) return json({ error: "Paste some rough notes to clean up." }, 400);
  if (mode !== "cleanup" && !records.length) return json({ error: mode === "history" ? "Save some synced calls first to review patterns." : "That call is not available in your cloud records." }, 404);

  const focusLabels: Record<string, string> = { overall: "overall call improvement", clarity: "clear and concise communication", confidence: "confidence and rapport", objections: "handling questions or objections", followup: "follow-up and next steps" };
  const focus = focusLabels[body.focus || "overall"] || focusLabels.overall;
  const record = records[0];
  const prompt = mode === "history"
    ? `Review these call notes and give practical coaching patterns focused on ${focus}. Only use evidence present in these records; do not invent facts or claim statistical certainty from a small sample. Return JSON with keys summary (string), strengths (string array), improvement_areas (string array), patterns (string array), next_steps (string array). Records: ${JSON.stringify(records).slice(0, 24000)}`
    : mode === "brief"
    ? `Prepare a concise, practical pre-call brief using this lead and its earlier saved call notes. The first record is the selected call, followed by matching history. Clearly mark unknowns as questions and never invent facts. Return JSON with summary (string), prep_agenda (string array), context_points (string array), open_questions (string array), suggested_opening (string array). Records: ${JSON.stringify(records).slice(0, 16000)}`
    : mode === "practice"
    ? `Create a realistic call practice scenario based on this saved lead and role. Do not invent company facts; the interviewer/customer role may be a plausible simulation. Give one prompt at a time for the user to answer. Return JSON with summary (string), scenario (string), roleplay_prompt (string), practice_tips (string array), suggested_opening (string array). Record: ${JSON.stringify(record).slice(0, 12000)}`
    : mode === "practice_feedback"
    ? `Give constructive feedback on this practice response, grounded in the saved call context and the response. Be specific and supportive. Return JSON with summary (string), strengths (string array), improvement_areas (string array), suggested_response (string), practice_tips (string array). Context: ${JSON.stringify(record).slice(0, 9000)} Response: ${String(body.practiceResponse || "").slice(0, 6000)}`
    : mode === "cleanup"
    ? `Organize the user's rough call notes without adding facts. Preserve uncertainty and meaning; do not infer a conclusion. Return JSON with summary (string), call_purpose (string), conclusion (string), feedback (string), follow_up_steps (string array). Rough notes: ${String(body.notes || "").slice(0, 10000)}`
    : `Coach the user on this call, focusing on ${focus}, using only the saved notes. Be specific and supportive; do not infer things the notes do not support. Return JSON with keys summary (string), strengths (string array), improvement_areas (string array), suggested_phrasing (string array), follow_up_steps (string array). Record: ${JSON.stringify(record).slice(0, 12000)}`;

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(geminiApiKey)}`;
  const geminiRequest = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
    }),
  };
  let geminiResponse = await fetch(geminiUrl, geminiRequest);
  for (const waitMs of [700, 1600]) {
    if (geminiResponse.status !== 429 && geminiResponse.status !== 503) break;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    geminiResponse = await fetch(geminiUrl, geminiRequest);
  }
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

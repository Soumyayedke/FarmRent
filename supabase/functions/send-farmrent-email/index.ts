// Supabase Edge Function: send-farmrent-email
// Events: payment_success | booking_confirmed
// Secrets (set with `supabase secrets set`, never in browser code):
//   RESEND_API_KEY   - Resend API key
//   FROM_EMAIL       - e.g. "FarmRent <notifications@your-verified-domain.com>"
// SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are injected by Supabase.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STALE_SENDING_MS = 2 * 60 * 1000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const mask = (e: string) => e.replace(/^(.).*(@.*)$/, "$1***$2");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("FROM_EMAIL") ?? "FarmRent <onboarding@resend.dev>";
  if (!resendKey) {
    console.error("[send-farmrent-email] RESEND_API_KEY secret is missing");
    return json({ success: false, error: "Email service is not configured." }, 500);
  }

  // ---- 1. Identify the caller from their JWT
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ success: false, error: "Not authenticated." }, 401);
  const caller = userData.user.id;

  // ---- 2. Validate input
  let payload: { booking_id?: string; event?: string };
  try { payload = await req.json(); } catch { return json({ success: false, error: "Invalid JSON." }, 400); }
  const bookingId = payload.booking_id ?? "";
  const event = payload.event ?? "";
  if (!UUID.test(bookingId)) return json({ success: false, error: "Invalid booking_id." }, 400);
  if (event !== "payment_success" && event !== "booking_confirmed")
    return json({ success: false, error: "Unknown event." }, 400);
  const tag = `[send-farmrent-email] ${event} ${bookingId.slice(0, 8)}`;

  const db = createClient(url, service, { auth: { persistSession: false } });

  // ---- 3. Load booking and authorise from DATABASE state (never from client claims)
  const { data: b, error: bErr } = await db
    .from("booking_requests")
    .select("id, farmer_id, owner_id, equipment_name, start_date, end_date, total_amount, status, payment_status, payment_method, payment_ref, paid_at")
    .eq("id", bookingId).maybeSingle();
  if (bErr || !b) { console.error(tag, "booking lookup failed", bErr?.message); return json({ success: false, error: "Booking not found." }, 404); }

  if (event === "payment_success") {
    if (caller !== b.farmer_id) return json({ success: false, error: "Not allowed." }, 403);
    if (b.payment_status !== "paid") {
      console.warn(tag, "refused: payment_status is", b.payment_status);
      return json({ success: false, error: "Payment is not confirmed as paid." }, 409);
    }
  } else {
    if (caller !== b.owner_id && caller !== b.farmer_id) return json({ success: false, error: "Not allowed." }, 403);
    if (b.status !== "approved" && b.status !== "completed") {
      console.warn(tag, "refused: status is", b.status);
      return json({ success: false, error: "Booking is not approved." }, 409);
    }
  }

  // ---- 4. Claim the send in the database (exactly-once guard)
  const now = new Date().toISOString();
  const ins = await db.from("email_notifications").insert({ booking_id: bookingId, event, status: "sending" });
  if (ins.error) {
    if (ins.error.code !== "23505") { console.error(tag, "ledger insert failed", ins.error.message); return json({ success: false, error: "Could not record email state." }, 500); }
    const { data: row } = await db.from("email_notifications").select("status, attempts, updated_at").eq("booking_id", bookingId).eq("event", event).single();
    if (row?.status === "sent") { console.log(tag, "duplicate request ignored (already sent)"); return json({ success: true, duplicate: true }); }
    const fresh = row?.status === "sending" && Date.now() - new Date(row.updated_at).getTime() < STALE_SENDING_MS;
    if (fresh) { console.log(tag, "another send in progress"); return json({ success: true, duplicate: true, in_progress: true }); }
    // failed or stale: take over atomically (only one caller can match the old updated_at)
    const { data: claimed } = await db.from("email_notifications")
      .update({ status: "sending", attempts: (row?.attempts ?? 1) + 1, updated_at: now })
      .eq("booking_id", bookingId).eq("event", event).eq("updated_at", row!.updated_at).select("booking_id");
    if (!claimed?.length) return json({ success: true, duplicate: true, in_progress: true });
  }

  const fail = async (msg: string, status = 502) => {
    await db.from("email_notifications").update({ status: "failed", last_error: msg.slice(0, 300), updated_at: new Date().toISOString() })
      .eq("booking_id", bookingId).eq("event", event);
    return json({ success: false, error: msg }, status);
  };

  // ---- 5. Recipient: the farmer
  const { data: prof } = await db.from("profiles").select("email, full_name").eq("id", b.farmer_id).maybeSingle();
  let to = prof?.email ?? "";
  if (!to) { const { data: au } = await db.auth.admin.getUserById(b.farmer_id); to = au?.user?.email ?? ""; }
  if (!to) { console.error(tag, "no recipient email for farmer"); return await fail("Farmer has no email address.", 422); }

  // ---- 6. Compose
  const name = esc(prof?.full_name || "Farmer");
  const amount = Number(b.total_amount ?? 0).toLocaleString("en-IN");
  const rows = `
    <tr><td>Equipment</td><td><b>${esc(b.equipment_name)}</b></td></tr>
    <tr><td>Dates</td><td>${esc(b.start_date)} to ${esc(b.end_date)}</td></tr>
    <tr><td>Amount</td><td>₹${esc(amount)}</td></tr>`;
  const isPay = event === "payment_success";
  const subject = isPay ? "FarmRent: payment received (demo)" : "FarmRent: your booking is confirmed";
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px">
    <h2>${isPay ? "Payment received" : "Booking confirmed"}</h2>
    <p>Hello ${name},</p>
    <p>${isPay ? "Your demo payment was recorded. No real money was charged." : "The owner has approved your booking request."}</p>
    <table cellpadding="6">${rows}
      ${isPay ? `<tr><td>Reference</td><td>${esc(b.payment_ref)}</td></tr>` : ""}</table>
    <p style="color:#777;font-size:12px">FarmRent academic demo project.</p></div>`;

  // ---- 7. Send via Resend (Idempotency-Key = second safety layer)
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json", "Idempotency-Key": `${event}-${bookingId}` },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
  } catch (e) {
    console.error(tag, "Resend network error", (e as Error).message);
    return await fail("Could not reach the email provider.");
  }
  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(tag, "Resend rejected", res.status, out?.name, out?.message, "to=", mask(to));
    return await fail(`Email provider rejected the message (${res.status}${out?.message ? ": " + out.message : ""}).`);
  }

  await db.from("email_notifications").update({ status: "sent", resend_id: out.id ?? null, last_error: null, updated_at: new Date().toISOString() })
    .eq("booking_id", bookingId).eq("event", event);
  console.log(tag, "sent", out.id, "to=", mask(to));
  return json({ success: true, resend_id: out.id });
});
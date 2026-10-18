// Supabase Edge Function: emails the signed-in user their monthly report PDF.
//
// The recipient is always the caller's own verified email (from their
// session). Any `to` sent by the client is ignored, so this can't be used to
// mail arbitrary people. The attachment must be a PDF under the size cap,
// and each user gets MAIL_DAILY_LIMIT sends a day (default 5).
//
// Secrets: GMAIL_PASS (app password for the sender account),
// MAIL_DAILY_LIMIT (optional). Deploy with JWT verification on (default):
//   supabase functions deploy send-mail

import nodemailer from "npm:nodemailer";
import { createClient } from "npm:@supabase/supabase-js@2";

const SENDER = "expensify.reports@gmail.com";
const MAX_PDF_B64 = 8 * 1024 * 1024;
const DAILY_LIMIT = Number(Deno.env.get("MAIL_DAILY_LIMIT") ?? "5");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const htmlContent = `
    <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Your Monthly Expense Report</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:20px 0;">
        <h1 style="margin:0;color:#194868;">Expensify</h1>
      </td>
    </tr>
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="padding:40px;">
              <h2 style="margin-top:0;color:#333333;font-size:24px;">Your Monthly Expense Report</h2>
              <p style="color:#555555;font-size:16px;line-height:1.5;">
                Your expense summary for last month is ready. We've attached it as a PDF for you.
              </p>
              <p style="color:#555555;font-size:16px;line-height:1.5;">
                Track smart. Spend wise.
              </p>
              <p style="color:#555555;font-size:16px;line-height:1.5;margin-bottom:0;">
                Cheers,<br/>
                The Expensify Team
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#F9FAFB;padding:20px;text-align:center;color:#999999;font-size:12px;">
              © 2025 Expensify, Inc. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { success: false, error: "Method not allowed" });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const caller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await caller.auth.getUser();
    const email = userData?.user?.email;
    if (userErr || !userData?.user) return json(401, { success: false, error: "Not signed in" });
    if (!email || !userData.user.email_confirmed_at) {
      return json(400, { success: false, error: "Your account has no verified email" });
    }

    let pdfBase64: unknown;
    try {
      pdfBase64 = (await req.json())?.pdfBase64;
    } catch {
      return json(400, { success: false, error: "Invalid JSON" });
    }
    if (typeof pdfBase64 !== "string" || !pdfBase64.startsWith("JVBER")) {
      return json(400, { success: false, error: "Attachment must be a PDF" });
    }
    if (pdfBase64.length > MAX_PDF_B64) {
      return json(413, { success: false, error: "Report is too large" });
    }

    const { data: allowed, error: quotaErr } = await admin.rpc("mail_consume_quota", {
      p_user: userData.user.id,
      p_limit: DAILY_LIMIT,
    });
    if (quotaErr) throw quotaErr;
    if (allowed !== true) return json(429, { success: false, error: "Daily email limit reached" });

    const pass = Deno.env.get("GMAIL_PASS");
    if (!pass) return json(500, { success: false, error: "Mail is not configured" });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: SENDER, pass },
    });
    await transporter.sendMail({
      from: `"Expensify" <${SENDER}>`,
      to: email,
      subject: "Your Monthly Expense Report",
      html: htmlContent,
      attachments: [
        { filename: "expense_report.pdf", content: pdfBase64, encoding: "base64" },
      ],
    });
    return json(200, { success: true });
  } catch (err) {
    console.error("Email error:", err);
    return json(500, { success: false, error: "Couldn't send the email" });
  }
});

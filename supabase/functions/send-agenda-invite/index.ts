import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function buildInviteEmail(language: "ptBR" | "enUS", params: {
  agendaName: string;
  inviteLink: string;
  expiresAt: string;
}) {
  const isEnglish = language === "enUS";
  const agendaLabel = params.agendaName || (isEnglish ? "an agenda" : "uma agenda");
  const subject = isEnglish
    ? `You're invited to collaborate on ${agendaLabel}`
    : `Você foi convidado(a) para colaborar em ${agendaLabel}`;
  const intro = isEnglish
    ? `You've been invited to collaborate on ${agendaLabel}.`
    : `Você foi convidado(a) para colaborar na agenda ${agendaLabel}.`;
  const body = isEnglish
    ? "Click the button below to accept the invitation, create your account, and access the agenda."
    : "Clique no botão abaixo para aceitar o convite, criar sua conta e acessar a agenda.";
  const buttonLabel = isEnglish ? "Accept invitation" : "Aceitar convite";
  const fallback = isEnglish
    ? "If the button doesn't work, copy and paste this link into your browser:"
    : "Se o botão não funcionar, copie e cole este link no navegador:";

  const html = `<!doctype html>
<html lang="${isEnglish ? "en" : "pt-BR"}">
  <body style="margin:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border-radius:20px;padding:32px;border:1px solid #e5e7eb;">
        <div style="font-size:14px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;margin-bottom:16px;">
          Lophos Planner
        </div>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;color:#111827;">${subject}</h1>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#374151;">${intro}</p>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#374151;">${body}</p>
        <div style="margin:0 0 24px;">
          <a href="${params.inviteLink}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:700;font-size:16px;">
            ${buttonLabel}
          </a>
        </div>
        <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#6b7280;">
          ${fallback}
        </p>
        <p style="margin:0 0 16px;word-break:break-all;font-size:13px;line-height:1.5;color:#111827;">
          ${params.inviteLink}
        </p>
        <p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280;">
          ${isEnglish ? "This invitation expires on" : "Este convite expira em"} ${params.expiresAt}.
        </p>
      </div>
    </div>
  </body>
</html>`;

  const text = [
    subject,
    "",
    intro,
    body,
    "",
    `${fallback} ${params.inviteLink}`,
    "",
    `${isEnglish ? "Expires on" : "Expira em"} ${params.expiresAt}`,
  ].join("\n");

  return { subject, html, text };
}

async function sendInviteEmail(params: {
  apiKey: string;
  fromEmail: string;
  language: "ptBR" | "enUS";
  agendaName: string;
  inviteeEmail: string;
  inviteLink: string;
  expiresAt: string;
}) {
  const email = buildInviteEmail(params.language, {
    agendaName: params.agendaName,
    inviteLink: params.inviteLink,
    expiresAt: params.expiresAt,
  });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "lophos-planner/1.0",
    },
    body: JSON.stringify({
      from: params.fromEmail,
      to: params.inviteeEmail,
      subject: email.subject,
      html: email.html,
      text: email.text,
      tags: [
        { name: "app", value: "lophos-planner" },
        { name: "type", value: "agenda-invite" },
      ],
    }),
  });

  const rawBody = await response.text();
  let payload: unknown = null;

  try {
    payload = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    payload = rawBody;
  }

  if (!response.ok) {
    const message =
      (payload && typeof payload === "object" && "message" in payload && String((payload as { message?: string }).message || "")) ||
      (typeof payload === "string" ? payload : "") ||
      `Resend request failed with status ${response.status}.`;
    throw new Error(message);
  }

  return payload && typeof payload === "object" ? payload : { id: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL");

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !resendFromEmail) {
      return json({ error: "Missing required environment variables." }, 500);
    }

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) {
      return json({ error: "Unauthorized." }, 401);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: userResult, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userResult?.user) {
      return json({ error: "Unauthorized." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const agendaId = String(body?.agendaId || "").trim();
    const inviteeEmail = normalizeEmail(body?.email);
    const origin = String(body?.origin || req.headers.get("origin") || "").trim().replace(/\/$/, "");
    const language = String(body?.language || "ptBR").trim() === "enUS" ? "enUS" : "ptBR";

    if (!agendaId || !inviteeEmail) {
      return json({ error: "agendaId and email are required." }, 400);
    }

    const { data: agenda, error: agendaError } = await supabase
      .from("agendas")
      .select("id, name, uid")
      .eq("id", agendaId)
      .maybeSingle();

    if (agendaError) {
      throw agendaError;
    }

    if (!agenda) {
      return json({ error: "Agenda not found." }, 404);
    }

    if (String(agenda.uid) !== String(userResult.user.id)) {
      return json({ error: "Only the agenda owner can invite collaborators." }, 403);
    }

    const { data: existingUser, error: existingUserError } = await supabase
      .from("users")
      .select("id")
      .eq("email", inviteeEmail)
      .maybeSingle();

    if (existingUserError) {
      throw existingUserError;
    }

    if (existingUser?.id) {
      const { data: existingMember, error: existingMemberError } = await supabase
        .from("agenda_members")
        .select("uid")
        .eq("agenda_id", agendaId)
        .eq("uid", existingUser.id)
        .maybeSingle();

      if (existingMemberError) {
        throw existingMemberError;
      }

      if (existingMember) {
        return json({ error: "This user already has access to the agenda." }, 409);
      }
    }

    const inviteToken = crypto.randomUUID().replaceAll("-", "");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: pendingInvite, error: pendingInviteError } = await supabase
      .from("agenda_invites")
      .select("id")
      .eq("agenda_id", agendaId)
      .eq("invitee_email", inviteeEmail)
      .eq("status", "pending")
      .maybeSingle();

    if (pendingInviteError) {
      throw pendingInviteError;
    }

    let inviteRow;
    if (pendingInvite?.id) {
      const { data, error } = await supabase
        .from("agenda_invites")
        .update({
          token: inviteToken,
          invited_by: userResult.user.id,
          status: "pending",
          expires_at: expiresAt,
          accepted_by: null,
          accepted_at: null,
        })
        .eq("id", pendingInvite.id)
        .select("id, token, invitee_email")
        .single();

      if (error) {
        throw error;
      }

      inviteRow = data;
    } else {
      const { data, error } = await supabase
        .from("agenda_invites")
        .insert({
          agenda_id: agendaId,
          invitee_email: inviteeEmail,
          token: inviteToken,
          invited_by: userResult.user.id,
          status: "pending",
          expires_at: expiresAt,
        })
        .select("id, token, invitee_email")
        .single();

      if (error) {
        throw error;
      }

      inviteRow = data;
    }

    const redirectTo = `${origin}/?invite=${encodeURIComponent(inviteRow.token)}&email=${encodeURIComponent(inviteeEmail)}`;
    const emailResult = await sendInviteEmail({
      apiKey: resendApiKey,
      fromEmail: resendFromEmail,
      language,
      agendaName: String(agenda.name || ""),
      inviteeEmail,
      inviteLink: redirectTo,
      expiresAt,
    });

    return json({
      success: true,
      inviteId: inviteRow.id,
      inviteToken: inviteRow.token,
      inviteeEmail,
      email: emailResult,
    });
  } catch (err) {
    console.error("[send-agenda-invite] error", err);
    return json(
      {
        error: err instanceof Error ? err.message : "Unable to send invite.",
      },
      500
    );
  }
});

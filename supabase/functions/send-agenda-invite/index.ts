import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
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

    if (!supabaseUrl || !serviceRoleKey) {
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

    const { data: inviteResult, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(inviteeEmail, {
      redirectTo,
      data: {
        agenda_id: agendaId,
        agenda_name: agenda.name || "",
        invited_by: userResult.user.id,
        invite_token: inviteRow.token,
        invite_expires_at: expiresAt,
        invite_language: language,
      },
    });

    if (inviteError) {
      throw inviteError;
    }

    return json({
      success: true,
      inviteId: inviteRow.id,
      inviteToken: inviteRow.token,
      inviteeEmail,
      authInvite: inviteResult ?? null,
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



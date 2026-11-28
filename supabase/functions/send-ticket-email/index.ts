import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import nodemailer from 'npm:nodemailer@6.9.16';
import QRCode from 'npm:qrcode@1.5.4';
import { Buffer } from 'node:buffer';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function getServiceKey(): string {
  const rawSecretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (rawSecretKeys) {
    try {
      const parsed = JSON.parse(rawSecretKeys) as Record<string, string>;
      const secret = Object.values(parsed).find(
        (v) => typeof v === 'string' && v.startsWith('sb_secret_'),
      );
      if (secret) return secret;
    } catch {
      if (rawSecretKeys.startsWith('sb_secret_')) return rawSecretKeys;
    }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { attendee_id, updated } = (await req.json()) as {
      attendee_id?: unknown;
      updated?: boolean;
    };
    const isUpdated = updated === true;

    if (!attendee_id || typeof attendee_id !== 'string') {
      return new Response(JSON.stringify({ error: 'attendee_id is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = getServiceKey();
    const gmailUser = Deno.env.get('GMAIL_USER')!;
    const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: attendee, error: attendeeErr } = await supabase
      .from('attendees')
      .select('id, event_id, ticket_code, full_name, email, organization, status')
      .eq('id', attendee_id)
      .single();

    if (attendeeErr || !attendee) {
      return new Response(
        JSON.stringify({
          error: 'Attendee not found.',
          details: attendeeErr?.message ?? null,
          code: attendeeErr?.code ?? null,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (attendee.status !== 'approved') {
      return new Response(JSON.stringify({ error: 'Attendee registration is not approved.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('id, title, event_date, venue')
      .eq('id', attendee.event_id)
      .single();

    if (eventErr || !event) {
      return new Response(JSON.stringify({ error: 'Event not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const qrPngBuffer = await QRCode.toBuffer(attendee.ticket_code, {
      type: 'png',
      width: 320,
      margin: 2,
      color: { dark: '#18181b', light: '#ffffff' },
    });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });

    const safeName = escapeHtml(attendee.full_name);
    const safeOrg = escapeHtml(attendee.organization || 'Individual');
    const safeTicket = escapeHtml(attendee.ticket_code);
    const safeEventTitle = escapeHtml(event.title);
    const safeVenue = escapeHtml(event.venue);
    const formattedDate = escapeHtml(formatEventDate(event.event_date));

    const updatedBanner = isUpdated
      ? `
          <!-- Updated Event Notice -->
          <tr>
            <td style="padding:24px 32px 0;">
              <div style="background-color:#fdf2f4;background:linear-gradient(135deg,rgba(241,201,207,0.45) 0%,rgba(240,201,239,0.35) 100%);border:1px solid #f1c9cf;border-radius:18px;padding:14px 18px;">
                <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:#be185d;">
                  Event Details Updated
                </p>
                <p style="margin:6px 0 0;font-size:13px;line-height:1.55;font-weight:500;color:#3f3f46;">
                  The organizer has updated this event's details (title, date/time, or venue). Please review them above.
                  <strong style="color:#18181b;">Your existing QR pass below remains valid for entry.</strong>
                </p>
              </div>
            </td>
          </tr>
`
      : '';

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your PassFlow Ticket</title>
</head>
<body style="margin:0;padding:32px 16px;background-color:#f4f1fa;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:32px;overflow:hidden;border:1px solid #ebe6f7;box-shadow:0 16px 40px rgba(187,174,236,0.28);" cellspacing="0" cellpadding="0">

          <!-- Gradient Header -->
          <tr>
            <td style="background-color:#e4c5f0;background-image:linear-gradient(120deg,#bbaeec 0%,#f0c9ef 58%,#f1c9cf 100%);padding:32px 32px 28px;">
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2.6px;text-transform:uppercase;color:#4c3f8f;">
                PassFlow Events · Official Ticket
              </p>
              <h1 style="margin:10px 0 0;font-size:26px;line-height:1.2;font-weight:800;color:#18181b;">
                ${safeEventTitle}
              </h1>
              <p style="margin:12px 0 0;font-size:14px;line-height:1.6;font-weight:500;color:#27272a;">
                ${formattedDate}<br/>
                <strong style="color:#18181b;font-weight:700;">${safeVenue}</strong>
              </p>
            </td>
          </tr>
${updatedBanner}
          <!-- Attendee Info -->
          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#7c6fc4;">
                Attendee
              </p>
              <p style="margin:6px 0 0;font-size:20px;font-weight:800;color:#18181b;">
                ${safeName}
              </p>
              <p style="margin:2px 0 0;font-size:14px;font-weight:500;color:#52525b;">
                ${safeOrg}
              </p>
            </td>
          </tr>

          <!-- QR Pass -->
          <tr>
            <td align="center" style="padding:16px 32px 28px;">
              <div style="display:inline-block;background-color:#f7f4fd;background-image:linear-gradient(135deg,#f3effc 0%,#fbeef9 100%);border:1px solid #e4def5;border-radius:26px;padding:16px;">
                <div style="background:#ffffff;border-radius:18px;padding:14px;">
                  <img src="cid:ticket-qr" alt="Ticket QR Code" width="210" height="210" style="display:block;border-radius:8px;" />
                </div>
              </div>
              <p style="margin:18px 0 0;">
                <span style="display:inline-block;background-color:#f1ecfb;border:1px solid #e0d8f5;border-radius:999px;padding:8px 18px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:15px;font-weight:700;letter-spacing:2px;color:#4c3f8f;">
                  ${safeTicket}
                </span>
              </p>
              <p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:#71717a;">
                Present this QR code at the entrance for instant check-in.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #efeaf9;padding:18px 32px;background-color:#faf8fe;text-align:center;">
              <p style="margin:0;font-size:11px;color:#8b84a8;">
                Sent automatically by <strong style="color:#4c3f8f;">PassFlow Events</strong> · Keep this pass handy on your phone.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

    await transporter.sendMail({
      from: `"PassFlow Events" <${gmailUser}>`,
      to: attendee.email,
      subject: isUpdated
        ? `Updated Pass: ${event.title} — Your QR Ticket`
        : `Your Ticket Pass: ${event.title} (${attendee.ticket_code})`,
      html,
      attachments: [
        {
          filename: `${attendee.ticket_code}.png`,
          content: Buffer.from(qrPngBuffer),
          cid: 'ticket-qr',
          contentType: 'image/png',
        },
      ],
    });

    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send ticket email.';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
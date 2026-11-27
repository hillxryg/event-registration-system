import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import nodemailer from 'npm:nodemailer@6.9.16';
import QRCode from 'npm:qrcode@1.5.4';
import { Buffer } from 'node:buffer';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const gmailUser = Deno.env.get('GMAIL_USER')!;
    const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: attendee, error: attendeeErr } = await supabase
      .from('attendees')
      .select('id, event_id, ticket_code, full_name, email, organization, status')
      .eq('id', attendee_id)
      .single();

    if (attendeeErr || !attendee) {
      return new Response(JSON.stringify({ error: 'Attendee not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
            <td style="padding:20px 28px 0;">
              <div style="background:#fff1f2;border:1px solid #fda4af;border-radius:16px;padding:14px 16px;">
                <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#e11d48;">
                  Event Details Updated
                </p>
                <p style="margin:6px 0 0;font-size:13px;line-height:1.5;font-weight:500;color:#3f3f46;">
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
<body style="margin:0;padding:24px;background-color:#f4f4f5;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:28px;overflow:hidden;border:1px solid #e4e4e7;box-shadow:0 12px 32px rgba(24,24,27,0.08);" cellspacing="0" cellpadding="0">
          <!-- Header -->
          <tr>
            <td style="background:#18181b;padding:28px 28px 24px;color:#ffffff;">
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2.4px;text-transform:uppercase;color:#34d399;">
                PassFlow Official Ticket
              </p>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.25;font-weight:800;color:#ffffff;">
                ${safeEventTitle}
              </h1>
              <p style="margin:10px 0 0;font-size:13px;line-height:1.5;color:#a1a1aa;">
                ${formattedDate}<br/>
                <strong style="color:#e4e4e7;font-weight:600;">${safeVenue}</strong>
              </p>
            </td>
          </tr>
${updatedBanner}
          <!-- Attendee Info -->
          <tr>
            <td style="padding:24px 28px 16px;">
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:#71717a;">
                Attendee
              </p>
              <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#18181b;">
                ${safeName}
              </p>
              <p style="margin:2px 0 0;font-size:13px;font-weight:500;color:#52525b;">
                ${safeOrg}
              </p>
            </td>
          </tr>

          <!-- QR Pass -->
          <tr>
            <td align="center" style="padding:12px 28px 24px;">
              <div style="display:inline-block;background:#fafafa;border:1px solid #e4e4e7;border-radius:22px;padding:18px;">
                <img src="cid:ticket-qr" alt="Ticket QR Code" width="210" height="210" style="display:block;border-radius:12px;" />
              </div>
              <p style="margin:14px 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:15px;font-weight:700;letter-spacing:2px;color:#18181b;">
                ${safeTicket}
              </p>
              <p style="margin:6px 0 0;font-size:12px;color:#71717a;">
                Present this QR code at the entrance for instant check-in.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top:1px dashed #e4e4e7;padding:18px 28px;background:#fafafa;text-align:center;">
              <p style="margin:0;font-size:11px;color:#71717a;">
                Powered by <strong style="color:#18181b;">PassFlow</strong> · Keep this pass handy on your phone.
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
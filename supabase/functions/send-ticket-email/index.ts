import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.16';
import QRCode from 'npm:qrcode@1.5.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatEventDate(iso: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  }).format(new Date(iso));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { attendee_id } = await req.json();
    if (!attendee_id || typeof attendee_id !== 'string') {
      return new Response(JSON.stringify({ error: 'attendee_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const gmailUser = Deno.env.get('GMAIL_USER');
    const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD');

    if (!gmailUser || !gmailPass) {
      throw new Error('Missing GMAIL_USER or GMAIL_APP_PASSWORD secrets.');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: attendee, error: attErr } = await supabase
      .from('attendees')
      .select('id, full_name, email, organization, contact_number, ticket_code, status, event_id')
      .eq('id', attendee_id)
      .single();

    if (attErr || !attendee) {
      return new Response(JSON.stringify({ error: 'Attendee not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (attendee.status !== 'approved') {
      return new Response(JSON.stringify({ error: 'Ticket is not approved yet' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: event, error: evErr } = await supabase
      .from('events')
      .select('title, event_date, venue')
      .eq('id', attendee.event_id)
      .single();

    if (evErr || !event) {
      return new Response(JSON.stringify({ error: 'Event not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate PNG buffer for inline CID attachment
    const qrBuffer = await QRCode.toBuffer(attendee.ticket_code, {
      type: 'png',
      width: 360,
      margin: 2,
      color: {
        dark: '#18181B',
        light: '#FFFFFF',
      },
    });

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });

    const safeName = escapeHtml(attendee.full_name);
    const safeOrg = escapeHtml(attendee.organization);
    const safePhone = escapeHtml(attendee.contact_number);
    const safeCode = escapeHtml(attendee.ticket_code);
    const safeTitle = escapeHtml(event.title);
    const safeVenue = escapeHtml(event.venue);
    const formattedDate = escapeHtml(formatEventDate(event.event_date));

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your PassFlow Events Ticket</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f3fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 12px 32px rgba(24,24,27,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#bbaeec 0%,#f0c9ef 55%,#f1c9cf 100%);padding:28px 28px 24px;">
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#18181b;opacity:0.65;">
                PassFlow Events · Confirmed Pass
              </p>
              <h1 style="margin:8px 0 0;font-size:24px;line-height:1.25;font-weight:800;color:#18181b;">
                ${safeTitle}
              </h1>
              <p style="margin:10px 0 0;font-size:13px;font-weight:600;color:#18181b;opacity:0.8;">
                ${formattedDate}
              </p>
              <p style="margin:4px 0 0;font-size:13px;font-weight:500;color:#18181b;opacity:0.75;">
                ${safeVenue}
              </p>
            </td>
          </tr>

          <!-- Attendee Info -->
          <tr>
            <td style="padding:24px 28px 16px;">
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#71717a;">
                Attendee
              </p>
              <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#18181b;">
                ${safeName}
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px;">
                <tr>
                  <td width="50%" valign="top" style="padding-right:8px;">
                    <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#71717a;">
                      Organization
                    </p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#18181b;">
                      ${safeOrg}
                    </p>
                  </td>
                  <td width="50%" valign="top" style="padding-left:8px;">
                    <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#71717a;">
                      Contact
                    </p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#18181b;">
                      ${safePhone}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 28px;">
              <div style="border-top:2px dashed #e4e4e7;"></div>
            </td>
          </tr>

          <!-- QR Code -->
          <tr>
            <td align="center" style="padding:24px 28px 28px;">
              <div style="display:inline-block;padding:14px;background:#ffffff;border:1px solid #e4e4e7;border-radius:18px;">
                <img src="cid:ticket-qr" alt="Ticket QR Code" width="180" height="180" style="display:block;border:0;" />
              </div>
              <p style="margin:14px 0 0;font-family:monospace;font-size:15px;font-weight:700;letter-spacing:3px;color:#18181b;">
                ${safeCode}
              </p>
              <p style="margin:8px 0 0;font-size:12px;line-height:1.5;color:#71717a;">
                Present this QR code at the entrance gate for instant check-in.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#fafafa;padding:16px 28px;text-align:center;border-top:1px solid #f4f4f5;">
              <p style="margin:0;font-size:11px;color:#a1a1aa;">
                Sent automatically by <strong>PassFlow Events</strong>
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
      subject: `Your Ticket Pass: ${event.title} (${attendee.ticket_code})`,
      html,
      attachments: [
        {
          filename: `${attendee.ticket_code}.png`,
          content: qrBuffer,
          contentType: 'image/png',
          cid: 'ticket-qr',
        },
      ],
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send ticket email';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
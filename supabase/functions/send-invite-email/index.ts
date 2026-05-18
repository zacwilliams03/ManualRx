import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code, email, clientName, therapistName, clinicName } = await req.json()

    if (!code || !email || !clientName || !therapistName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const firstName = clientName.split(' ')[0]
    const inviteUrl = `${Deno.env.get('SITE_URL')}/join/${code}`
    const senderLine = clinicName?.trim()
      ? `${therapistName} from ${clinicName}`
      : therapistName

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="padding:32px 40px 24px;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#2E6B7A;letter-spacing:-0.3px;">ManualRx</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px;">
              <p style="margin:0 0 16px;font-size:16px;color:#1A1A1A;">Hi ${firstName},</p>
              <p style="margin:0 0 28px;font-size:16px;color:#1A1A1A;line-height:1.6;">${senderLine} has invited you to ManualRx, where you can view and complete your personalised exercise program.</p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:6px;background-color:#2E6B7A;">
                    <a href="${inviteUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">Set up your account →</a>
                  </td>
                </tr>
              </table>
              <p style="margin:28px 0 8px;font-size:13px;color:#6b7280;">This link expires in 7 days.</p>
              <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">If you weren't expecting this, you can safely ignore this email.</p>
              <p style="margin:0;font-size:13px;color:#6b7280;">Please don't reply — this inbox isn't monitored.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">ManualRx · manualrx.com</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ManualRx <invites@manualrx.com>',
        to: [email],
        subject: `${therapistName} has shared an exercise program with you`,
        html,
      }),
    })

    if (!resendRes.ok) {
      const resendError = await resendRes.text()
      console.error('Resend error:', resendError)
      return new Response(
        JSON.stringify({ error: 'Failed to send email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

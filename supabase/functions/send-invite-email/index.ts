import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('SITE_URL') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
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

    // Verify the caller is a therapist
    const { data: callerProfile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || callerProfile?.role !== 'therapist') {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the invite code belongs to this therapist
    const { data: invite, error: inviteError } = await supabase
      .from('client_invites')
      .select('therapist_id')
      .eq('code', code)
      .is('consumed_at', null)
      .single()

    if (inviteError || invite?.therapist_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const firstName = escapeHtml(clientName.split(' ')[0])
    const therapistFirstName = escapeHtml(therapistName.split(' ')[0])
    const inviteUrl = `${Deno.env.get('SITE_URL')}/join/${code}`
    const safeSenderLine = clinicName?.trim()
      ? `${therapistFirstName} from ${escapeHtml(clinicName.trim())}`
      : therapistFirstName

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#111111;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
          <tr>
            <td style="padding:32px 40px 24px;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#29B5CC;letter-spacing:-0.3px;">ManualRx</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px;">
              <p style="margin:0 0 16px;font-size:16px;color:#f0f0f0;">Hi ${firstName},</p>
              <p style="margin:0 0 28px;font-size:16px;color:#f0f0f0;line-height:1.6;">${safeSenderLine} has invited you to ManualRx, where you can view and complete your personalised exercise program.</p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:6px;background-color:#29B5CC;">
                    <a href="${inviteUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#0a0a0a;text-decoration:none;border-radius:6px;">Set up your account →</a>
                  </td>
                </tr>
              </table>
              <p style="margin:28px 0 8px;font-size:13px;color:#888888;">This link expires in 7 days.</p>
              <p style="margin:0 0 8px;font-size:13px;color:#888888;">If you weren't expecting this, you can safely ignore this email.</p>
              <p style="margin:0;font-size:13px;color:#888888;">Please don't reply — this inbox isn't monitored.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:12px;color:#888888;">ManualRx · manualrx.com</p>
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
        subject: `${therapistFirstName} has shared an exercise program with you`,
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

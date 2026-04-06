import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { configureWebhook } from '../_shared/webhook.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') ?? ''
const EVOLUTION_BASE_URL = Deno.env.get('EVOLUTION_BASE_URL') ?? ''

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function safeText(res: Response) {
  try {
    return await res.text()
  } catch {
    return ''
  }
}

async function getConnectionState(instanceName: string) {
  const res = await fetch(
    `${EVOLUTION_BASE_URL}/instance/connectionState/${instanceName}`,
    { method: 'GET', headers: { apikey: EVOLUTION_API_KEY } },
  )
  if (!res.ok)
    return { ok: false, state: null as string | null, raw: await safeText(res) }

  const data = await res.json().catch(() => ({}))
  const state =
    data?.instance?.state ||
    data?.state ||
    data?.instance?.status ||
    data?.status ||
    null
  return { ok: true, state, raw: data }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST')
    return jsonResponse({ error: 'Method Not Allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader)
      return jsonResponse({ error: 'Missing Authorization header' }, 401)

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'Supabase env missing' }, 500)
    }
    if (!EVOLUTION_BASE_URL || !EVOLUTION_API_KEY) {
      return jsonResponse({ error: 'Evolution API configuration missing' }, 500)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

    const instanceName = `user_${user.id.replace(/-/g, '')}`

    // Persist "connecting" early (idempotent)
    await supabase
      .from('evolution_instances')
      .upsert(
        { user_id: user.id, instance_name: instanceName, status: 'connecting' },
        { onConflict: 'user_id' },
      )

    let qr: string | null = null
    let status: 'connecting' | 'qrcode' | 'connected' = 'connecting'
    let isWebhookEnabled = false

    // 1) Try create (some versions return QR here)
    const createRes = await fetch(`${EVOLUTION_BASE_URL}/instance/create`, {
      method: 'POST',
      headers: {
        apikey: EVOLUTION_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      }),
    })

    if (createRes.ok) {
      const data = await createRes.json().catch(() => ({}))
      qr = data?.qrcode?.base64 ?? null

      const state =
        data?.instance?.state ||
        data?.instance?.status ||
        data?.state ||
        data?.status
      if (qr) status = 'qrcode'
      else if (state === 'open' || state === 'connected') status = 'connected'
    } else {
      const err = await safeText(createRes)
      // "already exists" é ok — vamos seguir fluxo
      console.log('[Instance Create] non-ok:', createRes.status, err)
    }

    // 2) If no QR/connected yet, try connect endpoint
    if (status === 'connecting') {
      const connectRes = await fetch(
        `${EVOLUTION_BASE_URL}/instance/connect/${instanceName}`,
        {
          method: 'GET',
          headers: { apikey: EVOLUTION_API_KEY },
        },
      )

      if (connectRes.ok) {
        const data = await connectRes.json().catch(() => ({}))
        // Evolution varia entre base64 e qrcode.base64
        qr = data?.base64 ?? data?.qrcode?.base64 ?? null

        const state =
          data?.instance?.state ||
          data?.instance?.status ||
          data?.state ||
          data?.status
        if (qr) status = 'qrcode'
        else if (state === 'open' || state === 'connected') status = 'connected'
      } else {
        console.log(
          '[Instance Connect] non-ok:',
          connectRes.status,
          await safeText(connectRes),
        )
      }
    }

    // 3) If still unknown, query connectionState
    if (status === 'connecting') {
      const st = await getConnectionState(instanceName)
      if (st.ok) {
        if (st.state === 'open' || st.state === 'connected')
          status = 'connected'
      } else {
        console.log('[ConnectionState] non-ok:', st.raw)
      }
    }

    // 4) Configure webhook when instance is at least created (qrcode/connected)
    if (status === 'qrcode' || status === 'connected') {
      try {
        isWebhookEnabled = await configureWebhook(
          instanceName,
          SUPABASE_URL,
          EVOLUTION_BASE_URL,
          EVOLUTION_API_KEY,
          // opcional: se sua Evolution suportar passar headers no webhook
          EVOLUTION_API_KEY,
        )
      } catch (webhookError) {
        console.error('[Webhook Config] Exception:', webhookError)
      }
    } else {
      console.log(
        `[Webhook Config] Skipped because instance is not ready. Status: ${status}`,
      )
    }

    // Save final status
    await supabase
      .from('evolution_instances')
      .update({ status, is_webhook_enabled: isWebhookEnabled })
      .eq('user_id', user.id)

    return jsonResponse({ instanceName, status, qr, isWebhookEnabled })
  } catch (error: any) {
    console.error('connect-whatsapp error:', error)
    return jsonResponse({ error: error?.message ?? 'Unknown error' }, 500)
  }
})

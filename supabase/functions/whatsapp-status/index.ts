import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY')
const EVOLUTION_BASE_URL = Deno.env.get('EVOLUTION_BASE_URL')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    const { data: instance } = await supabase
      .from('evolution_instances')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!instance) {
      return new Response(JSON.stringify({ status: 'disconnected' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const stateRes = await fetch(
      `${EVOLUTION_BASE_URL}/instance/connectionState/${instance.instance_name}`,
      {
        headers: { apikey: EVOLUTION_API_KEY! },
      },
    )

    let status = instance.status

    if (stateRes.ok) {
      const data = await stateRes.json()
      if (data.instance?.state === 'open') {
        status = 'connected'
      } else if (data.instance?.state === 'connecting') {
        status = 'connecting'
      } else {
        status = 'disconnected'
      }

      await supabase
        .from('evolution_instances')
        .update({ status })
        .eq('id', instance.id)
    }

    return new Response(JSON.stringify({ status }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

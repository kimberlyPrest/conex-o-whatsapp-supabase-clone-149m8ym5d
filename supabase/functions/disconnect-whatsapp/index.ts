import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') ?? ''
const EVOLUTION_BASE_URL = Deno.env.get('EVOLUTION_BASE_URL') ?? ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST')
    return new Response('Method Not Allowed', {
      status: 405,
      headers: corsHeaders,
    })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    // Find the active instance for the user
    const { data: instance, error: instanceError } = await supabase
      .from('evolution_instances')
      .select('instance_name')
      .eq('user_id', user.id)
      .single()

    if (instanceError && instanceError.code !== 'PGRST116') {
      throw instanceError
    }

    if (instance) {
      const instanceName = instance.instance_name

      // 1. Logout from Evolution API (Disconnects WhatsApp session)
      try {
        await fetch(`${EVOLUTION_BASE_URL}/instance/logout/${instanceName}`, {
          method: 'DELETE',
          headers: { apikey: EVOLUTION_API_KEY },
        })
      } catch (err) {
        console.error('Error logging out from Evolution API:', err)
      }

      // 2. Delete instance from Evolution API (Cleans up resources)
      try {
        await fetch(`${EVOLUTION_BASE_URL}/instance/delete/${instanceName}`, {
          method: 'DELETE',
          headers: { apikey: EVOLUTION_API_KEY },
        })
      } catch (err) {
        console.error('Error deleting instance from Evolution API:', err)
      }

      // 3. Remove instance from database
      const { error: deleteError } = await supabase
        .from('evolution_instances')
        .delete()
        .eq('user_id', user.id)

      if (deleteError) {
        throw new Error('Database deletion failed: ' + deleteError.message)
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Disconnect error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

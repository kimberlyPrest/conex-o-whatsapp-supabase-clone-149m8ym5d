import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY')
const EVOLUTION_BASE_URL = Deno.env.get('EVOLUTION_BASE_URL')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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

    const { conversationId, text } = await req.json()

    if (!conversationId || !text) {
      throw new Error('Missing conversationId or text')
    }

    if (!EVOLUTION_BASE_URL || !EVOLUTION_API_KEY) {
      throw new Error('Evolution API configuration missing')
    }

    // Get conversation details to find the contact_id and instance_name
    const { data: conversation, error: convError } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single()

    if (convError || !conversation) {
      throw new Error('Conversation not found')
    }

    // Send message via Evolution API
    const payloadBody = {
      number: conversation.contact_id,
      text: text,
      options: {
        delay: 100,
        presence: 'composing',
        linkPreview: true,
      },
    }

    const sendResponse = await fetch(
      `${EVOLUTION_BASE_URL}/message/sendText/${conversation.instance_name}`,
      {
        method: 'POST',
        headers: {
          apikey: EVOLUTION_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payloadBody),
      },
    )

    if (!sendResponse.ok) {
      const errText = await sendResponse.text()
      console.error('Evolution Send Error:', errText)
      throw new Error(`Failed to send message via WhatsApp: ${errText}`)
    }

    // Save message to database
    const { data: message, error: msgError } = await supabase
      .from('whatsapp_messages')
      .insert({
        user_id: user.id,
        conversation_id: conversation.id,
        direction: 'out',
        message_text: text,
        raw_payload: {},
      })
      .select()
      .single()

    if (msgError) throw msgError

    // Update last_message_at
    await supabase
      .from('whatsapp_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversation.id)

    return new Response(JSON.stringify(message), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Error sending manual message:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

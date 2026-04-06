import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { callOpenAI, callGemini, callClaude } from '../_shared/ai.ts'
import { decrypt } from '../_shared/crypto.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const now = Date.now()

    // 1. Move to Em Espera (Inactivity > 5 mins)
    const fiveMinsAgo = new Date(now - 5 * 60 * 1000).toISOString()
    await supabase
      .from('whatsapp_conversations')
      .update({
        crm_status: 'em_espera',
        status_updated_at: new Date().toISOString(),
      })
      .eq('crm_status', 'em_atendimento')
      .lt('status_updated_at', fiveMinsAgo)

    // 2. AI Classification (> 15 mins in Em Espera)
    const fifteenMinsAgo = new Date(now - 15 * 60 * 1000).toISOString()
    const { data: toClassify } = await supabase
      .from('whatsapp_conversations')
      .select('id, user_id')
      .eq('crm_status', 'em_espera')
      .lt('status_updated_at', fifteenMinsAgo)
      .limit(20)

    for (const conv of toClassify || []) {
      try {
        const { data: agent } = await supabase
          .from('ai_agents')
          .select('*')
          .eq('user_id', conv.user_id)
          .eq('is_active', true)
          .single()

        // Fetch all available keys for the user to implement fallback logic
        const { data: keysData } = await supabase
          .from('ai_provider_keys')
          .select('provider, api_key_encrypted')
          .eq('user_id', conv.user_id)

        if (!keysData || keysData.length === 0) continue // Skip if no API keys at all

        let providerToUse = agent?.provider || 'openai'
        let modelToUse = agent?.model || 'gpt-4o-mini'

        let keyData = keysData.find((k) => k.provider === providerToUse)

        // Resilient fallback if the preferred provider has no key
        if (!keyData) {
          keyData = keysData[0] // take the first available key
          providerToUse = keyData.provider
          if (providerToUse === 'openai') modelToUse = 'gpt-4o-mini'
          else if (providerToUse === 'gemini') modelToUse = 'gemini-1.5-flash'
          else if (providerToUse === 'claude')
            modelToUse = 'claude-3-haiku-20240307'
        }

        const apiKey = await decrypt(keyData.api_key_encrypted)

        // Fetch recent messages context
        const { data: msgs } = await supabase
          .from('whatsapp_messages')
          .select('direction, message_text')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(20)

        const sysPrompt = `You are a CRM classifier. Analyze the provided conversation history.
If the customer's goal was met, their questions were answered, or the interaction ended positively, reply with EXACTLY the word "resolvido".
If the lead was lost, the customer stopped responding without completing the flow, or the interaction ended negatively, reply with EXACTLY the word "perdido".
Do not output any additional text.`

        const formattedMsgs = (msgs || []).reverse()
        let result = 'resolvido'

        if (providerToUse === 'openai') {
          result = await callOpenAI(
            apiKey,
            modelToUse,
            sysPrompt,
            formattedMsgs,
          )
        } else if (providerToUse === 'claude') {
          result = await callClaude(
            apiKey,
            modelToUse,
            sysPrompt,
            formattedMsgs,
          )
        } else {
          result = await callGemini(
            apiKey,
            modelToUse,
            sysPrompt,
            formattedMsgs,
          )
        }

        const finalStatus = result.toLowerCase().includes('perdido')
          ? 'perdido'
          : 'resolvido'

        await supabase
          .from('whatsapp_conversations')
          .update({
            crm_status: finalStatus,
            status_updated_at: new Date().toISOString(),
          })
          .eq('id', conv.id)
      } catch (err) {
        console.error(`Error classifying conversation ${conv.id}:`, err)
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'CRM automation completed.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (err: any) {
    console.error('CRM Automation Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

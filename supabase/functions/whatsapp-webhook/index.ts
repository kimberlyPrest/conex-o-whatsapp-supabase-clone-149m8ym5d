import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { decrypt } from '../_shared/crypto.ts'
import {
  callOpenAI,
  callGemini,
  callClaude,
  generateEmbedding,
  transcribeAudio,
} from '../_shared/ai.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY')
const EVOLUTION_BASE_URL = Deno.env.get('EVOLUTION_BASE_URL')

Deno.serve(async (req) => {
  const webhookApiKey = req.headers.get('apikey')
  if (
    EVOLUTION_API_KEY &&
    webhookApiKey &&
    webhookApiKey !== EVOLUTION_API_KEY
  ) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const payload = await req.json()
    const rawEvent = payload.event ?? payload.type ?? ''
    const eventType = String(rawEvent).toUpperCase().replace('.', '_')
    const instance = payload.instance || payload.sender || 'default'
    const messageData = payload.data?.data || payload.data

    if (eventType !== 'MESSAGES_UPSERT')
      return new Response('Ignored event type', { status: 200 })
    if (!messageData || messageData.key?.fromMe || !messageData.key?.remoteJid)
      return new Response('Ignored/No Data', { status: 200 })

    let messageText = ''
    let mediaType: 'image' | 'audio' | null = null
    let mediaMimeType = ''

    let msgContent = messageData.message
    if (msgContent?.ephemeralMessage?.message)
      msgContent = msgContent.ephemeralMessage.message
    if (msgContent?.documentWithCaptionMessage?.message)
      msgContent = msgContent.documentWithCaptionMessage.message
    if (msgContent?.viewOnceMessage?.message)
      msgContent = msgContent.viewOnceMessage.message
    if (msgContent?.viewOnceMessageV2?.message)
      msgContent = msgContent.viewOnceMessageV2.message

    if (msgContent?.conversation) messageText = msgContent.conversation
    else if (msgContent?.extendedTextMessage?.text)
      messageText = msgContent.extendedTextMessage.text
    else if (msgContent?.imageMessage) {
      messageText = msgContent.imageMessage.caption || ''
      mediaType = 'image'
      mediaMimeType = msgContent.imageMessage.mimetype || 'image/jpeg'
    } else if (msgContent?.videoMessage?.caption)
      messageText = msgContent.videoMessage.caption
    else if (msgContent?.audioMessage) {
      mediaType = 'audio'
      mediaMimeType = msgContent.audioMessage.mimetype || 'audio/ogg'
    } else if (msgContent?.documentMessage) {
      messageText = msgContent.documentMessage.fileName || ''
    }

    if (!messageText && messageData.text) messageText = messageData.text

    if (!messageText && !mediaType)
      return new Response('Ignored non-text message', { status: 200 })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: instanceData } = await supabase
      .from('evolution_instances')
      .select('user_id')
      .eq('instance_name', instance)
      .single()
    if (!instanceData) return new Response('Unknown instance', { status: 404 })

    const userId = instanceData.user_id
    const contactId = messageData.key.remoteJid.split('@')[0]

    const { data: agent } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()
    let apiKey = ''
    if (agent) {
      const { data: keyData } = await supabase
        .from('ai_provider_keys')
        .select('api_key_encrypted')
        .eq('user_id', userId)
        .eq('provider', agent.provider)
        .single()
      if (keyData) apiKey = await decrypt(keyData.api_key_encrypted)
    }

    let mediaBase64 = ''
    if (mediaType && apiKey) {
      try {
        const b64Res = await fetch(
          `${EVOLUTION_BASE_URL}/chat/getBase64FromMediaMessage/${instance}`,
          {
            method: 'POST',
            headers: {
              apikey: EVOLUTION_API_KEY!,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: messageData }),
          },
        )
        if (b64Res.ok) mediaBase64 = (await b64Res.json()).base64
      } catch (err) {
        console.error('Base64 error', err)
      }

      if (mediaType === 'audio' && agent.provider === 'openai' && mediaBase64) {
        try {
          messageText = await transcribeAudio(
            apiKey,
            mediaBase64,
            mediaMimeType,
          )
          mediaBase64 = ''
          mediaType = null
        } catch (e) {
          messageText = '[Audio Transcription Failed]'
          mediaBase64 = ''
          mediaType = null
        }
      }
    }

    let dbMessageText = messageText
    if (mediaType === 'image')
      dbMessageText = messageText ? `[Image]: ${messageText}` : `[Image]`
    else if (mediaType === 'audio') dbMessageText = `[Audio]`

    const rawTs =
      messageData.messageTimestamp ||
      messageData.timestamp ||
      messageData.message?.messageTimestamp ||
      Math.floor(Date.now() / 1000)
    const messageTimestamp =
      Number(rawTs) > 20000000000 ? Number(rawTs) / 1000 : Number(rawTs)
    const createdAtIso = new Date(messageTimestamp * 1000).toISOString()

    const upsertPayload: any = {
      user_id: userId,
      instance_name: instance,
      contact_id: contactId,
      last_message_at: createdAtIso,
      crm_status: 'em_atendimento',
      status_updated_at: new Date().toISOString(),
    }
    if (messageData.pushName) upsertPayload.contact_name = messageData.pushName

    const { data: conversation, error: convoError } = await supabase
      .from('whatsapp_conversations')
      .upsert(upsertPayload, { onConflict: 'user_id, contact_id' })
      .select()
      .single()
    if (convoError) throw convoError

    const externalMessageId = messageData.key?.id || messageData.id || null

    const { data: savedMessage, error: msgError } = await supabase
      .from('whatsapp_messages')
      .upsert(
        {
          user_id: userId,
          conversation_id: conversation.id,
          direction: 'in',
          message_text: dbMessageText,
          raw_payload: messageData,
          created_at: createdAtIso,
          external_message_id: externalMessageId,
        },
        { onConflict: 'conversation_id,external_message_id' },
      )
      .select('id, created_at')
      .single()

    if (msgError) {
      console.error('Error upserting message:', msgError)
      throw msgError
    }

    if (!agent) {
      await supabase
        .from('whatsapp_conversations')
        .update({ is_agent_paused: true })
        .eq('id', conversation.id)
      return new Response('No Active Agent, paused bot', { status: 200 })
    }

    if (!apiKey) {
      await supabase
        .from('whatsapp_conversations')
        .update({ is_agent_paused: true })
        .eq('id', conversation.id)
      return new Response('No API Key, paused bot', { status: 200 })
    }

    if ((conversation as any).is_agent_paused) {
      return new Response('Bot is paused for this conversation', {
        status: 200,
      })
    }

    const TOTAL_BUFFER = 10000
    const TYPING_BUFFER = 5000
    if (TOTAL_BUFFER > TYPING_BUFFER)
      await new Promise((r) => setTimeout(r, TOTAL_BUFFER - TYPING_BUFFER))

    try {
      await fetch(`${EVOLUTION_BASE_URL}/chat/sendPresence/${instance}`, {
        method: 'POST',
        headers: {
          apikey: EVOLUTION_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: contactId,
          presence: 'composing',
          delay: 15000,
        }),
      })
    } catch (err) {
      console.error('Typing ind error', err)
    }

    await new Promise((r) =>
      setTimeout(r, Math.min(TOTAL_BUFFER, TYPING_BUFFER)),
    )

    const { data: newerMessages } = await supabase
      .from('whatsapp_messages')
      .select('id')
      .eq('conversation_id', conversation.id)
      .eq('direction', 'in')
      .gt('created_at', savedMessage!.created_at)
      .limit(1)
    if (newerMessages && newerMessages.length > 0)
      return new Response('Message buffered', { status: 200 })

    const { data: history } = await supabase
      .from('whatsapp_messages')
      .select('direction, message_text')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(30)
    const rawMessages = (history || []).reverse()
    const col: any[] = []

    for (let i = 0; i < rawMessages.length; i++) {
      const msg = rawMessages[i]
      if (!msg.message_text) continue
      const isLast = i === rawMessages.length - 1
      const msgObj: any = {
        direction: msg.direction,
        message_text: msg.message_text,
      }

      if (isLast && mediaBase64) {
        msgObj.mediaBase64 = mediaBase64
        msgObj.mediaType = mediaType
        msgObj.mediaMimeType = mediaMimeType
        msgObj.message_text = messageText
      }
      if (col.length === 0) col.push(msgObj)
      else {
        const last = col[col.length - 1]
        if (
          last.direction === msg.direction &&
          !last.mediaBase64 &&
          !msgObj.mediaBase64
        )
          last.message_text += '\n' + msgObj.message_text
        else col.push(msgObj)
      }
    }

    let systemPrompt = agent.system_prompt
    if (
      agent.knowledge_base_url &&
      ['ready', 'completed'].includes(agent.knowledge_base_status || '')
    ) {
      try {
        const embedText = col[col.length - 1]?.message_text || messageText
        if (embedText && agent.provider !== 'claude') {
          console.log(
            `[RAG] Generating embedding for text length: ${embedText.length}, Provider: ${agent.provider}`,
          )
          const emb = await generateEmbedding(embedText, apiKey, agent.provider)
          if (emb) {
            const { data: ctx } = await supabase.rpc('match_agent_knowledge', {
              query_embedding: emb,
              match_threshold: 0.4,
              match_count: 5,
              filter_agent_id: agent.id,
            })
            console.log(
              `[RAG] Vector search completed. Found ${ctx?.length || 0} matches.`,
            )
            if (ctx && ctx.length > 0) {
              const contextText = ctx.map((c: any) => c.content).join('\n\n')
              systemPrompt += `\n\n=== KNOWLEDGE BASE CONTEXT ===\n${contextText}\n==============================\n\nPlease use the context above to inform your response. If the context does not contain relevant information, rely on your general knowledge.`
            }
          }
        } else if (embedText && agent.provider === 'claude') {
          console.log(
            `[RAG] Skipped embedding generation. Claude provider does not support native embeddings.`,
          )
        }
      } catch (err) {
        console.error('[RAG] Error during knowledge retrieval:', err)
      }
    }

    let aiResponseText = ''
    try {
      if (agent.provider === 'openai') {
        aiResponseText = await callOpenAI(
          apiKey,
          agent.model,
          systemPrompt,
          col,
        )
      } else if (agent.provider === 'claude') {
        aiResponseText = await callClaude(
          apiKey,
          agent.model,
          systemPrompt,
          col,
        )
      } else {
        aiResponseText = await callGemini(
          apiKey,
          agent.model,
          systemPrompt,
          col,
        )
      }
    } catch (err: any) {
      console.error('[AI] Generation Error:', err.message)
      await supabase
        .from('whatsapp_conversations')
        .update({ is_agent_paused: true })
        .eq('id', conversation.id)
      return new Response('AI Error, paused bot', { status: 500 })
    }

    if (!aiResponseText)
      return new Response('Empty AI response', { status: 200 })

    await fetch(`${EVOLUTION_BASE_URL}/message/sendText/${instance}`, {
      method: 'POST',
      headers: {
        apikey: EVOLUTION_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: contactId,
        text: aiResponseText,
        options: { delay: 1200, presence: 'composing', linkPreview: true },
      }),
    })

    await supabase.from('whatsapp_messages').insert({
      user_id: userId,
      conversation_id: conversation.id,
      direction: 'out',
      message_text: aiResponseText,
      raw_payload: { messageTimestamp: Math.floor(Date.now() / 1000) },
      created_at: new Date().toISOString(),
    })

    return new Response('Message processed', { status: 200 })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    })
  }
})

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') ?? ''
const EVOLUTION_BASE_URL = Deno.env.get('EVOLUTION_BASE_URL') ?? ''

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

    if (!instance) throw new Error('Nenhuma instância do WhatsApp conectada.')

    // Fetch chats
    let chats = []
    try {
      const chatsRes = await fetch(
        `${EVOLUTION_BASE_URL}/chat/findChats/${instance.instance_name}`,
        {
          method: 'POST',
          headers: {
            apikey: EVOLUTION_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        },
      )

      if (chatsRes.ok) {
        chats = await chatsRes.json()
      } else {
        const getChatsRes = await fetch(
          `${EVOLUTION_BASE_URL}/chat/findChats/${instance.instance_name}`,
          {
            method: 'GET',
            headers: { apikey: EVOLUTION_API_KEY },
          },
        )
        if (getChatsRes.ok) {
          chats = await getChatsRes.json()
        }
      }
    } catch (e) {
      console.error('Error fetching chats:', e)
    }

    const chatsList = Array.isArray(chats)
      ? chats
      : chats?.data || chats?.chats || []
    const topChats = chatsList.slice(0, 30)

    let syncedConversations = 0
    let syncedMessages = 0

    for (const chat of topChats) {
      const remoteJid = chat.id || chat.remoteJid
      if (
        !remoteJid ||
        remoteJid.includes('@g.us') ||
        remoteJid.includes('status@broadcast')
      )
        continue

      const contactId = remoteJid.split('@')[0]
      const timestamp = chat.conversationTimestamp || chat.timestamp

      const upsertPayload: any = {
        user_id: user.id,
        instance_name: instance.instance_name,
        contact_id: contactId,
        last_message_at: timestamp
          ? new Date(timestamp * 1000).toISOString()
          : new Date().toISOString(),
      }

      const contactName = chat.name || chat.pushName
      if (contactName) {
        upsertPayload.contact_name = contactName
      }

      const { data: conv } = await supabase
        .from('whatsapp_conversations')
        .upsert(upsertPayload, { onConflict: 'user_id, contact_id' })
        .select()
        .single()

      if (!conv) continue
      syncedConversations++

      const { count } = await supabase
        .from('whatsapp_messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conv.id)
      if (count && count > 0) continue

      let msgs = []
      try {
        const msgsRes = await fetch(
          `${EVOLUTION_BASE_URL}/chat/findMessages/${instance.instance_name}`,
          {
            method: 'POST',
            headers: {
              apikey: EVOLUTION_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              remoteJid,
              where: { remoteJid },
              limit: 20,
            }),
          },
        )

        if (msgsRes.ok) {
          const msgsData = await msgsRes.json()
          msgs = Array.isArray(msgsData)
            ? msgsData
            : msgsData?.messages || msgsData?.data || []
        }
      } catch (e) {
        console.error('Error fetching messages for chat:', remoteJid, e)
      }

      if (msgs.length > 0) {
        msgs.sort(
          (a: any, b: any) =>
            (a.messageTimestamp || 0) - (b.messageTimestamp || 0),
        )

        for (const m of msgs.slice(-20)) {
          const fromMe = m.key?.fromMe || false
          const msgContent = m.message
          let text = ''
          if (msgContent?.conversation) text = msgContent.conversation
          else if (msgContent?.extendedTextMessage?.text)
            text = msgContent.extendedTextMessage.text
          else if (msgContent?.imageMessage)
            text = '[Image] ' + (msgContent.imageMessage.caption || '')
          else if (msgContent?.audioMessage) text = '[Audio]'
          else if (msgContent?.videoMessage)
            text = '[Video] ' + (msgContent.videoMessage.caption || '')
          else if (msgContent?.documentMessage)
            text = '[Document] ' + (msgContent.documentMessage.fileName || '')

          if (!text) continue

          const msgTimestamp = m.messageTimestamp || m.timestamp

          await supabase.from('whatsapp_messages').insert({
            user_id: user.id,
            conversation_id: conv.id,
            direction: fromMe ? 'out' : 'in',
            message_text: text,
            raw_payload: m,
            created_at: msgTimestamp
              ? new Date(msgTimestamp * 1000).toISOString()
              : new Date().toISOString(),
          })
          syncedMessages++
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, syncedConversations, syncedMessages }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error: any) {
    console.error('Sync Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

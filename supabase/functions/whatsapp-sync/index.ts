import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, x-supabase-client-platform, apikey, content-type',
}

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

    let body: any = {}
    try {
      body = await req.json()
    } catch (e) {}

    const isBackground = body.background === true
    const chatOffset = body.chatOffset || 0

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

    const BATCH_SIZE = 15
    const topChats = isBackground
      ? chatsList.slice(chatOffset, chatOffset + BATCH_SIZE)
      : chatsList.slice(0, 30)

    let syncedConversations = 0
    let syncedMessages = 0

    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    const thresholdTs = Math.floor(threeMonthsAgo.getTime() / 1000)

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

      const { data: existingMsgs } = await supabase
        .from('whatsapp_messages')
        .select('raw_payload')
        .eq('conversation_id', conv.id)

      const existingIds = new Set(
        existingMsgs?.map((m: any) => m.raw_payload?.key?.id).filter(Boolean),
      )

      let page = 1
      let hasMore = true

      while (hasMore) {
        let msgs: any[] = []
        try {
          const msgsRes = await fetch(
            `${EVOLUTION_BASE_URL}/chat/findMessages/${instance.instance_name}`,
            {
              method: 'POST',
              headers: {
                apikey: EVOLUTION_API_KEY,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ remoteJid, page, limit: 100 }),
            },
          )

          if (msgsRes.ok) {
            const msgsData = await msgsRes.json()
            const extracted = Array.isArray(msgsData)
              ? msgsData
              : msgsData?.messages || msgsData?.data
            msgs = Array.isArray(extracted) ? extracted : []
          }
        } catch (e) {
          console.error('Error fetching messages for chat:', remoteJid, e)
        }

        if (!Array.isArray(msgs) || msgs.length === 0) {
          hasMore = false
          break
        }

        msgs.sort(
          (a: any, b: any) =>
            (a.messageTimestamp || 0) - (b.messageTimestamp || 0),
        )

        let oldestMsgTs = Infinity

        for (const m of msgs) {
          const msgTimestamp = m.messageTimestamp || m.timestamp
          if (msgTimestamp && msgTimestamp < oldestMsgTs)
            oldestMsgTs = msgTimestamp

          const messageId = m.key?.id
          if (messageId && existingIds.has(messageId)) continue

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

          const { error: insertError } = await supabase
            .from('whatsapp_messages')
            .insert({
              user_id: user.id,
              conversation_id: conv.id,
              direction: fromMe ? 'out' : 'in',
              message_text: text,
              raw_payload: m,
              created_at: msgTimestamp
                ? new Date(msgTimestamp * 1000).toISOString()
                : new Date().toISOString(),
            })

          if (!insertError) {
            syncedMessages++
            if (messageId) existingIds.add(messageId)
          }
        }

        if (msgs.length < 100) {
          hasMore = false
        } else {
          page++
        }

        if (!isBackground && oldestMsgTs < thresholdTs) {
          hasMore = false
        }
      }
    }

    if (!isBackground && chatsList.length > 30) {
      supabase.functions
        .invoke('whatsapp-sync', {
          body: { background: true, chatOffset: 30 },
        })
        .catch((e) => console.error('Error invoking background sync:', e))
    } else if (isBackground && chatOffset + BATCH_SIZE < chatsList.length) {
      supabase.functions
        .invoke('whatsapp-sync', {
          body: { background: true, chatOffset: chatOffset + BATCH_SIZE },
        })
        .catch((e) => console.error('Error invoking next background sync:', e))
    }

    return new Response(
      JSON.stringify({
        success: true,
        syncedConversations,
        syncedMessages,
        isBackground,
        chatOffset,
      }),
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

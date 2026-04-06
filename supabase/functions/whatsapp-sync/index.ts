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

    let body: any = {};
    try {
      body = await req.json();
    } catch(e) {}
    
    const isBackground = body.background === true;
    const chatOffset = body.chatOffset || 0;

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
      : chats?.records || chats?.data?.records || chats?.data || chats?.chats || []
      
    const BATCH_SIZE = 5;
    const INITIAL_BATCH_SIZE = 10;
    const topChats = isBackground ? chatsList.slice(chatOffset, chatOffset + BATCH_SIZE) : chatsList.slice(0, INITIAL_BATCH_SIZE);

    let syncedConversations = 0
    let syncedMessages = 0

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const thresholdTs = Math.floor(threeMonthsAgo.getTime() / 1000);

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
        .eq('conversation_id', conv.id);
      
      const existingIds = new Set(existingMsgs?.map((m: any) => m.raw_payload?.key?.id || m.raw_payload?.id).filter(Boolean));

      let page = 1;
      let hasMore = true;

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
              body: JSON.stringify({ where: { remoteJid }, remoteJid, page, limit: 100 }),
            },
          )

          if (msgsRes.ok) {
            const msgsData = await msgsRes.json()
            let extracted = msgsData;
            if (!Array.isArray(extracted)) extracted = extracted?.messages;
            if (!Array.isArray(extracted)) extracted = extracted?.records;
            if (!Array.isArray(extracted)) extracted = msgsData?.data?.records || msgsData?.data;
            msgs = Array.isArray(extracted) ? extracted : [];
          } else {
            console.error('Failed to fetch messages. Status:', msgsRes.status, await msgsRes.text());
          }
        } catch (e) {
          console.error('Error fetching messages for chat:', remoteJid, e)
        }

        if (!Array.isArray(msgs) || msgs.length === 0) {
          hasMore = false;
          break;
        }

        msgs.sort(
          (a: any, b: any) => {
            const tsA = a.messageTimestamp || a.timestamp || a.message?.messageTimestamp || 0;
            const tsB = b.messageTimestamp || b.timestamp || b.message?.messageTimestamp || 0;
            return Number(tsA) - Number(tsB);
          }
        )

        let oldestMsgTs = Infinity;
        const messagesToInsert = [];

        for (const m of msgs) {
          const rawTs = m.messageTimestamp || m.timestamp || m.message?.messageTimestamp;
          const msgTimestamp = rawTs ? (Number(rawTs) > 20000000000 ? Number(rawTs) / 1000 : Number(rawTs)) : undefined;
          if (msgTimestamp && msgTimestamp < oldestMsgTs) oldestMsgTs = msgTimestamp;

          const messageId = m.key?.id || m.id;
          if (messageId && existingIds.has(messageId)) continue;

          const fromMe = m.key?.fromMe ?? m.fromMe ?? false;
          
          let msgContent = m.message;
          if (msgContent?.ephemeralMessage?.message) msgContent = msgContent.ephemeralMessage.message;
          if (msgContent?.documentWithCaptionMessage?.message) msgContent = msgContent.documentWithCaptionMessage.message;
          if (msgContent?.viewOnceMessage?.message) msgContent = msgContent.viewOnceMessage.message;
          if (msgContent?.viewOnceMessageV2?.message) msgContent = msgContent.viewOnceMessageV2.message;

          let text = m.text || '';
          if (!text && msgContent) {
            if (msgContent.conversation) text = msgContent.conversation;
            else if (msgContent.extendedTextMessage?.text) text = msgContent.extendedTextMessage.text;
            else if (msgContent.imageMessage) text = msgContent.imageMessage.caption ? `[Image] ${msgContent.imageMessage.caption}` : '[Image]';
            else if (msgContent.videoMessage) text = msgContent.videoMessage.caption ? `[Video] ${msgContent.videoMessage.caption}` : '[Video]';
            else if (msgContent.audioMessage) text = '[Audio]';
            else if (msgContent.documentMessage) text = msgContent.documentMessage.fileName ? `[Document] ${msgContent.documentMessage.fileName}` : '[Document]';
          }
          
          if (!text && m.messageType === 'imageMessage') text = '[Image]';
          if (!text && m.messageType === 'audioMessage') text = '[Audio]';
          if (!text && m.messageType === 'videoMessage') text = '[Video]';
          if (!text && m.messageType === 'documentMessage') text = '[Document]';
          if (!text && m.messageType === 'extendedTextMessage' && m.text) text = m.text;

          if (!text) continue

          messagesToInsert.push({
            user_id: user.id,
            conversation_id: conv.id,
            direction: fromMe ? 'out' : 'in',
            message_text: text,
            raw_payload: m,
            created_at: msgTimestamp
              ? new Date(msgTimestamp * 1000).toISOString()
              : new Date().toISOString(),
          });
        }

        if (messagesToInsert.length > 0) {
          const { error: insertError } = await supabase.from('whatsapp_messages').insert(messagesToInsert);
          if (!insertError) {
             syncedMessages += messagesToInsert.length;
             for (const m of messagesToInsert) {
               const msgId = m.raw_payload?.key?.id || m.raw_payload?.id;
               if (msgId) existingIds.add(msgId);
             }
          } else {
             console.error('Error inserting messages:', insertError);
          }
        }

        if (msgs.length < 100) {
          hasMore = false;
        } else {
          page++;
        }

        if (!isBackground && oldestMsgTs < thresholdTs) {
          hasMore = false;
        }
      }
    }

    if (!isBackground && chatsList.length > INITIAL_BATCH_SIZE) {
      supabase.functions.invoke('whatsapp-sync', {
        body: { background: true, chatOffset: INITIAL_BATCH_SIZE }
      }).catch((e) => console.error('Error invoking background sync:', e));
    } else if (isBackground && chatOffset + BATCH_SIZE < chatsList.length) {
      supabase.functions.invoke('whatsapp-sync', {
        body: { background: true, chatOffset: chatOffset + BATCH_SIZE }
      }).catch((e) => console.error('Error invoking next background sync:', e));
    }

    return new Response(
      JSON.stringify({ success: true, syncedConversations, syncedMessages, isBackground, chatOffset }),
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

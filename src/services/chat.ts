import { supabase } from '@/lib/supabase/client'

export interface Conversation {
  id: string
  contact_id: string
  contact_name?: string | null
  last_message_at: string
  is_agent_paused: boolean
}

export interface Message {
  id: string
  direction: 'in' | 'out'
  message_text: string
  created_at: string
  conversation_id: string
}

export const getConversations = async () => {
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .order('last_message_at', { ascending: false })
    .limit(50)
  return { data, error }
}

export const getMessages = async (conversationId: string) => {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  return { data, error }
}

export const toggleAgentPause = async (id: string, isPaused: boolean) => {
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .update({ is_agent_paused: isPaused })
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export const sendManualMessage = async (
  conversationId: string,
  text: string,
) => {
  const { data, error } = await supabase.functions.invoke(
    'send-whatsapp-message',
    {
      body: { conversationId, text },
    },
  )
  return { data, error }
}

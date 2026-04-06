import { supabase } from '@/lib/supabase/client'

export interface CrmConversation {
  id: string
  contact_id: string
  contact_name: string | null
  crm_status: 'em_atendimento' | 'em_espera' | 'resolvido' | 'perdido'
  status_updated_at: string
  last_message_at: string
}

export const getCrmConversations = async () => {
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .order('status_updated_at', { ascending: false })
  return { data: data as any as CrmConversation[], error }
}

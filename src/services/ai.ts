import { supabase } from '@/lib/supabase/client'

export interface AiAgent {
  id: string
  name: string
  description: string
  system_prompt: string
  provider: 'openai' | 'gemini'
  model: string
  temperature: number
  is_active: boolean
  created_at: string
  tone_of_voice?: string
  behavior_mode?: 'template' | 'advanced'
  knowledge_base_url?: string
  knowledge_base_status?:
    | 'pending'
    | 'processing'
    | 'ready'
    | 'error'
    | 'completed'
  embedding_model?: string
}

export const saveProviderKey = async (provider: string, apiKey: string) => {
  const { data, error } = await supabase.functions.invoke('provider-save-key', {
    body: { provider, apiKey },
  })
  return { data, error }
}

export const createAgent = async (
  agent: Omit<AiAgent, 'id' | 'is_active' | 'created_at'>,
) => {
  const { data, error } = await supabase.functions.invoke('agents-create', {
    body: agent,
  })
  return { data, error }
}

export const upsertAgent = async (agent: Partial<AiAgent>) => {
  const { data, error } = await supabase.functions.invoke('agents-upsert', {
    body: agent,
  })
  return { data, error }
}

export const setAgentActive = async (agentId: string, isActive: boolean) => {
  const { data, error } = await supabase.functions.invoke('agents-set-active', {
    body: { agentId, isActive },
  })
  return { data, error }
}

export const getAgents = async () => {
  const { data, error } = await supabase
    .from('ai_agents')
    .select('*')
    .order('created_at', { ascending: false })
  return { data, error }
}

export const deleteAgent = async (id: string) => {
  const { error } = await supabase.from('ai_agents').delete().eq('id', id)
  return { error }
}

export const uploadAgentFile = async (file: File) => {
  const fileName = `${Date.now()}-${file.name}`
  const { data, error } = await supabase.storage
    .from('agent-knowledge')
    .upload(fileName, file)

  if (error) {
    return { error }
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('agent-knowledge').getPublicUrl(fileName)

  return { publicUrl }
}

export const processAgentKnowledgeBase = async (agentId: string) => {
  const { data, error } = await supabase.functions.invoke(
    'process-knowledge-base',
    {
      body: { agentId },
    },
  )
  return { data, error }
}

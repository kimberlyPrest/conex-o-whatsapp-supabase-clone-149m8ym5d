import { supabase } from '@/lib/supabase/client'

export interface ConnectResponse {
  instanceName: string
  qr: string | null
  status: string
  webhookConfigured?: boolean
}

export interface StatusResponse {
  status: string
}

export const connectWhatsapp = async (): Promise<{
  data: ConnectResponse | null
  error: any
}> => {
  const { data, error } = await supabase.functions.invoke('connect-whatsapp', {
    method: 'POST',
  })
  return { data, error }
}

export const checkWhatsappStatus = async (): Promise<{
  data: StatusResponse | null
  error: any
}> => {
  const { data, error } = await supabase.functions.invoke('whatsapp-status', {
    method: 'POST',
  })
  return { data, error }
}

export const getStoredInstance = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'User not found' }

  const { data, error } = await supabase
    .from('evolution_instances')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  return { data, error }
}

export const disconnectWhatsapp = async (): Promise<{
  data: any
  error: any
}> => {
  const { data, error } = await supabase.functions.invoke(
    'disconnect-whatsapp',
    {
      method: 'POST',
    },
  )
  return { data, error }
}

export const syncWhatsappMessages = async (): Promise<{
  data: any
  error: any
}> => {
  const { data, error } = await supabase.functions.invoke('whatsapp-sync', {
    method: 'POST',
    body: { background: false },
  })
  return { data, error }
}

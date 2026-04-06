import { supabase } from '@/lib/supabase/client'
import { subDays, format } from 'date-fns'

export interface DashboardMetrics {
  stats: {
    totalAgents: number
    activeAgents: number
    totalMessages: number
    activeConversations: number
  }
  charts: {
    messageVolume: { date: string; count: number }[]
  }
  recentActivity: {
    id: string
    message_text: string | null
    direction: string
    created_at: string
    contact_id?: string
  }[]
}

export const getDashboardMetrics = async (): Promise<{
  data: DashboardMetrics | null
  error: any
}> => {
  try {
    const today = new Date()
    const sevenDaysAgo = subDays(today, 7)

    // 1. Fetch Agents Stats
    const { data: agents, error: agentsError } = await supabase
      .from('ai_agents')
      .select('is_active')

    if (agentsError) throw agentsError

    // 2. Fetch Total Messages Count
    const { count: totalMessages, error: msgCountError } = await supabase
      .from('whatsapp_messages')
      .select('*', { count: 'exact', head: true })

    if (msgCountError) throw msgCountError

    // 3. Fetch Total Conversations Count
    const { count: activeConversations, error: convCountError } = await supabase
      .from('whatsapp_conversations')
      .select('*', { count: 'exact', head: true })

    if (convCountError) throw convCountError

    // 4. Fetch Messages for Volume Chart (Last 7 Days)
    const { data: recentMessagesVol, error: volError } = await supabase
      .from('whatsapp_messages')
      .select('created_at')
      .gte('created_at', sevenDaysAgo.toISOString())

    if (volError) throw volError

    // Process Volume Chart Data
    const volumeMap = new Map<string, number>()
    // Initialize last 7 days with 0
    for (let i = 6; i >= 0; i--) {
      const d = subDays(today, i)
      volumeMap.set(format(d, 'dd/MM'), 0)
    }

    recentMessagesVol?.forEach((msg) => {
      const d = format(new Date(msg.created_at), 'dd/MM')
      if (volumeMap.has(d)) {
        volumeMap.set(d, (volumeMap.get(d) || 0) + 1)
      }
    })

    const messageVolume = Array.from(volumeMap.entries()).map(
      ([date, count]) => ({
        date,
        count,
      }),
    )

    // 5. Recent Activity
    // Note: We use a join here assuming the relation exists.
    const { data: recentActivityRaw, error: recentError } = await supabase
      .from('whatsapp_messages')
      .select(
        `
        id,
        message_text,
        direction,
        created_at,
        whatsapp_conversations (
            contact_id
        )
      `,
      )
      .order('created_at', { ascending: false })
      .limit(5)

    if (recentError) throw recentError

    const recentActivity = recentActivityRaw.map((msg: any) => ({
      id: msg.id,
      message_text: msg.message_text,
      direction: msg.direction,
      created_at: msg.created_at,
      contact_id: msg.whatsapp_conversations?.contact_id,
    }))

    return {
      data: {
        stats: {
          totalAgents: agents?.length || 0,
          activeAgents: agents?.filter((a) => a.is_active).length || 0,
          totalMessages: totalMessages || 0,
          activeConversations: activeConversations || 0,
        },
        charts: {
          messageVolume,
        },
        recentActivity: recentActivity || [],
      },
      error: null,
    }
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error)
    return { data: null, error }
  }
}

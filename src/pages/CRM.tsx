import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Card } from '@/components/ui/card'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Clock, Loader2 } from 'lucide-react'
import { getCrmConversations, CrmConversation } from '@/services/crm'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'

const COLUMNS = [
  { id: 'em_atendimento', label: 'Em Atendimento', indicator: 'bg-blue-500' },
  { id: 'em_espera', label: 'Em Espera', indicator: 'bg-amber-500' },
  { id: 'resolvido', label: 'Resolvido', indicator: 'bg-green-500' },
  { id: 'perdido', label: 'Perdido', indicator: 'bg-red-500' },
] as const

export default function CRM() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<CrmConversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadConversations()

    const channel = supabase
      .channel(`crm_updates_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_conversations',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setConversations((prev) => {
            const newConv = payload.new as unknown as CrmConversation
            if (payload.eventType === 'INSERT') return [newConv, ...prev]
            if (payload.eventType === 'UPDATE')
              return prev.map((c) => (c.id === newConv.id ? newConv : c))
            if (payload.eventType === 'DELETE')
              return prev.filter((c) => c.id !== payload.old.id)
            return prev
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const loadConversations = async () => {
    setLoading(true)
    const { data } = await getCrmConversations()
    if (data) setConversations(data)
    setLoading(false)
  }

  return (
    <div className="h-[calc(100vh-6rem)] md:h-[calc(100vh-6rem)] animate-fade-in flex flex-col pt-2 max-w-[1400px] mx-auto w-full px-2 sm:px-0">
      <div className="flex items-center justify-between mb-4 sm:mb-6 px-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            CRM Kanban
          </h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
            Gerencie o status das suas conversas e automações.
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1 w-full whitespace-nowrap rounded-lg">
        <div className="flex w-max space-x-4 sm:space-x-5 h-full p-1 pb-4">
          {COLUMNS.map((col) => (
            <div
              key={col.id}
              className="w-[280px] sm:w-[320px] flex flex-col rounded-2xl border bg-muted/30 p-2 sm:p-3 shadow-sm h-[calc(100vh-14rem)] md:h-[calc(100vh-12rem)]"
            >
              <div className="flex items-center justify-between mb-3 sm:mb-4 px-1 shrink-0">
                <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                  <div
                    className={cn(
                      'w-2.5 h-2.5 rounded-full shadow-sm shrink-0',
                      col.indicator,
                    )}
                  />
                  {col.label}
                </div>
                <div className="bg-background text-muted-foreground px-2 py-0.5 rounded-full text-xs font-semibold shadow-sm border border-border/50 shrink-0">
                  {conversations.filter((c) => c.crm_status === col.id).length}
                </div>
              </div>

              <ScrollArea className="flex-1">
                {loading ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-3 pb-2 pr-3 pl-1">
                    {conversations
                      .filter((c) => c.crm_status === col.id)
                      .map((conv) => (
                        <Card
                          key={conv.id}
                          className="p-3 bg-background hover:shadow-md transition-all duration-200 rounded-xl border border-border/50 relative overflow-hidden group cursor-pointer active:scale-[0.98]"
                        >
                          <div
                            className={cn(
                              'absolute left-0 top-0 bottom-0 w-1 opacity-70 group-hover:opacity-100 transition-opacity',
                              col.indicator,
                            )}
                          />
                          <div className="pl-3 whitespace-normal">
                            <div className="font-semibold text-sm text-foreground line-clamp-1">
                              {conv.contact_name || conv.contact_id}
                            </div>
                            <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {conv.contact_id}
                            </div>
                            <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground font-medium">
                              <span className="flex items-center gap-1.5">
                                <Clock className="w-3 h-3 shrink-0" />
                                <span className="truncate">
                                  {formatDistanceToNow(
                                    new Date(conv.status_updated_at),
                                    { addSuffix: true, locale: ptBR },
                                  )}
                                </span>
                              </span>
                            </div>
                          </div>
                        </Card>
                      ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="h-2.5" />
      </ScrollArea>
    </div>
  )
}

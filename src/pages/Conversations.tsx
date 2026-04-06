import { useState, useEffect, useRef } from 'react'
import {
  getConversations,
  getMessages,
  toggleAgentPause,
  sendManualMessage,
  Conversation,
  Message,
} from '@/services/chat'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Send,
  User,
  Bot,
  MessageSquare,
  ArrowLeft,
  Loader2,
  Clock,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'

export default function Conversations() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [loadingConv, setLoadingConv] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [sending, setSending] = useState(false)

  const activeIdRef = useRef(activeId)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  useEffect(() => {
    if (!user) return

    loadConversations()

    const channel = supabase
      .channel(`chat_updates_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message

          setMessages((prev) => {
            const isOptimistic = prev.some(
              (m) =>
                m.id === newMsg.id ||
                (m.direction === newMsg.direction &&
                  m.message_text === newMsg.message_text &&
                  Math.abs(
                    new Date(m.created_at).getTime() -
                      new Date(newMsg.created_at).getTime(),
                  ) < 5000),
            )

            if (isOptimistic) {
              return prev.map((m) => {
                if (
                  m.id === newMsg.id ||
                  (m.direction === newMsg.direction &&
                    m.message_text === newMsg.message_text &&
                    Math.abs(
                      new Date(m.created_at).getTime() -
                        new Date(newMsg.created_at).getTime(),
                    ) < 5000)
                ) {
                  return newMsg
                }
                return m
              })
            }

            if (activeIdRef.current === newMsg.conversation_id) {
              setTimeout(scrollToBottom, 100)
              return [...prev, newMsg]
            }

            return prev
          })

          setConversations((prev) => {
            const exists = prev.find((c) => c.id === newMsg.conversation_id)
            if (exists) {
              return prev
                .map((c) =>
                  c.id === newMsg.conversation_id
                    ? { ...c, last_message_at: newMsg.created_at }
                    : c,
                )
                .sort(
                  (a, b) =>
                    new Date(b.last_message_at).getTime() -
                    new Date(a.last_message_at).getTime(),
                )
            } else {
              loadConversations()
            }
            return prev
          })
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_conversations',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updatedConv = payload.new as Conversation
          setConversations((prev) => {
            const exists = prev.find((c) => c.id === updatedConv.id)
            if (exists) {
              return prev
                .map((c) => (c.id === updatedConv.id ? updatedConv : c))
                .sort(
                  (a, b) =>
                    new Date(b.last_message_at).getTime() -
                    new Date(a.last_message_at).getTime(),
                )
            }
            return [updatedConv, ...prev].sort(
              (a, b) =>
                new Date(b.last_message_at).getTime() -
                new Date(a.last_message_at).getTime(),
            )
          })
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_conversations',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newConv = payload.new as Conversation
          setConversations((prev) => {
            if (prev.find((c) => c.id === newConv.id)) return prev
            return [newConv, ...prev].sort(
              (a, b) =>
                new Date(b.last_message_at).getTime() -
                new Date(a.last_message_at).getTime(),
            )
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  useEffect(() => {
    if (activeId) {
      loadMessages(activeId)
    }
  }, [activeId])

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior: 'smooth' })
      }
    }, 100)
  }

  const loadConversations = async () => {
    const { data } = await getConversations()
    if (data) setConversations(data)
    setLoadingConv(false)
  }

  const loadMessages = async (id: string) => {
    setLoadingMsgs(true)
    const { data } = await getMessages(id)
    if (data) {
      setMessages(data)
      scrollToBottom()
    }
    setLoadingMsgs(false)
  }

  const handleTogglePause = async (conv: Conversation) => {
    const newStatus = !conv.is_agent_paused
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conv.id ? { ...c, is_agent_paused: newStatus } : c,
      ),
    )
    const { error } = await toggleAgentPause(conv.id, newStatus)
    if (error) {
      toast.error('Erro ao alterar status do robô')
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conv.id ? { ...c, is_agent_paused: !newStatus } : c,
        ),
      )
    } else {
      toast.success(newStatus ? 'Robô pausado' : 'Robô reativado')
    }
  }

  const handleSend = async () => {
    if (!inputText.trim() || !activeId) return
    const textToSend = inputText.trim()
    setInputText('')

    const tempId = crypto.randomUUID()
    const now = new Date().toISOString()
    const optimisticMsg: Message = {
      id: tempId,
      direction: 'out',
      message_text: textToSend,
      created_at: now,
      conversation_id: activeId,
    }

    setMessages((prev) => [...prev, optimisticMsg])
    scrollToBottom()

    setConversations((prev) =>
      prev
        .map((c) => (c.id === activeId ? { ...c, last_message_at: now } : c))
        .sort(
          (a, b) =>
            new Date(b.last_message_at).getTime() -
            new Date(a.last_message_at).getTime(),
        ),
    )

    setSending(true)
    const { data, error } = await sendManualMessage(activeId, textToSend)

    if (error) {
      toast.error('Erro ao enviar mensagem')
      setInputText(textToSend)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
    } else if (data) {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? data : m)))
    }
    setSending(false)
  }

  const activeConversation = conversations.find((c) => c.id === activeId)

  return (
    <div className="h-[calc(100vh-5rem)] md:h-[calc(100vh-6rem)] animate-fade-in flex flex-col pt-2 px-2 sm:px-0">
      <div className="mb-3 sm:mb-4 px-1 sm:px-0">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Conversas
        </h1>
        <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
          Monitore e assuma o controle das conversas do WhatsApp.
        </p>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col md:flex-row border-none shadow-sm rounded-2xl sm:rounded-[2rem] bg-white">
        {/* Left Sidebar - Conversation List */}
        <div
          className={cn(
            'w-full md:w-80 lg:w-96 flex-col border-r border-border/50 bg-gray-50/30 h-full',
            activeId ? 'hidden md:flex' : 'flex',
          )}
        >
          <div className="p-4 border-b border-border/50">
            <h2 className="font-semibold flex items-center gap-2 text-foreground">
              <MessageSquare className="w-4 h-4" />
              Recentes
            </h2>
          </div>
          <ScrollArea className="flex-1">
            {loadingConv ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Nenhuma conversa encontrada.
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setActiveId(conv.id)}
                    className={cn(
                      'w-full text-left p-3 rounded-xl sm:rounded-2xl transition-all duration-200 flex items-start gap-3 hover:bg-secondary/80 active:scale-[0.98]',
                      activeId === conv.id
                        ? 'bg-secondary ring-1 ring-border shadow-sm'
                        : 'bg-transparent',
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-[13px] sm:text-sm truncate text-foreground">
                          {conv.contact_name || conv.contact_id}
                        </span>
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground whitespace-nowrap ml-2 mt-0.5 flex items-center gap-1 shrink-0">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(conv.last_message_at), {
                            locale: ptBR,
                            addSuffix: false,
                          })}
                        </span>
                      </div>
                      {conv.contact_name && (
                        <div className="mb-1.5 text-[11px] sm:text-xs text-muted-foreground truncate">
                          {conv.contact_id}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            conv.is_agent_paused ? 'secondary' : 'default'
                          }
                          className={cn(
                            'text-[9px] sm:text-[10px] px-1.5 py-0',
                            !conv.is_agent_paused
                              ? 'bg-theme-lime text-lime-900 hover:bg-theme-lime/90'
                              : 'bg-gray-200 text-gray-700',
                          )}
                        >
                          {conv.is_agent_paused ? 'Pausado' : 'Robô Ativo'}
                        </Badge>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right Content - Chat Area */}
        <div
          className={cn(
            'flex-1 flex-col bg-[#F0F2F5]/50 relative h-full',
            !activeId ? 'hidden md:flex' : 'flex',
          )}
        >
          {activeId && activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="h-14 sm:h-16 border-b border-border/50 bg-white/80 backdrop-blur px-2 sm:px-4 flex items-center justify-between z-10 sticky top-0 shrink-0">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden h-9 w-9 sm:h-10 sm:w-10 rounded-full shrink-0"
                    onClick={() => setActiveId(null)}
                  >
                    <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  <div className="min-w-0 pr-2">
                    <h3 className="font-bold text-sm sm:text-base text-foreground leading-none truncate">
                      {activeConversation.contact_name ||
                        activeConversation.contact_id}
                    </h3>
                    {activeConversation.contact_name && (
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">
                        {activeConversation.contact_id}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 bg-secondary/50 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shrink-0">
                  <Label
                    htmlFor="pause-agent"
                    className="text-[10px] sm:text-sm font-medium cursor-pointer flex items-center gap-1.5 sm:gap-2 whitespace-nowrap"
                  >
                    <Bot className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground hidden sm:block" />
                    Pausar Robô
                  </Label>
                  <Switch
                    id="pause-agent"
                    checked={activeConversation.is_agent_paused}
                    onCheckedChange={() =>
                      handleTogglePause(activeConversation)
                    }
                    className="scale-[0.8] sm:scale-100"
                  />
                </div>
              </div>

              {/* Chat Messages */}
              <ScrollArea className="flex-1 p-3 sm:p-4">
                {loadingMsgs ? (
                  <div className="flex justify-center items-center h-full">
                    <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4 pb-4">
                    {messages.map((msg) => {
                      const isIn = msg.direction === 'in'
                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            'flex w-full',
                            isIn ? 'justify-start' : 'justify-end',
                          )}
                        >
                          <div
                            className={cn(
                              'max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 sm:px-4 py-2 shadow-sm relative',
                              isIn
                                ? 'bg-white rounded-tl-none border border-border/50 text-foreground'
                                : 'bg-[#E7FFDB] rounded-tr-none text-[#111B21]',
                            )}
                          >
                            <p className="text-xs sm:text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                              {msg.message_text}
                            </p>
                            <div
                              className={cn(
                                'text-[9px] sm:text-[10px] mt-1 text-right',
                                isIn
                                  ? 'text-muted-foreground'
                                  : 'text-[#667781]',
                              )}
                            >
                              {new Date(msg.created_at).toLocaleTimeString(
                                'pt-BR',
                                {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                },
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={scrollRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Chat Input */}
              <div className="p-3 sm:p-4 bg-[#F0F2F5] border-t border-border/50 flex items-center gap-2 shrink-0">
                <Input
                  placeholder={
                    activeConversation.is_agent_paused
                      ? 'Mensagem...'
                      : 'Pause o robô para enviar'
                  }
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  className="flex-1 bg-white h-10 sm:h-12 text-sm"
                  disabled={!activeConversation.is_agent_paused || sending}
                />
                <Button
                  size="icon"
                  className="h-10 w-10 sm:h-12 sm:w-12 rounded-full shrink-0"
                  onClick={handleSend}
                  disabled={
                    !inputText.trim() ||
                    !activeConversation.is_agent_paused ||
                    sending
                  }
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 sm:w-5 sm:h-5 ml-1" />
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-4 text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-secondary rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 sm:w-10 sm:h-10 text-primary/40" />
              </div>
              <p className="text-base sm:text-lg font-medium">
                Selecione uma conversa
              </p>
              <p className="text-xs sm:text-sm mt-1 max-w-[250px]">
                Escolha um contato na lista lateral para visualizar as
                mensagens.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

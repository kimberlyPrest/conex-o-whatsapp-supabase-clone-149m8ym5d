import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { getDashboardMetrics, DashboardMetrics } from '@/services/dashboard'
import {
  Bot,
  MessageSquare,
  Users,
  Activity,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
  MoreHorizontal,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from '@/components/ui/chart'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function Dashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const { data } = await getDashboardMetrics()
      if (data) {
        setMetrics(data)
      }
      setLoading(false)
    }
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="animate-spin text-primary w-10 h-10" />
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Erro ao carregar dados do dashboard.
      </div>
    )
  }

  const chartConfig = {
    messages: {
      label: 'Mensagens',
      color: 'hsl(var(--theme-lavender))',
    },
  } satisfies ChartConfig

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
            Visão geral do desempenho e atividades.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total de Agentes"
          value={metrics.stats.totalAgents}
          icon={Bot}
        />
        <KpiCard
          title="Agentes Ativos"
          value={metrics.stats.activeAgents}
          icon={Activity}
          highlight
        />
        <KpiCard
          title="Total de Mensagens"
          value={metrics.stats.totalMessages}
          icon={MessageSquare}
        />
        <KpiCard
          title="Conversas Ativas"
          value={metrics.stats.activeConversations}
          icon={Users}
        />
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1">
        {/* Message Volume Chart */}
        <Card className="border-none shadow-sm bg-white rounded-2xl sm:rounded-[2rem]">
          <CardHeader className="p-4 sm:p-8 pb-4">
            <CardTitle className="text-base sm:text-lg font-semibold text-foreground">
              Volume de Mensagens
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Atividade nos últimos 7 dias
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0 pr-4 sm:pr-8 pb-4 sm:pb-8">
            <ChartContainer
              config={chartConfig}
              className="h-[250px] sm:h-[300px] w-full"
            >
              <AreaChart
                data={metrics.charts.messageVolume}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="fillMessages" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-messages)"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-messages)"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  stroke="#f0f0f0"
                />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  width={35}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dot" />}
                />
                <Area
                  dataKey="count"
                  type="natural"
                  fill="url(#fillMessages)"
                  fillOpacity={0.4}
                  stroke="var(--color-messages)"
                  strokeWidth={3}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity List */}
      <Card className="border-none shadow-sm bg-white rounded-2xl sm:rounded-[2rem]">
        <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-8 pb-2 sm:pb-4">
          <div>
            <CardTitle className="text-base sm:text-lg font-semibold text-foreground">
              Atividade Recente
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Últimas 5 mensagens processadas
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-8 w-8 sm:h-10 sm:w-10"
          >
            <MoreHorizontal className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
          </Button>
        </CardHeader>
        <CardContent className="p-2 sm:p-8 sm:pt-0">
          <div className="space-y-1">
            {metrics.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhuma atividade recente encontrada.
              </p>
            ) : (
              metrics.recentActivity.map((msg) => (
                <div
                  key={msg.id}
                  className="flex items-center justify-between p-3 sm:p-4 hover:bg-muted/30 rounded-xl sm:rounded-2xl transition-colors group"
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div
                      className={cn(
                        'w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0',
                        msg.direction === 'in'
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-green-50 text-green-600',
                      )}
                    >
                      {msg.direction === 'in' ? (
                        <ArrowDownLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-foreground truncate">
                        {msg.contact_id
                          ? msg.contact_id.split('@')[0]
                          : 'Desconhecido'}
                      </p>
                      <p className="text-[11px] sm:text-xs text-muted-foreground truncate max-w-[150px] sm:max-w-md">
                        {msg.message_text || 'Mensagem de mídia/sistema'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 pl-2 sm:pl-4 shrink-0">
                    <Badge
                      variant="secondary"
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] uppercase tracking-wider font-bold',
                        msg.direction === 'in'
                          ? 'bg-blue-100 text-blue-700 hover:bg-blue-100'
                          : 'bg-green-100 text-green-700 hover:bg-green-100',
                      )}
                    >
                      {msg.direction === 'in' ? 'Recebida' : 'Enviada'}
                    </Badge>
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground text-right whitespace-nowrap">
                      {formatDistanceToNow(new Date(msg.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function KpiCard({
  title,
  value,
  icon: Icon,
  highlight = false,
}: {
  title: string
  value: number
  icon: any
  highlight?: boolean
}) {
  return (
    <Card className="border-none shadow-sm bg-white rounded-2xl sm:rounded-[2rem] hover:shadow-md transition-shadow">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground line-clamp-1">
            {title}
          </p>
          <Icon className="h-4 w-4 text-muted-foreground/50 shrink-0" />
        </div>
        <div className="flex items-center gap-2 mt-1 sm:mt-2">
          <div className="text-2xl sm:text-3xl font-bold text-foreground">
            {value}
          </div>
          {highlight && (
            <span className="flex h-2 w-2 rounded-full bg-theme-lime ring-4 ring-theme-lime/20 animate-pulse" />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

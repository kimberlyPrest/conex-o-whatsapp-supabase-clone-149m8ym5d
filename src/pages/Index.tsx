import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import {
  Loader2,
  Smartphone,
  CheckCircle2,
  ArrowRight,
  Wifi,
  RefreshCw,
  LogOut,
} from 'lucide-react'
import {
  connectWhatsapp,
  checkWhatsappStatus,
  getStoredInstance,
  disconnectWhatsapp,
} from '@/services/whatsapp'

const POLLING_INTERVAL = 8000

export default function Index() {
  const { user } = useAuth()

  const [loading, setLoading] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [status, setStatus] = useState<
    'init' | 'qrcode' | 'connecting' | 'connected' | 'disconnected'
  >('init')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [instanceName, setInstanceName] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadInitialState()
    }
  }, [user])

  useEffect(() => {
    let intervalId: NodeJS.Timeout

    if (status === 'qrcode' || status === 'connecting') {
      intervalId = setInterval(async () => {
        const { data, error } = await checkWhatsappStatus()
        if (error) {
          console.error('Polling error:', error)
          return
        }

        if (data?.status === 'connected') {
          setStatus('connected')
          setQrCode(null)
          toast.success('WhatsApp conectado com sucesso!')
        }
      }, POLLING_INTERVAL)
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [status])

  const loadInitialState = async () => {
    setLoading(true)
    const { data } = await getStoredInstance()

    if (data) {
      setInstanceName(data.instance_name)
      if (data.status === 'connected') {
        const { data: apiData } = await checkWhatsappStatus()
        if (apiData?.status === 'connected') {
          setStatus('connected')
        } else {
          setStatus('init')
        }
      } else if (data.status === 'qrcode') {
        setStatus('init')
      }
    }
    setLoading(false)
  }

  const handleConnect = async () => {
    setLoading(true)
    setQrCode(null)
    setStatus('connecting')

    try {
      const { data, error } = await connectWhatsapp()

      if (error) throw error

      if (data) {
        setInstanceName(data.instanceName)

        if (data.status === 'connected') {
          setStatus('connected')
          toast.success('Já está conectado!')
        } else if (data.qr) {
          setQrCode(data.qr)
          setStatus('qrcode')
          toast.info('QR Code gerado. Escaneie para conectar.')
        } else {
          setStatus('connecting')
          toast.info('Instância iniciada. Aguardando QR Code...')
        }
      }
    } catch (error: any) {
      console.error('Connect error:', error)
      setStatus('init')
      toast.error('Erro ao conectar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    try {
      const { error } = await disconnectWhatsapp()
      if (error) throw error

      setStatus('init')
      setQrCode(null)
      setInstanceName(null)
      toast.success('Instância desconectada com sucesso!')
    } catch (error: any) {
      console.error('Disconnect error:', error)
      toast.error(
        'Não foi possível limpar o registro local da instância. Tente novamente.',
      )
    } finally {
      setIsDisconnecting(false)
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in max-w-xl mx-auto pt-4 sm:pt-8 px-2 sm:px-0">
      <div className="text-center space-y-2 sm:space-y-3">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          Conexão WhatsApp
        </h1>
        <p className="text-sm sm:text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
          Sincronize seu número para permitir que os agentes respondam
          automaticamente.
        </p>
      </div>

      <Card className="overflow-hidden border-none shadow-subtle bg-white relative rounded-2xl sm:rounded-[2rem]">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-primary/10" />

        <CardHeader className="text-center pb-2 pt-8 sm:pt-10 px-4 sm:px-8">
          <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-secondary flex items-center justify-center mb-4 sm:mb-6 text-primary shadow-sm animate-in zoom-in duration-500">
            {status === 'connected' ? (
              <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-green-600" />
            ) : (
              <Wifi className="w-8 h-8 sm:w-10 sm:h-10" />
            )}
          </div>
          <CardTitle className="text-xl sm:text-2xl">
            Status da Sessão
          </CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Gerenciamento da instância do Evolution API
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col items-center justify-center min-h-[250px] sm:min-h-[300px] space-y-6 sm:space-y-8 pb-8 sm:pb-10 px-4 sm:px-8">
          {/* Initial State */}
          {status === 'init' && !qrCode && (
            <div className="flex flex-col items-center space-y-5 sm:space-y-6 text-center w-full max-w-xs animate-fade-in-up">
              <div className="bg-secondary text-secondary-foreground px-5 sm:px-6 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                Desconectado
              </div>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Para começar, clique no botão abaixo e escaneie o QR Code com
                seu celular.
              </p>
              <Button
                size="lg"
                className="w-full font-bold text-sm sm:text-base shadow-sm hover:shadow-md transition-all rounded-full h-12 sm:h-14"
                onClick={handleConnect}
                disabled={loading || isDisconnecting}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                    Iniciando...
                  </>
                ) : (
                  'Gerar QR Code'
                )}
              </Button>
            </div>
          )}

          {/* QR Code State */}
          {status === 'qrcode' && qrCode && (
            <div className="flex flex-col items-center space-y-5 sm:space-y-6 w-full animate-fade-in-up">
              <div className="relative bg-white p-3 sm:p-4 rounded-[1.5rem] sm:rounded-[2rem] border border-border/50 shadow-sm group hover:border-primary/50 transition-colors">
                <img
                  src={
                    qrCode.startsWith('data:image')
                      ? qrCode
                      : `data:image/png;base64,${qrCode}`
                  }
                  alt="WhatsApp QR Code"
                  className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-xl"
                />
                <div className="absolute -bottom-2 -right-2 sm:-bottom-3 sm:-right-3 bg-primary text-white p-2.5 sm:p-3 rounded-full shadow-md animate-bounce">
                  <Smartphone className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="font-medium text-foreground text-sm sm:text-base">
                  Escaneie com seu WhatsApp
                </p>
                <p className="text-[11px] sm:text-xs text-muted-foreground px-4">
                  Menu {'>'} Aparelhos conectados {'>'} Conectar
                </p>
              </div>
              <div className="flex flex-col w-full max-w-xs gap-2 sm:gap-3">
                <Button
                  variant="outline"
                  size="default"
                  onClick={handleConnect}
                  disabled={loading || isDisconnecting}
                  className="w-full rounded-full h-11 sm:h-12 text-xs sm:text-sm"
                >
                  <RefreshCw className="w-4 h-4 mr-2" /> Gerar novo código
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="default"
                      disabled={isDisconnecting}
                      className="w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full h-11 sm:h-12 text-xs sm:text-sm"
                    >
                      <LogOut className="w-4 h-4 mr-2" /> Cancelar conexão
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="w-[90vw] sm:max-w-md rounded-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancelar conexão?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Isso irá limpar a tentativa de conexão atual e remover a
                        instância pendente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
                      <AlertDialogCancel className="w-full sm:w-auto mt-0">
                        Voltar
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDisconnect}
                        className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Cancelar Conexão
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}

          {/* Connecting State */}
          {status === 'connecting' && (
            <div className="flex flex-col items-center space-y-5 sm:space-y-6 py-6 sm:py-8">
              <div className="relative">
                <Loader2 className="h-12 w-12 sm:h-16 sm:w-16 animate-spin text-primary" />
              </div>
              <p className="text-base sm:text-lg font-medium text-foreground">
                Sincronizando...
              </p>
            </div>
          )}

          {/* Connected State */}
          {status === 'connected' && (
            <div className="flex flex-col items-center space-y-5 sm:space-y-6 animate-fade-in text-center w-full max-w-xs">
              <div className="bg-theme-lime text-lime-900 px-5 sm:px-6 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm">
                <CheckCircle2 className="w-4 h-4" />
                Conectado e Ativo
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Sua instância <strong>{instanceName || 'AutoWhats'}</strong>{' '}
                está pronta para responder mensagens.
              </p>

              <div className="flex flex-col gap-2 sm:gap-3 w-full mt-2 sm:mt-4">
                <Button
                  asChild
                  className="w-full rounded-full h-12 sm:h-14 text-sm sm:text-base font-bold shadow-sm hover:shadow-md"
                  size="lg"
                >
                  <Link to="/dashboard">
                    Ir para Dashboard{' '}
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
                  </Link>
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={isDisconnecting}
                      className="w-full rounded-full h-12 sm:h-14 text-sm sm:text-base font-bold text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20 transition-colors"
                    >
                      {isDisconnecting ? (
                        <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                      ) : (
                        <LogOut className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                      )}
                      Desconectar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="w-[90vw] sm:max-w-md rounded-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                      <AlertDialogDescription className="text-xs sm:text-sm">
                        Tem certeza de que deseja desconectar? Isso interromperá
                        todo o processamento de mensagens. Você precisará
                        escanear um novo QR Code para reconectar.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
                      <AlertDialogCancel className="w-full sm:w-auto mt-0">
                        Cancelar
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDisconnect}
                        className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Desconectar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

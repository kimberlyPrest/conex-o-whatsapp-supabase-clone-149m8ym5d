import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import logoImg from '@/assets/image-e5f50.png'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signUp, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true })
    }
  }, [user, navigate])

  const handleAuth = async (action: 'login' | 'signup') => {
    if (!email || !password) {
      toast.error('Por favor, preencha todos os campos.')
      return
    }

    setLoading(true)
    try {
      if (action === 'login') {
        const { error } = await signIn(email, password)
        if (error) throw error
        toast.success('Login realizado com sucesso!')
        navigate('/')
      } else {
        const { error } = await signUp(email, password)
        if (error) throw error
        toast.success('Conta criada! Verifique seu email para confirmar.')
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao autenticar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4 w-full overflow-x-hidden">
      <div className="w-full max-w-md space-y-6 sm:space-y-8 animate-fade-in-up">
        <div className="text-center space-y-1.5 sm:space-y-2">
          <div className="flex justify-center mb-4 sm:mb-6">
            <img
              src={logoImg}
              alt="AutoWhats"
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain rotate-3 hover:rotate-6 transition-transform duration-500 rounded-full"
            />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            AutoWhats
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            Automação Inteligente
          </p>
        </div>

        <Card className="border-none shadow-2xl bg-white/80 backdrop-blur-xl w-full">
          <CardHeader className="space-y-1 text-center pb-2 pt-6 sm:pt-8 px-4 sm:px-8">
            <CardTitle className="text-xl sm:text-2xl">Bem-vindo</CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Entre ou crie uma conta para continuar
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-8 pb-6 sm:pb-8">
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 sm:mb-8 h-12 sm:h-14 rounded-full bg-muted/50 p-1 sm:p-1.5">
                <TabsTrigger
                  value="login"
                  className="rounded-full h-full text-xs sm:text-sm font-semibold data-[state=active]:shadow-sm"
                >
                  Entrar
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="rounded-full h-full text-xs sm:text-sm font-semibold data-[state=active]:shadow-sm"
                >
                  Criar conta
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-0">
                <div className="space-y-4 sm:space-y-5">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="email-login" className="text-sm">
                      Email
                    </Label>
                    <Input
                      id="email-login"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-white/50 h-11 sm:h-14 w-full"
                    />
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="password-login" className="text-sm">
                      Senha
                    </Label>
                    <Input
                      id="password-login"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-white/50 h-11 sm:h-14 w-full"
                    />
                  </div>
                  <Button
                    className="w-full mt-4 sm:mt-6 h-11 sm:h-14 text-sm sm:text-base font-bold rounded-full shadow-lg shadow-primary/20"
                    onClick={() => handleAuth('login')}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                    ) : (
                      'Entrar na Plataforma'
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="signup" className="mt-0">
                <div className="space-y-4 sm:space-y-5">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="email-signup" className="text-sm">
                      Email
                    </Label>
                    <Input
                      id="email-signup"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-white/50 h-11 sm:h-14 w-full"
                    />
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="password-signup" className="text-sm">
                      Senha
                    </Label>
                    <Input
                      id="password-signup"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-white/50 h-11 sm:h-14 w-full"
                    />
                  </div>
                  <Button
                    className="w-full mt-4 sm:mt-6 h-11 sm:h-14 text-sm sm:text-base font-bold rounded-full"
                    onClick={() => handleAuth('signup')}
                    disabled={loading}
                    variant="secondary"
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                    ) : (
                      'Criar Nova Conta'
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="justify-center text-[10px] sm:text-xs text-muted-foreground pb-6 sm:pb-8">
            &copy; {new Date().getFullYear()} AutoWhats. Todos os direitos
            reservados.
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

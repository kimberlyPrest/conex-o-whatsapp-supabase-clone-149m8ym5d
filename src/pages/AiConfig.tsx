import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { saveProviderKey } from '@/services/ai'
import { Loader2, Lock, Key, ShieldCheck } from 'lucide-react'

export default function AiConfig() {
  const [provider, setProvider] = useState<string>('openai')
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    if (!apiKey) {
      toast.error('Por favor, insira a chave da API.')
      return
    }

    setLoading(true)
    try {
      const { error } = await saveProviderKey(provider, apiKey)
      if (error) throw error

      toast.success(`Chave para ${provider} salva com segurança!`)
      setApiKey('') // Clear for security
    } catch (error: any) {
      toast.error('Erro ao salvar chave: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in max-w-xl mx-auto pt-4 sm:pt-8 px-2 sm:px-0">
      <div className="space-y-2 sm:space-y-3 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Chaves de API
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
          Configure as credenciais dos provedores de IA para permitir que seus
          agentes funcionem.
        </p>
      </div>

      <Card className="border-none shadow-sm bg-white rounded-2xl sm:rounded-[2rem]">
        <CardHeader className="text-center pb-6 sm:pb-8 pt-8 sm:pt-10">
          <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-secondary text-primary rounded-full flex items-center justify-center mb-4 sm:mb-6">
            <Key className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          <CardTitle className="text-xl sm:text-2xl">Cofre de Chaves</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Suas chaves são criptografadas e armazenadas de forma segura.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 sm:space-y-8 pb-8 sm:pb-10 px-4 sm:px-8">
          <div className="space-y-2 sm:space-y-3">
            <Label htmlFor="provider" className="text-sm sm:text-base">
              Provedor de IA
            </Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger
                id="provider"
                className="h-11 sm:h-12 bg-secondary border-transparent hover:bg-secondary/80 transition-colors w-full"
              >
                <SelectValue placeholder="Selecione o provedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI (GPT-4 / 3.5)</SelectItem>
                <SelectItem value="gemini">Google Gemini</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:space-y-3">
            <Label htmlFor="apikey" className="text-sm sm:text-base">
              Chave de API (Secret Key)
            </Label>
            <div className="relative group">
              <Input
                id="apikey"
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="pl-10 sm:pl-12 h-11 sm:h-12 w-full bg-secondary border-transparent focus:bg-white transition-all group-focus-within:shadow-sm group-focus-within:bg-white group-focus-within:ring-2 group-focus-within:ring-primary/20"
              />
              <Lock className="w-4 h-4 sm:w-5 sm:h-5 absolute left-3.5 sm:left-4 top-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            </div>
            <div className="bg-secondary/50 text-muted-foreground px-3 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl flex items-start gap-2 sm:gap-3 text-xs sm:text-sm mt-2">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 mt-0.5 text-primary" />
              <p>A chave nunca é enviada de volta ao cliente após salva.</p>
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={loading}
            className="w-full h-11 sm:h-12 text-sm sm:text-base font-bold rounded-full transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin" />
            ) : (
              'Salvar Chave Criptografada'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

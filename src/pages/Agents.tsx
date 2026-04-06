import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  upsertAgent,
  getAgents,
  setAgentActive,
  deleteAgent,
  uploadAgentFile,
  processAgentKnowledgeBase,
  AiAgent,
} from '@/services/ai'
import {
  Loader2,
  Plus,
  Trash2,
  Edit,
  FileText,
  Upload,
  User,
  Brain,
  X,
  Sparkles,
  Bot,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

const MODELS = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
  gemini: ['gemini-1.5-pro', 'gemini-1.5-flash'],
}

const TEMPLATES = {
  atendimento: `Você é um assistente de atendimento ao cliente amigável e eficiente.
Seu objetivo é resolver as dúvidas dos clientes de forma rápida e clara.
Mantenha um tom profissional, mas empático.
Sempre pergunte se o cliente precisa de mais alguma ajuda antes de encerrar.`,
  sdr: `Você é um SDR (Sales Development Representative) focado em qualificação de leads.
Seu objetivo é entender as necessidades do lead e agendar uma reunião de demonstração.
Faça perguntas abertas para qualificar o lead (Orçamento, Autoridade, Necessidade, Prazo).
Seja persuasivo e tente contornar objeções de forma educada.`,
}

const INITIAL_FORM_STATE = {
  name: '',
  description: '',
  system_prompt: '',
  provider: 'openai' as const,
  model: 'gpt-4o',
  temperature: 0.7,
  tone_of_voice: 'Profissional',
  behavior_mode: 'advanced' as 'template' | 'advanced',
  knowledge_base_url: '',
  knowledge_base_status: 'pending' as const,
}

export default function Agents() {
  const [agents, setAgents] = useState<AiAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [uploading, setUploading] = useState(false)
  const [isFileChanged, setIsFileChanged] = useState(false)

  const [formData, setFormData] = useState<Partial<AiAgent> & { id?: string }>(
    INITIAL_FORM_STATE,
  )

  useEffect(() => {
    loadAgents()
  }, [])

  useEffect(() => {
    if (formData.provider && MODELS[formData.provider]) {
      const availableModels = MODELS[formData.provider]
      if (!formData.model || !availableModels.includes(formData.model)) {
        setFormData((prev) => ({ ...prev, model: availableModels[0] }))
      }
    }
  }, [formData.provider])

  const loadAgents = async () => {
    setLoading(true)
    const { data, error } = await getAgents()
    if (error) {
      toast.error('Erro ao carregar agentes')
    } else {
      setAgents(data || [])
    }
    setLoading(false)
  }

  const handleOpenCreate = () => {
    setFormData(INITIAL_FORM_STATE)
    setCurrentStep(1)
    setIsFileChanged(false)
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (agent: AiAgent) => {
    setFormData({
      id: agent.id,
      name: agent.name,
      description: agent.description || '',
      system_prompt: agent.system_prompt,
      provider: agent.provider,
      model: agent.model,
      temperature: agent.temperature,
      tone_of_voice: agent.tone_of_voice || 'Profissional',
      behavior_mode: agent.behavior_mode || 'advanced',
      knowledge_base_url: agent.knowledge_base_url || '',
      knowledge_base_status: agent.knowledge_base_status || 'pending',
    })
    setCurrentStep(1)
    setIsFileChanged(false)
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.system_prompt) {
      toast.error('Nome e Prompt do Sistema são obrigatórios')
      return
    }

    setSaving(true)
    try {
      const { data: savedAgent, error } = await upsertAgent(formData)
      if (error) throw error

      toast.success(
        formData.id
          ? 'Agente atualizado com sucesso!'
          : 'Agente criado com sucesso!',
      )

      if (
        (isFileChanged || !formData.id) &&
        formData.knowledge_base_url &&
        savedAgent?.id
      ) {
        toast.info('Processando base de conhecimento...')
        setFormData((prev) => ({
          ...prev,
          knowledge_base_status: 'processing',
        }))

        processAgentKnowledgeBase(savedAgent.id)
          .then(({ error }) => {
            if (error) {
              let errorMessage = error.message
              try {
                const body = JSON.parse(error.message)
                if (body.error) errorMessage = body.error
              } catch (e) {
                // Ignore
              }
              toast.error('Erro ao processar arquivo: ' + errorMessage)
            } else {
              toast.success('Base de conhecimento processada!')
              loadAgents()
            }
          })
          .catch((e) => toast.error('Erro no processamento'))
      }

      setIsDialogOpen(false)
      loadAgents()
    } catch (error: any) {
      toast.error('Erro ao salvar agente: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (agent: AiAgent) => {
    const newState = !agent.is_active
    setAgents((prev) =>
      prev.map((a) =>
        a.id === agent.id
          ? { ...a, is_active: newState }
          : newState
            ? { ...a, is_active: false }
            : a,
      ),
    )

    const { error } = await setAgentActive(agent.id, newState)
    if (error) {
      toast.error('Erro ao atualizar status')
      loadAgents()
    } else {
      toast.success(`Agente ${newState ? 'ativado' : 'desativado'}`)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este agente?')) return
    const { error } = await deleteAgent(id)
    if (error) {
      toast.error('Erro ao excluir agente')
    } else {
      toast.success('Agente excluído')
      setAgents((prev) => prev.filter((a) => a.id !== id))
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const { publicUrl, error } = await uploadAgentFile(file)
    setUploading(false)

    if (error) {
      toast.error('Erro ao fazer upload do arquivo')
    } else if (publicUrl) {
      setFormData((prev) => ({
        ...prev,
        knowledge_base_url: publicUrl,
        knowledge_base_status: 'pending',
      }))
      setIsFileChanged(true)
      toast.success('Arquivo enviado com sucesso!')
    }
  }

  const applyTemplate = (type: 'atendimento' | 'sdr') => {
    setFormData((prev) => ({
      ...prev,
      behavior_mode: 'template',
      system_prompt: TEMPLATES[type],
    }))
    toast.info('Template aplicado!')
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Agentes IA
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Gerencie e personalize seus assistentes virtuais.
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="w-full sm:w-auto rounded-full h-12 px-6 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all sm:hover:scale-105"
        >
          <Plus className="w-5 h-5 mr-2" />
          Novo Agente
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {agents.length === 0 && (
            <div className="col-span-full py-12 sm:py-16 px-4 flex flex-col items-center justify-center text-center bg-white rounded-2xl sm:rounded-[2rem] border-2 border-dashed border-muted-foreground/10">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-secondary rounded-full flex items-center justify-center mb-4 sm:mb-6">
                <Bot className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-foreground">
                Nenhum agente criado
              </h3>
              <p className="text-sm sm:text-base text-muted-foreground max-w-sm mt-2 mb-6 sm:mb-8">
                Comece criando seu primeiro assistente de inteligência
                artificial para automatizar seu WhatsApp.
              </p>
              <Button
                onClick={handleOpenCreate}
                size="lg"
                className="rounded-full w-full sm:w-auto"
              >
                Criar Primeiro Agente
              </Button>
            </div>
          )}

          {agents.map((agent) => (
            <Card
              key={agent.id}
              className={cn(
                'group relative border-none shadow-sm hover:shadow-md sm:hover:shadow-lg transition-all duration-300 bg-white rounded-2xl sm:rounded-[2rem]',
                agent.is_active
                  ? 'ring-2 ring-theme-lime ring-offset-2 ring-offset-background'
                  : '',
              )}
            >
              <CardHeader className="p-5 sm:p-6 sm:pt-8 pb-3 sm:pb-4">
                <div className="flex justify-between items-start mb-2 gap-2">
                  <div className="space-y-1.5 min-w-0">
                    <h3 className="text-lg sm:text-xl font-bold text-foreground leading-tight truncate">
                      {agent.name}
                    </h3>
                    <div className="flex flex-wrap gap-2 items-center">
                      <Badge
                        variant="secondary"
                        className="rounded-full bg-theme-lavender text-purple-900 font-semibold hover:bg-theme-lavender/80 text-[10px] sm:text-xs px-2"
                      >
                        {agent.provider === 'openai'
                          ? 'OpenAI'
                          : 'Google Gemini'}
                      </Badge>
                      {agent.is_active ? (
                        <Badge className="rounded-full bg-theme-lime text-lime-900 font-semibold hover:bg-theme-lime/80 border-none text-[10px] sm:text-xs px-2">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="rounded-full text-muted-foreground bg-gray-100 text-[10px] sm:text-xs px-2"
                        >
                          Inativo
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Switch
                    checked={agent.is_active}
                    onCheckedChange={() => handleToggleActive(agent)}
                    className="data-[state=checked]:bg-theme-lime shrink-0"
                  />
                </div>
              </CardHeader>

              <CardContent className="p-5 sm:p-6 pt-0 space-y-4 sm:space-y-6">
                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-3 min-h-[3rem] sm:min-h-[3.75rem]">
                  {agent.description ||
                    'Sem descrição definida. Adicione detalhes para facilitar a identificação.'}
                </p>

                <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-1 sm:pt-2">
                  <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-secondary/30 space-y-1 overflow-hidden">
                    <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3 shrink-0" />{' '}
                      <span className="truncate">Modelo</span>
                    </span>
                    <p className="text-xs sm:text-sm font-medium text-foreground truncate">
                      {agent.model}
                    </p>
                  </div>
                  <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-secondary/30 space-y-1 overflow-hidden">
                    <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Brain className="w-3 h-3 shrink-0" />{' '}
                      <span className="truncate">Base</span>
                    </span>
                    <p className="text-xs sm:text-sm font-medium text-foreground truncate">
                      {agent.knowledge_base_url ? 'Conectada' : 'Nenhuma'}
                    </p>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="border-t bg-gray-50/50 p-4 sm:p-5 rounded-b-2xl sm:rounded-b-[2rem] flex justify-between gap-3">
                <Button
                  variant="outline"
                  className="flex-1 rounded-full border-gray-200 hover:bg-white hover:text-primary h-10 sm:h-11"
                  onClick={() => handleOpenEdit(agent)}
                >
                  <Edit className="w-4 h-4 mr-2" /> Editar
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full w-10 h-10 sm:w-11 sm:h-11 shrink-0"
                  onClick={() => handleDelete(agent.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col rounded-2xl sm:rounded-[2rem] p-0 border-none shadow-2xl">
          <DialogHeader className="p-5 sm:p-8 pb-3 sm:pb-4 bg-gray-50/50">
            <DialogTitle className="text-xl sm:text-2xl font-bold">
              {formData.id ? 'Editar Agente' : 'Criar Novo Agente'}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Configure a personalidade e conhecimento do seu assistente.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 px-5 sm:px-8 py-4 sm:py-6 space-y-6 sm:space-y-8">
            {/* Stepper */}
            <div className="flex items-center justify-center space-x-2">
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    step === currentStep
                      ? 'w-10 sm:w-12 bg-primary'
                      : 'w-3 bg-muted-foreground/20',
                    step < currentStep && 'bg-primary/40',
                  )}
                />
              ))}
            </div>

            {currentStep === 1 && (
              <div className="space-y-5 sm:space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm">Nome</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Ex: Atendente Virtual"
                      className="h-11 sm:h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Descrição Curta</Label>
                    <Input
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      placeholder="Finalidade do agente"
                      className="h-11 sm:h-12"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm">Provedor de IA</Label>
                    <Select
                      value={formData.provider}
                      onValueChange={(v: any) =>
                        setFormData({ ...formData, provider: v })
                      }
                    >
                      <SelectTrigger className="h-11 sm:h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="gemini">Google Gemini</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Modelo</Label>
                    <Select
                      value={formData.model}
                      onValueChange={(v) =>
                        setFormData({ ...formData, model: v })
                      }
                    >
                      <SelectTrigger className="h-11 sm:h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MODELS[formData.provider as keyof typeof MODELS]?.map(
                          (m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3 sm:space-y-4 pt-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm">
                      Nível de Criatividade (Temperatura)
                    </Label>
                    <span className="text-xs bg-secondary px-3 py-1 rounded-full text-foreground font-mono font-bold">
                      {formData.temperature}
                    </span>
                  </div>
                  <Slider
                    value={[formData.temperature || 0.7]}
                    onValueChange={(v) =>
                      setFormData({ ...formData, temperature: v[0] })
                    }
                    max={1}
                    step={0.1}
                    className="py-2"
                  />
                  <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">
                    Valores mais altos tornam o agente mais criativo, enquanto
                    valores mais baixos o tornam mais focado e determinístico.
                  </p>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-5 sm:space-y-6 animate-fade-in">
                <div className="flex gap-2 p-1 bg-secondary rounded-full">
                  <Button
                    type="button"
                    variant={
                      formData.behavior_mode === 'template'
                        ? 'default'
                        : 'ghost'
                    }
                    onClick={() =>
                      setFormData({ ...formData, behavior_mode: 'template' })
                    }
                    className="flex-1 rounded-full shadow-none text-xs sm:text-sm h-9 sm:h-10"
                    size="sm"
                  >
                    Usar Template
                  </Button>
                  <Button
                    type="button"
                    variant={
                      formData.behavior_mode === 'advanced'
                        ? 'default'
                        : 'ghost'
                    }
                    onClick={() =>
                      setFormData({ ...formData, behavior_mode: 'advanced' })
                    }
                    className="flex-1 rounded-full shadow-none text-xs sm:text-sm h-9 sm:h-10"
                    size="sm"
                  >
                    Personalizado
                  </Button>
                </div>

                {formData.behavior_mode === 'template' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div
                      className="p-4 sm:p-5 border rounded-2xl sm:rounded-[1.5rem] cursor-pointer hover:border-primary hover:bg-primary/5 transition-all group"
                      onClick={() => applyTemplate('atendimento')}
                    >
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-110 transition-transform">
                        <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <h4 className="font-bold text-sm sm:text-base">
                        Atendimento
                      </h4>
                      <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">
                        Empático, focado em suporte.
                      </p>
                    </div>
                    <div
                      className="p-4 sm:p-5 border rounded-2xl sm:rounded-[1.5rem] cursor-pointer hover:border-primary hover:bg-primary/5 transition-all group"
                      onClick={() => applyTemplate('sdr')}
                    >
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-110 transition-transform">
                        <User className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <h4 className="font-bold text-sm sm:text-base">
                        Vendas (SDR)
                      </h4>
                      <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">
                        Persuasivo, focado em conversão.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-sm">
                    Instruções do Sistema (Prompt)
                  </Label>
                  <Textarea
                    value={formData.system_prompt}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        system_prompt: e.target.value,
                      })
                    }
                    className="h-[200px] sm:h-[300px] font-mono text-xs sm:text-sm leading-relaxed p-4 sm:p-6"
                    placeholder="Descreva detalhadamente como o agente deve se comportar, o que ele pode ou não fazer..."
                  />
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6 sm:space-y-8 animate-fade-in">
                <div className="bg-theme-lavender/30 border border-theme-lavender p-4 sm:p-6 rounded-2xl sm:rounded-[1.5rem] flex flex-col sm:flex-row gap-4 sm:gap-5 items-start sm:items-center">
                  <div className="p-3 bg-white rounded-xl sm:rounded-2xl h-fit text-purple-600 shadow-sm shrink-0">
                    <Brain className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-purple-900 text-base sm:text-lg">
                      Base de Conhecimento
                    </h4>
                    <p className="text-xs sm:text-sm text-purple-800/80 mt-1.5 sm:mt-2 leading-relaxed">
                      Faça upload de documentos (PDF, TXT) para treinar seu
                      agente. Ele usará essas informações para responder
                      perguntas específicas sobre seu negócio.
                    </p>
                  </div>
                </div>

                <div className="border-2 border-dashed border-muted-foreground/20 rounded-2xl sm:rounded-[2rem] p-6 sm:p-10 text-center hover:bg-muted/30 transition-colors relative cursor-pointer group">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  <div className="flex flex-col items-center gap-3 sm:gap-4 group-hover:-translate-y-1 transition-transform duration-300">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center shadow-inner">
                      {uploading ? (
                        <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin" />
                      ) : (
                        <Upload className="w-6 h-6 sm:w-8 sm:h-8" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-base sm:text-lg text-foreground">
                        Clique para enviar arquivo
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                        Suporta PDF, DOCX ou TXT
                      </p>
                    </div>
                  </div>
                </div>

                {formData.knowledge_base_url && (
                  <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white border rounded-xl sm:rounded-2xl shadow-sm">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-bold text-xs sm:text-sm truncate">
                        Documento Anexado
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                        {formData.knowledge_base_url.split('/').pop()}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 sm:h-10 sm:w-10 text-destructive hover:bg-destructive/10 rounded-full shrink-0"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          knowledge_base_url: '',
                          knowledge_base_status: 'pending',
                        })
                        setIsFileChanged(true)
                      }}
                    >
                      <X className="w-4 h-4 sm:w-5 sm:h-5" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="p-5 sm:p-8 pt-4 sm:pt-6 bg-gray-50/50 flex flex-col sm:flex-row items-center gap-3 sm:gap-0 sm:justify-between border-t border-gray-100">
            <Button
              variant="outline"
              onClick={() =>
                currentStep === 1
                  ? setIsDialogOpen(false)
                  : setCurrentStep((p) => p - 1)
              }
              className="rounded-full border-2 w-full sm:w-auto px-6 sm:px-8 h-11 sm:h-12"
            >
              {currentStep === 1 ? 'Cancelar' : 'Voltar'}
            </Button>

            {currentStep < 3 ? (
              <Button
                onClick={() => setCurrentStep((p) => p + 1)}
                className="rounded-full w-full sm:w-auto px-6 sm:px-8 shadow-lg shadow-primary/20 h-11 sm:h-12"
              >
                Próximo
              </Button>
            ) : (
              <Button
                onClick={handleSave}
                disabled={saving || uploading}
                className="rounded-full w-full sm:w-auto px-6 sm:px-8 shadow-lg shadow-primary/20 h-11 sm:h-12"
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Concluir Agente
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

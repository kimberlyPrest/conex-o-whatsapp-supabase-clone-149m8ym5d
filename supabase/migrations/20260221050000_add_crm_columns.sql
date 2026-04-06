ALTER TABLE public.whatsapp_conversations
ADD COLUMN crm_status TEXT DEFAULT 'em_atendimento' NOT NULL
CHECK (crm_status IN ('em_atendimento', 'em_espera', 'resolvido', 'perdido')),
ADD COLUMN status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL;

CREATE INDEX idx_whatsapp_conversations_crm_status
ON public.whatsapp_conversations(crm_status, status_updated_at);

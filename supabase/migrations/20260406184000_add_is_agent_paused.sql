ALTER TABLE public.whatsapp_conversations ADD COLUMN IF NOT EXISTS is_agent_paused BOOLEAN NOT NULL DEFAULT false;

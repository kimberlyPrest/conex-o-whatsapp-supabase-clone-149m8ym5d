ALTER TABLE public.evolution_instances ADD COLUMN IF NOT EXISTS is_webhook_enabled BOOLEAN DEFAULT false;

-- Create AI Provider Keys table
CREATE TABLE IF NOT EXISTS public.ai_provider_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('openai', 'gemini', 'claude')),
    api_key_encrypted TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT ai_provider_keys_user_provider_key UNIQUE (user_id, provider)
);

-- Create AI Agents table
CREATE TABLE IF NOT EXISTS public.ai_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    system_prompt TEXT NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('openai', 'gemini', 'claude')),
    model TEXT NOT NULL,
    temperature FLOAT NOT NULL DEFAULT 0.7,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create WhatsApp Conversations table
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    instance_name TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT whatsapp_conversations_user_contact_key UNIQUE (user_id, contact_id)
);

-- Create WhatsApp Messages table
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
    message_text TEXT,
    raw_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.ai_provider_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_provider_keys
CREATE POLICY "Users can view their own provider keys" 
    ON public.ai_provider_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own provider keys" 
    ON public.ai_provider_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own provider keys" 
    ON public.ai_provider_keys FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own provider keys" 
    ON public.ai_provider_keys FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for ai_agents
CREATE POLICY "Users can view their own agents" 
    ON public.ai_agents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own agents" 
    ON public.ai_agents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own agents" 
    ON public.ai_agents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own agents" 
    ON public.ai_agents FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for whatsapp_conversations
CREATE POLICY "Users can view their own conversations" 
    ON public.whatsapp_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own conversations" 
    ON public.whatsapp_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own conversations" 
    ON public.whatsapp_conversations FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for whatsapp_messages
CREATE POLICY "Users can view their own messages" 
    ON public.whatsapp_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own messages" 
    ON public.whatsapp_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER on_ai_provider_keys_updated
    BEFORE UPDATE ON public.ai_provider_keys
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER on_ai_agents_updated
    BEFORE UPDATE ON public.ai_agents
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER on_whatsapp_conversations_updated
    BEFORE UPDATE ON public.whatsapp_conversations
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Function to ensure only one active agent per user
CREATE OR REPLACE FUNCTION public.ensure_single_active_agent()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_active = true THEN
        UPDATE public.ai_agents
        SET is_active = false
        WHERE user_id = NEW.user_id AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_ai_agent_active_update
    BEFORE INSERT OR UPDATE ON public.ai_agents
    FOR EACH ROW
    WHEN (NEW.is_active = true)
    EXECUTE PROCEDURE public.ensure_single_active_agent();

-- Add new columns to ai_agents table
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS tone_of_voice TEXT;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS behavior_mode TEXT DEFAULT 'advanced';
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS knowledge_base_url TEXT;

-- Create storage bucket for agent knowledge base
INSERT INTO storage.buckets (id, name, public)
VALUES ('agent-knowledge', 'agent-knowledge', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for storage
-- Allow users to upload their own files
CREATE POLICY "Users can upload their own agent files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'agent-knowledge' AND auth.uid() = owner);

-- Allow users to view their own files
CREATE POLICY "Users can view their own agent files"
ON storage.objects FOR SELECT
USING (bucket_id = 'agent-knowledge' AND auth.uid() = owner);

-- Allow users to update their own files
CREATE POLICY "Users can update their own agent files"
ON storage.objects FOR UPDATE
WITH CHECK (bucket_id = 'agent-knowledge' AND auth.uid() = owner);

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own agent files"
ON storage.objects FOR DELETE
USING (bucket_id = 'agent-knowledge' AND auth.uid() = owner);

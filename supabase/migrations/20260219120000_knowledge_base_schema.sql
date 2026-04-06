-- Enable the vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the agent knowledge embeddings table
CREATE TABLE IF NOT EXISTS public.agent_knowledge_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add knowledge base status to ai_agents
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS knowledge_base_status TEXT DEFAULT 'pending';

-- Enable RLS for embeddings
ALTER TABLE public.agent_knowledge_embeddings ENABLE ROW LEVEL SECURITY;

-- Policies for agent_knowledge_embeddings
CREATE POLICY "Users can view their own agent embeddings"
  ON public.agent_knowledge_embeddings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.ai_agents
    WHERE ai_agents.id = agent_knowledge_embeddings.agent_id
    AND ai_agents.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own agent embeddings"
  ON public.agent_knowledge_embeddings FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ai_agents
    WHERE ai_agents.id = agent_knowledge_embeddings.agent_id
    AND ai_agents.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own agent embeddings"
  ON public.agent_knowledge_embeddings FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.ai_agents
    WHERE ai_agents.id = agent_knowledge_embeddings.agent_id
    AND ai_agents.user_id = auth.uid()
  ));

-- Function to match embeddings
CREATE OR REPLACE FUNCTION match_agent_knowledge (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_agent_id uuid
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ake.id,
    ake.content,
    ake.metadata,
    1 - (ake.embedding <=> query_embedding) as similarity
  FROM agent_knowledge_embeddings ake
  WHERE 1 - (ake.embedding <=> query_embedding) > match_threshold
  AND ake.agent_id = filter_agent_id
  ORDER BY ake.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

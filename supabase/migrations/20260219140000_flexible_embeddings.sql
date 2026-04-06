-- Remove dimension constraint from embedding column to support different models (OpenAI: 1536, Gemini: 768)
ALTER TABLE public.agent_knowledge_embeddings ALTER COLUMN embedding TYPE vector;

-- Add embedding_model column to track which model was used for vectorization
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS embedding_model TEXT;

-- Drop and recreate the match function to support generic vector inputs
DROP FUNCTION IF EXISTS match_agent_knowledge;

CREATE OR REPLACE FUNCTION match_agent_knowledge (
  query_embedding vector,
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

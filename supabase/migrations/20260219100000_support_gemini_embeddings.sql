-- Migration to support mixed vector dimensions (OpenAI 1536d and Gemini 768d) in the same table

-- 1. Alter the embedding column to be a generic vector type (removing fixed size constraint if present)
-- Note: Indexes on this column might need to be dropped first if they enforce dimensions
DROP INDEX IF EXISTS agent_knowledge_embeddings_embedding_idx;

ALTER TABLE public.agent_knowledge_embeddings ALTER COLUMN embedding TYPE vector;

-- 2. Update/Recreate the match_agent_knowledge function to handle generic vector type
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
    agent_knowledge_embeddings.id,
    agent_knowledge_embeddings.content,
    agent_knowledge_embeddings.metadata,
    1 - (agent_knowledge_embeddings.embedding <=> query_embedding) as similarity
  FROM agent_knowledge_embeddings
  WHERE agent_knowledge_embeddings.agent_id = filter_agent_id
  AND 1 - (agent_knowledge_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY agent_knowledge_embeddings.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

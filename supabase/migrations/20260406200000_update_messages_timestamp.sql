DO $$
DECLARE
  batch_size INT := 1000;
  affected INT;
BEGIN
  -- Atualizar created_at das mensagens baseado no raw_payload timestamp
  LOOP
    WITH to_update AS (
      SELECT id,
             to_timestamp(
               CASE 
                 WHEN COALESCE((raw_payload->>'messageTimestamp')::numeric, (raw_payload->>'timestamp')::numeric) > 20000000000 THEN
                   COALESCE((raw_payload->>'messageTimestamp')::numeric, (raw_payload->>'timestamp')::numeric) / 1000
                 ELSE
                   COALESCE((raw_payload->>'messageTimestamp')::numeric, (raw_payload->>'timestamp')::numeric)
               END
             ) AS new_created_at
      FROM public.whatsapp_messages
      WHERE raw_payload IS NOT NULL
        AND (
          (raw_payload->>'messageTimestamp' ~ '^\d+(\.\d+)?$') OR 
          (raw_payload->>'timestamp' ~ '^\d+(\.\d+)?$')
        )
      LIMIT batch_size
    )
    UPDATE public.whatsapp_messages m
    SET created_at = tu.new_created_at
    FROM to_update tu
    WHERE m.id = tu.id AND m.created_at != tu.new_created_at;
    
    GET DIAGNOSTICS affected = ROW_COUNT;
    EXIT WHEN affected = 0;
    PERFORM pg_sleep(0.1);
  END LOOP;

  -- Atualizar last_message_at nas conversas baseado na última mensagem
  LOOP
    WITH to_update AS (
      SELECT c.id, MAX(m.created_at) as max_created_at
      FROM public.whatsapp_conversations c
      JOIN public.whatsapp_messages m ON m.conversation_id = c.id
      GROUP BY c.id
      HAVING MAX(m.created_at) IS DISTINCT FROM c.last_message_at
      LIMIT batch_size
    )
    UPDATE public.whatsapp_conversations c
    SET last_message_at = tu.max_created_at
    FROM to_update tu
    WHERE c.id = tu.id;
    
    GET DIAGNOSTICS affected = ROW_COUNT;
    EXIT WHEN affected = 0;
    PERFORM pg_sleep(0.1);
  END LOOP;
END $$;

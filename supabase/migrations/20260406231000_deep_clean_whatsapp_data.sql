-- 1. Ensure external_message_id is populated where possible
UPDATE public.whatsapp_messages
SET external_message_id = COALESCE(raw_payload->'key'->>'id', raw_payload->>'id')
WHERE external_message_id IS NULL AND raw_payload IS NOT NULL;

-- 2. Delete exact duplicates based on conversation_id and external_message_id
WITH duplicates AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY conversation_id, external_message_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.whatsapp_messages
  WHERE external_message_id IS NOT NULL
)
DELETE FROM public.whatsapp_messages
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- 3. Delete exact text duplicates within the same minute for safety (catch-all for missing IDs)
WITH text_duplicates AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY conversation_id, direction, message_text, date_trunc('minute', created_at)
      ORDER BY id ASC
    ) AS rn
  FROM public.whatsapp_messages
  WHERE external_message_id IS NULL AND message_text IS NOT NULL
)
DELETE FROM public.whatsapp_messages
WHERE id IN (SELECT id FROM text_duplicates WHERE rn > 1);

-- 4. Ensure the unique index exists to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_message_per_conversation 
ON public.whatsapp_messages(conversation_id, external_message_id) 
WHERE external_message_id IS NOT NULL;

-- 5. Fix created_at timestamps using DO block for large datasets
DO $DO_BLOCK$
DECLARE
  batch_size INT := 5000;
  records_found INT;
  last_id uuid := '00000000-0000-0000-0000-000000000000'::uuid;
BEGIN
  LOOP
    CREATE TEMP TABLE IF NOT EXISTS temp_batch AS
      SELECT id, raw_payload, created_at
      FROM public.whatsapp_messages
      WHERE id > last_id
      ORDER BY id
      LIMIT batch_size;

    GET DIAGNOSTICS records_found = ROW_COUNT;
    EXIT WHEN records_found = 0;

    WITH to_update AS (
      SELECT id,
             (
               SELECT
                 CASE
                   -- Ensure valid range (e.g. 2020 to 2030 in epoch is ~1577836800 to 1893456000)
                   WHEN ts_val > 1500000000 AND ts_val < 2500000000 THEN to_timestamp(ts_val)
                   ELSE created_at
                 END
               FROM (
                 SELECT
                   CASE
                     WHEN (raw_payload->>'messageTimestamp') ~ '^\d+(\.\d+)?$' THEN
                       CASE WHEN (raw_payload->>'messageTimestamp')::numeric > 20000000000 THEN (raw_payload->>'messageTimestamp')::numeric / 1000 ELSE (raw_payload->>'messageTimestamp')::numeric END
                     WHEN (raw_payload->>'timestamp') ~ '^\d+(\.\d+)?$' THEN
                       CASE WHEN (raw_payload->>'timestamp')::numeric > 20000000000 THEN (raw_payload->>'timestamp')::numeric / 1000 ELSE (raw_payload->>'timestamp')::numeric END
                     WHEN (raw_payload->'message'->>'messageTimestamp') ~ '^\d+(\.\d+)?$' THEN
                       CASE WHEN (raw_payload->'message'->>'messageTimestamp')::numeric > 20000000000 THEN (raw_payload->'message'->>'messageTimestamp')::numeric / 1000 ELSE (raw_payload->'message'->>'messageTimestamp')::numeric END
                     WHEN jsonb_typeof(raw_payload->'messageTimestamp') = 'number' THEN
                       CASE WHEN (raw_payload->>'messageTimestamp')::numeric > 20000000000 THEN (raw_payload->>'messageTimestamp')::numeric / 1000 ELSE (raw_payload->>'messageTimestamp')::numeric END
                     WHEN jsonb_typeof(raw_payload->'timestamp') = 'number' THEN
                       CASE WHEN (raw_payload->>'timestamp')::numeric > 20000000000 THEN (raw_payload->>'timestamp')::numeric / 1000 ELSE (raw_payload->>'timestamp')::numeric END
                     WHEN jsonb_typeof(raw_payload->'message'->'messageTimestamp') = 'number' THEN
                       CASE WHEN (raw_payload->'message'->>'messageTimestamp')::numeric > 20000000000 THEN (raw_payload->'message'->>'messageTimestamp')::numeric / 1000 ELSE (raw_payload->'message'->>'messageTimestamp')::numeric END
                     ELSE EXTRACT(EPOCH FROM created_at)
                   END AS ts_val
               ) extract_val
             ) AS new_created_at
      FROM temp_batch
      WHERE raw_payload IS NOT NULL
    )
    UPDATE public.whatsapp_messages m
    SET created_at = tu.new_created_at
    FROM to_update tu
    WHERE m.id = tu.id AND m.created_at != tu.new_created_at;

    SELECT id INTO last_id FROM temp_batch ORDER BY id DESC LIMIT 1;
    DROP TABLE temp_batch;
    PERFORM pg_sleep(0.05);
  END LOOP;

  -- 6. Update conversations last_message_at
  last_id := '00000000-0000-0000-0000-000000000000'::uuid;

  LOOP
    CREATE TEMP TABLE IF NOT EXISTS temp_conv_batch AS
      SELECT id
      FROM public.whatsapp_conversations
      WHERE id > last_id
      ORDER BY id
      LIMIT batch_size;

    GET DIAGNOSTICS records_found = ROW_COUNT;
    EXIT WHEN records_found = 0;

    WITH to_update AS (
      SELECT b.id, MAX(m.created_at) as max_created_at
      FROM temp_conv_batch b
      LEFT JOIN public.whatsapp_messages m ON m.conversation_id = b.id
      GROUP BY b.id
    )
    UPDATE public.whatsapp_conversations c
    SET last_message_at = COALESCE(tu.max_created_at, c.created_at)
    FROM to_update tu
    WHERE c.id = tu.id AND c.last_message_at IS DISTINCT FROM COALESCE(tu.max_created_at, c.created_at);

    SELECT id INTO last_id FROM temp_conv_batch ORDER BY id DESC LIMIT 1;
    DROP TABLE temp_conv_batch;
    PERFORM pg_sleep(0.05);
  END LOOP;
END $DO_BLOCK$;

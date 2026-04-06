-- Migration: fix_duplicates_timestamps_and_unique_constraint
-- Description: 
--   1. Remove duplicate messages (keep oldest per external_message_id)
--   2. Fix created_at timestamps from raw_payload
--   3. Add external_message_id column + UNIQUE constraint
--   4. Update last_message_at on conversations

DO $$
DECLARE
  batch_size INT := 5000;
  total_deleted INT := 0;
  total_ts_updated INT := 0;
  batch_affected INT;
  last_id uuid := '00000000-0000-0000-0000-000000000000'::uuid;
  records_found INT;
BEGIN

  -- ============================================================
  -- STEP 1: Add external_message_id column
  -- ============================================================
  ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS external_message_id TEXT;

  -- Populate from raw_payload
  LOOP
    UPDATE public.whatsapp_messages
    SET external_message_id = COALESCE(
        raw_payload->'key'->>'id',
        raw_payload->>'id'
    )
    WHERE id IN (
      SELECT id FROM public.whatsapp_messages
      WHERE external_message_id IS NULL
        AND raw_payload IS NOT NULL
        AND (raw_payload->'key'->>'id' IS NOT NULL OR raw_payload->>'id' IS NOT NULL)
      LIMIT batch_size
    );
    GET DIAGNOSTICS batch_affected = ROW_COUNT;
    EXIT WHEN batch_affected = 0;
    PERFORM pg_sleep(0.05);
  END LOOP;

  RAISE NOTICE '[STEP 1] external_message_id column populated';

  -- ============================================================
  -- STEP 2: Remove duplicate messages (keep oldest by created_at, then id)
  -- ============================================================
  LOOP
    WITH duplicates AS (
      SELECT id,
        ROW_NUMBER() OVER (
          PARTITION BY conversation_id, external_message_id
          ORDER BY created_at ASC, id ASC
        ) AS rn
      FROM public.whatsapp_messages
      WHERE external_message_id IS NOT NULL
    ),
    to_delete AS (
      SELECT id FROM duplicates WHERE rn > 1 LIMIT batch_size
    )
    DELETE FROM public.whatsapp_messages
    WHERE id IN (SELECT id FROM to_delete);

    GET DIAGNOSTICS batch_affected = ROW_COUNT;
    total_deleted := total_deleted + batch_affected;
    EXIT WHEN batch_affected = 0;
    PERFORM pg_sleep(0.05);
  END LOOP;

  RAISE NOTICE '[STEP 2] Duplicates removed: %', total_deleted;

  -- ============================================================
  -- STEP 3: Fix created_at timestamps from raw_payload
  -- ============================================================
  last_id := '00000000-0000-0000-0000-000000000000'::uuid;

  LOOP
    CREATE TEMP TABLE IF NOT EXISTS _temp_ts_batch AS
      SELECT id, raw_payload, created_at
      FROM public.whatsapp_messages
      WHERE id > last_id AND raw_payload IS NOT NULL
      ORDER BY id
      LIMIT batch_size;

    GET DIAGNOSTICS records_found = ROW_COUNT;
    EXIT WHEN records_found = 0;

    WITH to_update AS (
      SELECT id,
        to_timestamp(
          CASE
            WHEN (raw_payload->>'messageTimestamp') ~ '^\d+(\.\d+)?$' THEN
              CASE WHEN (raw_payload->>'messageTimestamp')::numeric > 20000000000
                THEN (raw_payload->>'messageTimestamp')::numeric / 1000
                ELSE (raw_payload->>'messageTimestamp')::numeric END
            WHEN (raw_payload->>'timestamp') ~ '^\d+(\.\d+)?$' THEN
              CASE WHEN (raw_payload->>'timestamp')::numeric > 20000000000
                THEN (raw_payload->>'timestamp')::numeric / 1000
                ELSE (raw_payload->>'timestamp')::numeric END
            WHEN (raw_payload->'message'->>'messageTimestamp') ~ '^\d+(\.\d+)?$' THEN
              CASE WHEN (raw_payload->'message'->>'messageTimestamp')::numeric > 20000000000
                THEN (raw_payload->'message'->>'messageTimestamp')::numeric / 1000
                ELSE (raw_payload->'message'->>'messageTimestamp')::numeric END
            WHEN jsonb_typeof(raw_payload->'messageTimestamp') = 'number' THEN
              CASE WHEN (raw_payload->>'messageTimestamp')::numeric > 20000000000
                THEN (raw_payload->>'messageTimestamp')::numeric / 1000
                ELSE (raw_payload->>'messageTimestamp')::numeric END
            WHEN jsonb_typeof(raw_payload->'timestamp') = 'number' THEN
              CASE WHEN (raw_payload->>'timestamp')::numeric > 20000000000
                THEN (raw_payload->>'timestamp')::numeric / 1000
                ELSE (raw_payload->>'timestamp')::numeric END
            WHEN jsonb_typeof(raw_payload->'message'->'messageTimestamp') = 'number' THEN
              CASE WHEN (raw_payload->'message'->>'messageTimestamp')::numeric > 20000000000
                THEN (raw_payload->'message'->>'messageTimestamp')::numeric / 1000
                ELSE (raw_payload->'message'->>'messageTimestamp')::numeric END
            ELSE NULL
          END
        ) AS new_created_at
      FROM _temp_ts_batch
      WHERE raw_payload IS NOT NULL
    )
    UPDATE public.whatsapp_messages m
    SET created_at = tu.new_created_at
    FROM to_update tu
    WHERE m.id = tu.id
      AND tu.new_created_at IS NOT NULL
      AND m.created_at != tu.new_created_at
      AND tu.new_created_at > '2020-01-01'::timestamptz
      AND tu.new_created_at <= now();

    GET DIAGNOSTICS batch_affected = ROW_COUNT;
    total_ts_updated := total_ts_updated + batch_affected;

    SELECT id INTO last_id FROM _temp_ts_batch ORDER BY id DESC LIMIT 1;
    DROP TABLE _temp_ts_batch;
    PERFORM pg_sleep(0.05);
  END LOOP;

  RAISE NOTICE '[STEP 3] Timestamps updated: %', total_ts_updated;

  -- ============================================================
  -- STEP 4: Create UNIQUE index to prevent future duplicates
  -- ============================================================
  CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_message_per_conversation
  ON public.whatsapp_messages(conversation_id, external_message_id)
  WHERE external_message_id IS NOT NULL;

  -- Performance index for dashboard queries
  CREATE INDEX IF NOT EXISTS idx_messages_created_at
  ON public.whatsapp_messages(created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_messages_conversation_direction_created
  ON public.whatsapp_messages(conversation_id, direction, created_at DESC);

  RAISE NOTICE '[STEP 4] Unique constraint and indexes created';

  -- ============================================================
  -- STEP 5: Update last_message_at on all conversations
  -- ============================================================
  UPDATE public.whatsapp_conversations c
  SET last_message_at = sub.max_ts
  FROM (
    SELECT conversation_id, MAX(created_at) as max_ts
    FROM public.whatsapp_messages
    GROUP BY conversation_id
  ) sub
  WHERE c.id = sub.conversation_id
    AND c.last_message_at IS DISTINCT FROM sub.max_ts;

  RAISE NOTICE '[STEP 5] Conversations last_message_at updated';
  RAISE NOTICE 'DONE! Deleted: %, Timestamps fixed: %', total_deleted, total_ts_updated;
END $$;

// AVOID UPDATING THIS FILE DIRECTLY. It is automatically generated.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      ai_agents: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          model: string
          name: string
          provider: string
          system_prompt: string
          temperature: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          model: string
          name: string
          provider: string
          system_prompt: string
          temperature?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          model?: string
          name?: string
          provider?: string
          system_prompt?: string
          temperature?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_provider_keys: {
        Row: {
          api_key_encrypted: string
          created_at: string
          id: string
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key_encrypted: string
          created_at?: string
          id?: string
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key_encrypted?: string
          created_at?: string
          id?: string
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      evolution_instances: {
        Row: {
          created_at: string
          id: string
          instance_name: string
          is_webhook_enabled: boolean | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance_name: string
          is_webhook_enabled?: boolean | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instance_name?: string
          is_webhook_enabled?: boolean | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          instance_name: string
          is_agent_paused: boolean
          last_message_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          instance_name: string
          is_agent_paused?: boolean
          last_message_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          instance_name?: string
          is_agent_paused?: boolean
          last_message_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          conversation_id: string
          created_at: string
          direction: string
          id: string
          message_text: string | null
          raw_payload: Json | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          direction: string
          id?: string
          message_text?: string | null
          raw_payload?: Json | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          message_text?: string | null
          raw_payload?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'whatsapp_messages_conversation_id_fkey'
            columns: ['conversation_id']
            isOneToOne: false
            referencedRelation: 'whatsapp_conversations'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

// ====== DATABASE EXTENDED CONTEXT (auto-generated) ======
// This section contains actual PostgreSQL column types, constraints, RLS policies,
// functions, triggers, indexes and materialized views not present in the type definitions above.
// IMPORTANT: The TypeScript types above map UUID, TEXT, VARCHAR all to "string".
// Use the COLUMN TYPES section below to know the real PostgreSQL type for each column.
// Always use the correct PostgreSQL type when writing SQL migrations.

// --- COLUMN TYPES (actual PostgreSQL types) ---
// Use this to know the real database type when writing migrations.
// "string" in TypeScript types above may be uuid, text, varchar, timestamptz, etc.
// Table: ai_agents
//   id: uuid (not null, default: gen_random_uuid())
//   user_id: uuid (not null)
//   name: text (not null)
//   description: text (nullable)
//   system_prompt: text (not null)
//   provider: text (not null)
//   model: text (not null)
//   temperature: double precision (not null, default: 0.7)
//   is_active: boolean (not null, default: false)
//   created_at: timestamp with time zone (not null, default: timezone('utc'::text, now()))
//   updated_at: timestamp with time zone (not null, default: timezone('utc'::text, now()))
// Table: ai_provider_keys
//   id: uuid (not null, default: gen_random_uuid())
//   user_id: uuid (not null)
//   provider: text (not null)
//   api_key_encrypted: text (not null)
//   created_at: timestamp with time zone (not null, default: timezone('utc'::text, now()))
//   updated_at: timestamp with time zone (not null, default: timezone('utc'::text, now()))
// Table: evolution_instances
//   id: uuid (not null, default: gen_random_uuid())
//   user_id: uuid (not null)
//   instance_name: text (not null)
//   status: text (not null, default: 'init'::text)
//   created_at: timestamp with time zone (not null, default: timezone('utc'::text, now()))
//   updated_at: timestamp with time zone (not null, default: timezone('utc'::text, now()))
//   is_webhook_enabled: boolean (nullable, default: false)
// Table: whatsapp_conversations
//   id: uuid (not null, default: gen_random_uuid())
//   user_id: uuid (not null)
//   instance_name: text (not null)
//   contact_id: text (not null)
//   last_message_at: timestamp with time zone (not null, default: timezone('utc'::text, now()))
//   created_at: timestamp with time zone (not null, default: timezone('utc'::text, now()))
//   updated_at: timestamp with time zone (not null, default: timezone('utc'::text, now()))
//   is_agent_paused: boolean (not null, default: false)
// Table: whatsapp_messages
//   id: uuid (not null, default: gen_random_uuid())
//   user_id: uuid (not null)
//   conversation_id: uuid (not null)
//   direction: text (not null)
//   message_text: text (nullable)
//   raw_payload: jsonb (nullable)
//   created_at: timestamp with time zone (not null, default: timezone('utc'::text, now()))

// --- CONSTRAINTS ---
// Table: ai_agents
//   PRIMARY KEY ai_agents_pkey: PRIMARY KEY (id)
//   CHECK ai_agents_provider_check: CHECK ((provider = ANY (ARRAY['openai'::text, 'gemini'::text, 'claude'::text])))
//   FOREIGN KEY ai_agents_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
// Table: ai_provider_keys
//   PRIMARY KEY ai_provider_keys_pkey: PRIMARY KEY (id)
//   CHECK ai_provider_keys_provider_check: CHECK ((provider = ANY (ARRAY['openai'::text, 'gemini'::text, 'claude'::text])))
//   FOREIGN KEY ai_provider_keys_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
//   UNIQUE ai_provider_keys_user_provider_key: UNIQUE (user_id, provider)
// Table: evolution_instances
//   UNIQUE evolution_instances_instance_name_key: UNIQUE (instance_name)
//   PRIMARY KEY evolution_instances_pkey: PRIMARY KEY (id)
//   FOREIGN KEY evolution_instances_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
//   UNIQUE evolution_instances_user_id_key: UNIQUE (user_id)
// Table: whatsapp_conversations
//   PRIMARY KEY whatsapp_conversations_pkey: PRIMARY KEY (id)
//   UNIQUE whatsapp_conversations_user_contact_key: UNIQUE (user_id, contact_id)
//   FOREIGN KEY whatsapp_conversations_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
// Table: whatsapp_messages
//   FOREIGN KEY whatsapp_messages_conversation_id_fkey: FOREIGN KEY (conversation_id) REFERENCES whatsapp_conversations(id) ON DELETE CASCADE
//   CHECK whatsapp_messages_direction_check: CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text])))
//   PRIMARY KEY whatsapp_messages_pkey: PRIMARY KEY (id)
//   FOREIGN KEY whatsapp_messages_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE

// --- ROW LEVEL SECURITY POLICIES ---
// Table: ai_agents
//   Policy "Users can delete their own agents" (DELETE, PERMISSIVE) roles={public}
//     USING: (auth.uid() = user_id)
//   Policy "Users can insert their own agents" (INSERT, PERMISSIVE) roles={public}
//     WITH CHECK: (auth.uid() = user_id)
//   Policy "Users can update their own agents" (UPDATE, PERMISSIVE) roles={public}
//     USING: (auth.uid() = user_id)
//   Policy "Users can view their own agents" (SELECT, PERMISSIVE) roles={public}
//     USING: (auth.uid() = user_id)
// Table: ai_provider_keys
//   Policy "Users can delete their own provider keys" (DELETE, PERMISSIVE) roles={public}
//     USING: (auth.uid() = user_id)
//   Policy "Users can insert their own provider keys" (INSERT, PERMISSIVE) roles={public}
//     WITH CHECK: (auth.uid() = user_id)
//   Policy "Users can update their own provider keys" (UPDATE, PERMISSIVE) roles={public}
//     USING: (auth.uid() = user_id)
//   Policy "Users can view their own provider keys" (SELECT, PERMISSIVE) roles={public}
//     USING: (auth.uid() = user_id)
// Table: evolution_instances
//   Policy "Users can insert their own instance" (INSERT, PERMISSIVE) roles={public}
//     WITH CHECK: (auth.uid() = user_id)
//   Policy "Users can update their own instance" (UPDATE, PERMISSIVE) roles={public}
//     USING: (auth.uid() = user_id)
//   Policy "Users can view their own instance" (SELECT, PERMISSIVE) roles={public}
//     USING: (auth.uid() = user_id)
// Table: whatsapp_conversations
//   Policy "Users can insert their own conversations" (INSERT, PERMISSIVE) roles={public}
//     WITH CHECK: (auth.uid() = user_id)
//   Policy "Users can update their own conversations" (UPDATE, PERMISSIVE) roles={public}
//     USING: (auth.uid() = user_id)
//   Policy "Users can view their own conversations" (SELECT, PERMISSIVE) roles={public}
//     USING: (auth.uid() = user_id)
// Table: whatsapp_messages
//   Policy "Users can insert their own messages" (INSERT, PERMISSIVE) roles={public}
//     WITH CHECK: (auth.uid() = user_id)
//   Policy "Users can view their own messages" (SELECT, PERMISSIVE) roles={public}
//     USING: (auth.uid() = user_id)

// --- DATABASE FUNCTIONS ---
// FUNCTION ensure_single_active_agent()
//   CREATE OR REPLACE FUNCTION public.ensure_single_active_agent()
//    RETURNS trigger
//    LANGUAGE plpgsql
//   AS $function$
//   BEGIN
//       IF NEW.is_active = true THEN
//           UPDATE public.ai_agents
//           SET is_active = false
//           WHERE user_id = NEW.user_id AND id != NEW.id;
//       END IF;
//       RETURN NEW;
//   END;
//   $function$
//
// FUNCTION handle_updated_at()
//   CREATE OR REPLACE FUNCTION public.handle_updated_at()
//    RETURNS trigger
//    LANGUAGE plpgsql
//   AS $function$
//   BEGIN
//       NEW.updated_at = now();
//       RETURN NEW;
//   END;
//   $function$
//

// --- TRIGGERS ---
// Table: ai_agents
//   on_ai_agent_active_update: CREATE TRIGGER on_ai_agent_active_update BEFORE INSERT OR UPDATE ON public.ai_agents FOR EACH ROW WHEN ((new.is_active = true)) EXECUTE FUNCTION ensure_single_active_agent()
//   on_ai_agents_updated: CREATE TRIGGER on_ai_agents_updated BEFORE UPDATE ON public.ai_agents FOR EACH ROW EXECUTE FUNCTION handle_updated_at()
// Table: ai_provider_keys
//   on_ai_provider_keys_updated: CREATE TRIGGER on_ai_provider_keys_updated BEFORE UPDATE ON public.ai_provider_keys FOR EACH ROW EXECUTE FUNCTION handle_updated_at()
// Table: evolution_instances
//   on_evolution_instances_updated: CREATE TRIGGER on_evolution_instances_updated BEFORE UPDATE ON public.evolution_instances FOR EACH ROW EXECUTE FUNCTION handle_updated_at()
// Table: whatsapp_conversations
//   on_whatsapp_conversations_updated: CREATE TRIGGER on_whatsapp_conversations_updated BEFORE UPDATE ON public.whatsapp_conversations FOR EACH ROW EXECUTE FUNCTION handle_updated_at()

// --- INDEXES ---
// Table: ai_provider_keys
//   CREATE UNIQUE INDEX ai_provider_keys_user_provider_key ON public.ai_provider_keys USING btree (user_id, provider)
// Table: evolution_instances
//   CREATE UNIQUE INDEX evolution_instances_instance_name_key ON public.evolution_instances USING btree (instance_name)
//   CREATE UNIQUE INDEX evolution_instances_user_id_key ON public.evolution_instances USING btree (user_id)
// Table: whatsapp_conversations
//   CREATE UNIQUE INDEX whatsapp_conversations_user_contact_key ON public.whatsapp_conversations USING btree (user_id, contact_id)

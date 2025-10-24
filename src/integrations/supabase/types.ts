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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_maintenance_log: {
        Row: {
          acao: string
          executado_em: string | null
          executado_por: string | null
          id: string
        }
        Insert: {
          acao: string
          executado_em?: string | null
          executado_por?: string | null
          id?: string
        }
        Update: {
          acao?: string
          executado_em?: string | null
          executado_por?: string | null
          id?: string
        }
        Relationships: []
      }
      balance_reconciliation_audit: {
        Row: {
          corrections_applied: boolean
          created_at: string
          id: string
          metadata: Json | null
          performed_by: string
          rubini_coins_before: number
          rubini_coins_calculated: number
          rubini_coins_divergence: number
          tickets_before: number
          tickets_calculated: number
          tickets_divergence: number
          user_id: string
        }
        Insert: {
          corrections_applied?: boolean
          created_at?: string
          id?: string
          metadata?: Json | null
          performed_by: string
          rubini_coins_before?: number
          rubini_coins_calculated?: number
          rubini_coins_divergence?: number
          tickets_before?: number
          tickets_calculated?: number
          tickets_divergence?: number
          user_id: string
        }
        Update: {
          corrections_applied?: boolean
          created_at?: string
          id?: string
          metadata?: Json | null
          performed_by?: string
          rubini_coins_before?: number
          rubini_coins_calculated?: number
          rubini_coins_divergence?: number
          tickets_before?: number
          tickets_calculated?: number
          tickets_divergence?: number
          user_id?: string
        }
        Relationships: []
      }
      chat_bans: {
        Row: {
          ban_expira_em: string | null
          ban_permanente: boolean
          banned_by: string | null
          created_at: string | null
          id: string
          motivo: string | null
          user_id: string | null
          user_name: string
        }
        Insert: {
          ban_expira_em?: string | null
          ban_permanente?: boolean
          banned_by?: string | null
          created_at?: string | null
          id?: string
          motivo?: string | null
          user_id?: string | null
          user_name: string
        }
        Update: {
          ban_expira_em?: string | null
          ban_permanente?: boolean
          banned_by?: string | null
          created_at?: string | null
          id?: string
          motivo?: string | null
          user_id?: string | null
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_bans_banned_by_fkey"
            columns: ["banned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_bans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_config: {
        Row: {
          chat_ativo: boolean
          created_at: string | null
          id: string
          max_caracteres: number
          permitir_links: boolean
          permitir_simbolos: boolean
          updated_at: string | null
        }
        Insert: {
          chat_ativo?: boolean
          created_at?: string | null
          id?: string
          max_caracteres?: number
          permitir_links?: boolean
          permitir_simbolos?: boolean
          updated_at?: string | null
        }
        Update: {
          chat_ativo?: boolean
          created_at?: string | null
          id?: string
          max_caracteres?: number
          permitir_links?: boolean
          permitir_simbolos?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          message: string
          user_avatar: string | null
          user_id: string | null
          user_name: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          message: string
          user_avatar?: string | null
          user_id?: string | null
          user_name: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          message?: string
          user_avatar?: string | null
          user_id?: string | null
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creditos_provisorios: {
        Row: {
          aplicado: boolean | null
          aplicado_em: string | null
          created_at: string | null
          id: string
          motivo: string
          tipo_credito: string
          twitch_username: string
          valor: number
        }
        Insert: {
          aplicado?: boolean | null
          aplicado_em?: string | null
          created_at?: string | null
          id?: string
          motivo: string
          tipo_credito: string
          twitch_username: string
          valor: number
        }
        Update: {
          aplicado?: boolean | null
          aplicado_em?: string | null
          created_at?: string | null
          id?: string
          motivo?: string
          tipo_credito?: string
          twitch_username?: string
          valor?: number
        }
        Relationships: []
      }
      daily_reward_config: {
        Row: {
          created_at: string | null
          dia: number
          id: string
          pontos: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dia: number
          id?: string
          pontos?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dia?: number
          id?: string
          pontos?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      daily_reward_default_config: {
        Row: {
          created_at: string | null
          custo_restauracao_por_dia: number
          id: string
          permitir_restauracao: boolean
          pontos_dia_comum: number
          pontos_multiplo_cinco: number
          rubini_coins_por_dia: number
          tickets_por_dia: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          custo_restauracao_por_dia?: number
          id?: string
          permitir_restauracao?: boolean
          pontos_dia_comum?: number
          pontos_multiplo_cinco?: number
          rubini_coins_por_dia?: number
          tickets_por_dia?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          custo_restauracao_por_dia?: number
          id?: string
          permitir_restauracao?: boolean
          pontos_dia_comum?: number
          pontos_multiplo_cinco?: number
          rubini_coins_por_dia?: number
          tickets_por_dia?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      daily_reward_special_config: {
        Row: {
          created_at: string | null
          dia_sequencia: number
          id: string
          pontos: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dia_sequencia: number
          id?: string
          pontos: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dia_sequencia?: number
          id?: string
          pontos?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      daily_rewards_history: {
        Row: {
          created_at: string | null
          dia: number
          id: string
          pontos: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dia: number
          id?: string
          pontos: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          dia?: number
          id?: string
          pontos?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_rewards_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_merge_audit: {
        Row: {
          canonical_profile_id: string
          duplicate_profile_id: string
          id: string
          merged_at: string
          merged_by: string | null
          metadata: Json | null
          rubini_coins_after_canonical: number
          rubini_coins_before_canonical: number
          rubini_coins_before_duplicate: number
          tickets_after_canonical: number
          tickets_before_canonical: number
          tickets_before_duplicate: number
        }
        Insert: {
          canonical_profile_id: string
          duplicate_profile_id: string
          id?: string
          merged_at?: string
          merged_by?: string | null
          metadata?: Json | null
          rubini_coins_after_canonical?: number
          rubini_coins_before_canonical?: number
          rubini_coins_before_duplicate?: number
          tickets_after_canonical?: number
          tickets_before_canonical?: number
          tickets_before_duplicate?: number
        }
        Update: {
          canonical_profile_id?: string
          duplicate_profile_id?: string
          id?: string
          merged_at?: string
          merged_by?: string | null
          metadata?: Json | null
          rubini_coins_after_canonical?: number
          rubini_coins_before_canonical?: number
          rubini_coins_before_duplicate?: number
          tickets_after_canonical?: number
          tickets_before_canonical?: number
          tickets_before_duplicate?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name_canonical: string | null
          id: string
          is_active: boolean
          merged_into: string | null
          nome: string
          nome_personagem: string | null
          twitch_user_id: string | null
          twitch_username: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name_canonical?: string | null
          id: string
          is_active?: boolean
          merged_into?: string | null
          nome: string
          nome_personagem?: string | null
          twitch_user_id?: string | null
          twitch_username?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name_canonical?: string | null
          id?: string
          is_active?: boolean
          merged_into?: string | null
          nome?: string
          nome_personagem?: string | null
          twitch_user_id?: string | null
          twitch_username?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      promotional_bar_config: {
        Row: {
          button1_color: string
          button1_text: string
          button1_url: string
          button2_color: string
          button2_text: string
          button2_url: string
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          button1_color?: string
          button1_text?: string
          button1_url?: string
          button2_color?: string
          button2_text?: string
          button2_url?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          button1_color?: string
          button1_text?: string
          button1_url?: string
          button2_color?: string
          button2_text?: string
          button2_url?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      raffles: {
        Row: {
          created_at: string
          id: string
          nome_vencedor: string
          observacoes: string | null
          pago: boolean
          participantes: Json
          tipo_premio: string | null
          valor_premio: number | null
          vencedor_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nome_vencedor: string
          observacoes?: string | null
          pago?: boolean
          participantes?: Json
          tipo_premio?: string | null
          valor_premio?: number | null
          vencedor_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nome_vencedor?: string
          observacoes?: string | null
          pago?: boolean
          participantes?: Json
          tipo_premio?: string | null
          valor_premio?: number | null
          vencedor_id?: string | null
        }
        Relationships: []
      }
      rubini_coins_balance: {
        Row: {
          created_at: string | null
          saldo: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          saldo?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          saldo?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rubini_coins_balance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rubini_coins_history: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          idempotency_key: string | null
          motivo: string
          origem: string | null
          referencia_id: string | null
          retries: number | null
          status: string | null
          user_id: string | null
          variacao: number
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          motivo: string
          origem?: string | null
          referencia_id?: string | null
          retries?: number | null
          status?: string | null
          user_id?: string | null
          variacao: number
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          motivo?: string
          origem?: string | null
          referencia_id?: string | null
          retries?: number | null
          status?: string | null
          user_id?: string | null
          variacao?: number
        }
        Relationships: [
          {
            foreignKeyName: "rubini_coins_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rubini_coins_resgates: {
        Row: {
          alterado_por: string | null
          created_at: string | null
          id: string
          motivo_recusa: string | null
          observacoes: string | null
          personagem: string
          quantidade: number
          status: Database["public"]["Enums"]["resgate_status"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          alterado_por?: string | null
          created_at?: string | null
          id?: string
          motivo_recusa?: string | null
          observacoes?: string | null
          personagem: string
          quantidade: number
          status?: Database["public"]["Enums"]["resgate_status"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          alterado_por?: string | null
          created_at?: string | null
          id?: string
          motivo_recusa?: string | null
          observacoes?: string | null
          personagem?: string
          quantidade?: number
          status?: Database["public"]["Enums"]["resgate_status"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rubini_coins_resgates_alterado_por_fkey"
            columns: ["alterado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rubini_coins_resgates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          created_at: string | null
          id: string
          updated_at: string | null
          video_start_time: number | null
          youtube_video_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          updated_at?: string | null
          video_start_time?: number | null
          youtube_video_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          updated_at?: string | null
          video_start_time?: number | null
          youtube_video_id?: string | null
        }
        Relationships: []
      }
      spins: {
        Row: {
          created_at: string
          id: string
          nome_usuario: string
          pago: boolean
          tipo_recompensa: string
          user_id: string | null
          valor: string
          wheel_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome_usuario: string
          pago?: boolean
          tipo_recompensa: string
          user_id?: string | null
          valor: string
          wheel_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome_usuario?: string
          pago?: boolean
          tipo_recompensa?: string
          user_id?: string | null
          valor?: string
          wheel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spins_wheel_id_fkey"
            columns: ["wheel_id"]
            isOneToOne: false
            referencedRelation: "wheels"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_ranking_config: {
        Row: {
          created_at: string | null
          exibir_publicamente: boolean
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          exibir_publicamente?: boolean
          id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          exibir_publicamente?: boolean
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      streamelements_sync_logs: {
        Row: {
          admin_user_id: string | null
          created_at: string
          error_message: string | null
          id: string
          points_added: number
          ref_original_log_id: string | null
          referencia_id: string | null
          reprocessado_em: string | null
          reprocessado_por: string | null
          requer_reprocessamento: boolean | null
          saldo_antes: number | null
          saldo_depois: number | null
          saldo_verificado: boolean
          success: boolean
          tentativas_verificacao: number | null
          tipo_operacao: string
          user_id: string | null
          username: string
          verificado_em: string | null
        }
        Insert: {
          admin_user_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          points_added: number
          ref_original_log_id?: string | null
          referencia_id?: string | null
          reprocessado_em?: string | null
          reprocessado_por?: string | null
          requer_reprocessamento?: boolean | null
          saldo_antes?: number | null
          saldo_depois?: number | null
          saldo_verificado?: boolean
          success?: boolean
          tentativas_verificacao?: number | null
          tipo_operacao: string
          user_id?: string | null
          username: string
          verificado_em?: string | null
        }
        Update: {
          admin_user_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          points_added?: number
          ref_original_log_id?: string | null
          referencia_id?: string | null
          reprocessado_em?: string | null
          reprocessado_por?: string | null
          requer_reprocessamento?: boolean | null
          saldo_antes?: number | null
          saldo_depois?: number | null
          saldo_verificado?: boolean
          success?: boolean
          tentativas_verificacao?: number | null
          tipo_operacao?: string
          user_id?: string | null
          username?: string
          verificado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "streamelements_sync_logs_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "streamelements_sync_logs_ref_original_log_id_fkey"
            columns: ["ref_original_log_id"]
            isOneToOne: false
            referencedRelation: "se_sync_logs_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "streamelements_sync_logs_ref_original_log_id_fkey"
            columns: ["ref_original_log_id"]
            isOneToOne: false
            referencedRelation: "streamelements_sync_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "streamelements_sync_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tibiatermo_general_config: {
        Row: {
          bloquear_nova_partida: boolean
          created_at: string | null
          exigir_login: boolean
          id: string
          updated_at: string | null
        }
        Insert: {
          bloquear_nova_partida?: boolean
          created_at?: string | null
          exigir_login?: boolean
          id?: string
          updated_at?: string | null
        }
        Update: {
          bloquear_nova_partida?: boolean
          created_at?: string | null
          exigir_login?: boolean
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tibiatermo_history: {
        Row: {
          created_at: string | null
          id: string
          nome_usuario: string
          num_tentativas: number
          tipo_recompensa: string
          user_id: string | null
          valor: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome_usuario: string
          num_tentativas: number
          tipo_recompensa: string
          user_id?: string | null
          valor: number
        }
        Update: {
          created_at?: string | null
          id?: string
          nome_usuario?: string
          num_tentativas?: number
          tipo_recompensa?: string
          user_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "tibiatermo_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tibiatermo_rewards_by_attempt: {
        Row: {
          ativa: boolean
          created_at: string | null
          id: string
          pontos_loja: number
          tentativa: number
          tickets: number
          updated_at: string | null
        }
        Insert: {
          ativa?: boolean
          created_at?: string | null
          id?: string
          pontos_loja?: number
          tentativa: number
          tickets?: number
          updated_at?: string | null
        }
        Update: {
          ativa?: boolean
          created_at?: string | null
          id?: string
          pontos_loja?: number
          tentativa?: number
          tickets?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      tibiatermo_rewards_config: {
        Row: {
          created_at: string | null
          id: string
          max_tentativas_bonus: number
          pontos_acerto: number
          tickets_bonus: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_tentativas_bonus?: number
          pontos_acerto?: number
          tickets_bonus?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          max_tentativas_bonus?: number
          pontos_acerto?: number
          tickets_bonus?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      tibiatermo_user_games: {
        Row: {
          acertou: boolean | null
          created_at: string | null
          data_jogo: string
          id: string
          num_tentativas: number | null
          palavra_dia: string
          premiacao_pontos: number | null
          premiacao_tickets: number | null
          tentativas: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          acertou?: boolean | null
          created_at?: string | null
          data_jogo: string
          id?: string
          num_tentativas?: number | null
          palavra_dia: string
          premiacao_pontos?: number | null
          premiacao_tickets?: number | null
          tentativas?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          acertou?: boolean | null
          created_at?: string | null
          data_jogo?: string
          id?: string
          num_tentativas?: number | null
          palavra_dia?: string
          premiacao_pontos?: number | null
          premiacao_tickets?: number | null
          tentativas?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tibiadle_user_games_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tibiatermo_words: {
        Row: {
          ativa: boolean
          created_at: string | null
          id: string
          palavra: string
          updated_at: string | null
        }
        Insert: {
          ativa?: boolean
          created_at?: string | null
          id?: string
          palavra: string
          updated_at?: string | null
        }
        Update: {
          ativa?: boolean
          created_at?: string | null
          id?: string
          palavra?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ticket_ledger: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          idempotency_key: string | null
          motivo: string
          origem: string | null
          referencia_id: string | null
          retries: number | null
          status: string | null
          user_id: string
          variacao: number
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          motivo: string
          origem?: string | null
          referencia_id?: string | null
          retries?: number | null
          status?: string | null
          user_id: string
          variacao: number
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          motivo?: string
          origem?: string | null
          referencia_id?: string | null
          retries?: number | null
          status?: string | null
          user_id?: string
          variacao?: number
        }
        Relationships: []
      }
      tickets: {
        Row: {
          tickets_atual: number
          updated_at: string
          user_id: string
        }
        Insert: {
          tickets_atual?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          tickets_atual?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_aliases: {
        Row: {
          changed_at: string
          id: string
          old_display_name: string
          old_login: string | null
          twitch_user_id: string
          user_id: string
        }
        Insert: {
          changed_at?: string
          id?: string
          old_display_name: string
          old_login?: string | null
          twitch_user_id: string
          user_id: string
        }
        Update: {
          changed_at?: string
          id?: string
          old_display_name?: string
          old_login?: string | null
          twitch_user_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_aliases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_daily_logins: {
        Row: {
          created_at: string | null
          dia_atual: number
          id: string
          ultimo_login: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dia_atual?: number
          id?: string
          ultimo_login: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          dia_atual?: number
          id?: string
          ultimo_login?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_daily_logins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wheels: {
        Row: {
          ativa: boolean
          created_at: string
          duracao_spin: number
          id: string
          nome: string
          ordem: number | null
          recompensas: Json
          updated_at: string
          visivel_para_usuarios: boolean | null
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          duracao_spin?: number
          id?: string
          nome: string
          ordem?: number | null
          recompensas?: Json
          updated_at?: string
          visivel_para_usuarios?: boolean | null
        }
        Update: {
          ativa?: boolean
          created_at?: string
          duracao_spin?: number
          id?: string
          nome?: string
          ordem?: number | null
          recompensas?: Json
          updated_at?: string
          visivel_para_usuarios?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      se_sync_logs_v: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string | null
          points_added: number | null
          referencia_id: string | null
          reprocessado_em: string | null
          reprocessado_por: string | null
          requer_reprocessamento: boolean | null
          saldo_antes: number | null
          saldo_depois: number | null
          saldo_verificado: boolean | null
          status: string | null
          success: boolean | null
          tentativas_verificacao: number | null
          tipo_operacao: string | null
          user_id: string | null
          username: string | null
          verificado_em: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string | null
          points_added?: number | null
          referencia_id?: string | null
          reprocessado_em?: string | null
          reprocessado_por?: string | null
          requer_reprocessamento?: boolean | null
          saldo_antes?: number | null
          saldo_depois?: number | null
          saldo_verificado?: boolean | null
          status?: never
          success?: boolean | null
          tentativas_verificacao?: number | null
          tipo_operacao?: string | null
          user_id?: string | null
          username?: string | null
          verificado_em?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string | null
          points_added?: number | null
          referencia_id?: string | null
          reprocessado_em?: string | null
          reprocessado_por?: string | null
          requer_reprocessamento?: boolean | null
          saldo_antes?: number | null
          saldo_depois?: number | null
          saldo_verificado?: boolean | null
          status?: never
          success?: boolean | null
          tentativas_verificacao?: number | null
          tipo_operacao?: string | null
          user_id?: string | null
          username?: string | null
          verificado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "streamelements_sync_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      consolidate_duplicate_profiles: {
        Args: never
        Returns: {
          action_taken: string
          canonical_id: string
          duplicate_id: string
          rubini_coins_consolidated: number
          tickets_consolidated: number
        }[]
      }
      get_or_create_profile_by_name: {
        Args: { p_nome: string }
        Returns: string
      }
      get_or_merge_profile_v2: {
        Args: {
          p_display_name?: string
          p_login?: string
          p_nome_personagem?: string
          p_twitch_user_id: string
        }
        Returns: string
      }
      has_admin_user: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      merge_duplicate_profiles: {
        Args: { p_keep_profile_id: string; p_remove_profile_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
      resgate_status: "PENDENTE" | "PROCESSANDO" | "ENTREGUE" | "RECUSADO"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      resgate_status: ["PENDENTE", "PROCESSANDO", "ENTREGUE", "RECUSADO"],
    },
  },
} as const

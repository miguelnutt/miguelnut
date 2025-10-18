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
          id: string
          pontos_dia_comum: number
          pontos_multiplo_cinco: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          pontos_dia_comum?: number
          pontos_multiplo_cinco?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          pontos_dia_comum?: number
          pontos_multiplo_cinco?: number
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
      profiles: {
        Row: {
          created_at: string
          id: string
          nome: string
          nome_personagem: string | null
          twitch_username: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          nome: string
          nome_personagem?: string | null
          twitch_username?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          nome_personagem?: string | null
          twitch_username?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promotional_bar_config: {
        Row: {
          button1_text: string
          button1_url: string
          button2_text: string
          button2_url: string
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          button1_text?: string
          button1_url?: string
          button2_text?: string
          button2_url?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          button1_text?: string
          button1_url?: string
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
          id: string
          motivo: string
          user_id: string | null
          variacao: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          motivo: string
          user_id?: string | null
          variacao: number
        }
        Update: {
          created_at?: string | null
          id?: string
          motivo?: string
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
          id: string
          motivo: string
          user_id: string
          variacao: number
        }
        Insert: {
          created_at?: string
          id?: string
          motivo: string
          user_id: string
          variacao: number
        }
        Update: {
          created_at?: string
          id?: string
          motivo?: string
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
      [_ in never]: never
    }
    Functions: {
      get_or_create_profile_by_name: {
        Args: { p_nome: string }
        Returns: string
      }
      has_admin_user: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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

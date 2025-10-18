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
    },
  },
} as const

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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      families: {
        Row: {
          code_hash: string
          created_at: string
          id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      family_members: {
        Row: {
          family_id: string
          id: string
          name: string
          share_txs: boolean
          snapshot: Json | null
          token_hash: string
          txs: Json | null
          updated_at: string
        }
        Insert: {
          family_id: string
          id?: string
          name?: string
          share_txs?: boolean
          snapshot?: Json | null
          token_hash: string
          txs?: Json | null
          updated_at?: string
        }
        Update: {
          family_id?: string
          id?: string
          name?: string
          share_txs?: boolean
          snapshot?: Json | null
          token_hash?: string
          txs?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_ping: {
        Row: {
          at: string
          id: number
        }
        Insert: {
          at?: string
          id: number
        }
        Update: {
          at?: string
          id?: number
        }
        Relationships: []
      }
      feedback: {
        Row: {
          app_version: string
          author: string
          created_at: string
          done: boolean
          id: string
          kind: string
          text: string
        }
        Insert: {
          app_version?: string
          author?: string
          created_at?: string
          done?: boolean
          id?: string
          kind?: string
          text: string
        }
        Update: {
          app_version?: string
          author?: string
          created_at?: string
          done?: boolean
          id?: string
          kind?: string
          text?: string
        }
        Relationships: []
      }
      feedback_owner: {
        Row: {
          id: number
          key_hash: string
        }
        Insert: {
          id: number
          key_hash: string
        }
        Update: {
          id?: number
          key_hash?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _fam_code: { Args: { n: number }; Returns: string }
      _fam_hash: { Args: { t: string }; Returns: string }
      _fam_me: { Args: { p_member: string; p_token: string }; Returns: string }
      _fam_norm: { Args: { t: string }; Returns: string }
      _fb_owner: { Args: { p_key: string }; Returns: undefined }
      family_create: {
        Args: { p_name: string; p_snapshot: Json }
        Returns: Json
      }
      family_delete: {
        Args: { p_member: string; p_token: string }
        Returns: undefined
      }
      family_join: {
        Args: { p_code: string; p_name: string; p_snapshot: Json }
        Returns: Json
      }
      family_leave: {
        Args: { p_member: string; p_token: string }
        Returns: undefined
      }
      family_ping: { Args: never; Returns: Json }
      family_pull: {
        Args: { p_member: string; p_token: string }
        Returns: Json
      }
      family_push: {
        Args: {
          p_member: string
          p_name: string
          p_share: boolean
          p_snapshot: Json
          p_token: string
          p_txs: Json
        }
        Returns: undefined
      }
      family_rotate: {
        Args: { p_member: string; p_token: string }
        Returns: string
      }
      feedback_claim: { Args: { p_key: string }; Returns: boolean }
      feedback_delete: {
        Args: { p_id: string; p_key: string }
        Returns: undefined
      }
      feedback_list: { Args: { p_key: string }; Returns: Json }
      feedback_mark: {
        Args: { p_done: boolean; p_id: string; p_key: string }
        Returns: undefined
      }
      feedback_send: {
        Args: {
          p_author: string
          p_kind: string
          p_text: string
          p_version: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

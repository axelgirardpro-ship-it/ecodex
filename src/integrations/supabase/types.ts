export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      data_imports: {
        Row: {
          completed_at: string | null
          created_at: string
          error_details: Json | null
          file_name: string
          file_size: number | null
          id: string
          imported_by: string
          records_failed: number | null
          records_inserted: number | null
          records_processed: number | null
          records_updated: number | null
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_details?: Json | null
          file_name: string
          file_size?: number | null
          id?: string
          imported_by: string
          records_failed?: number | null
          records_inserted?: number | null
          records_processed?: number | null
          records_updated?: number | null
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_details?: Json | null
          file_name?: string
          file_size?: number | null
          id?: string
          imported_by?: string
          records_failed?: number | null
          records_inserted?: number | null
          records_processed?: number | null
          records_updated?: number | null
          status?: string | null
        }
        Relationships: []
      }
      datasets: {
        Row: {
          company_id: string | null
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          name: string
          status: string | null
          updated_at: string
          uploaded_by: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          name: string
          status?: string | null
          updated_at?: string
          uploaded_by: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          name?: string
          status?: string | null
          updated_at?: string
          uploaded_by?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "datasets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      emission_factors: {
        Row: {
          Commentaires: string | null
          Contributeur: string | null
          created_at: string | null
          dataset_id: string | null
          Date: number | null
          Description: string | null
          FE: number
          id: string
          Incertitude: string | null
          Localisation: string | null
          Nom: string
          Périmètre: string | null
          Secteur: string
          Source: string
          "Sous-secteur": string | null
          "Unité donnée d'activité": string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          Commentaires?: string | null
          Contributeur?: string | null
          created_at?: string | null
          dataset_id?: string | null
          Date?: number | null
          Description?: string | null
          FE: number
          id?: string
          Incertitude?: string | null
          Localisation?: string | null
          Nom: string
          Périmètre?: string | null
          Secteur: string
          Source: string
          "Sous-secteur"?: string | null
          "Unité donnée d'activité": string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          Commentaires?: string | null
          Contributeur?: string | null
          created_at?: string | null
          dataset_id?: string | null
          Date?: number | null
          Description?: string | null
          FE?: number
          id?: string
          Incertitude?: string | null
          Localisation?: string | null
          Nom?: string
          Périmètre?: string | null
          Secteur?: string
          Source?: string
          "Sous-secteur"?: string | null
          "Unité donnée d'activité"?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emission_factors_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emission_factors_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          item_data: Json
          item_id: string
          item_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_data: Json
          item_id: string
          item_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_data?: Json
          item_id?: string
          item_type?: string
          user_id?: string
        }
        Relationships: []
      }
      fe_source_workspace_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          source_name: string
          workspace_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          source_name: string
          workspace_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          source_name?: string
          workspace_id?: string
        }
        Relationships: []
      }
      fe_sources: {
        Row: {
          access_level: string
          auto_detected: boolean
          created_at: string
          id: string
          is_global: boolean
          source_name: string
          updated_at: string
        }
        Insert: {
          access_level?: string
          auto_detected?: boolean
          created_at?: string
          id?: string
          is_global?: boolean
          source_name: string
          updated_at?: string
        }
        Update: {
          access_level?: string
          auto_detected?: boolean
          created_at?: string
          id?: string
          is_global?: boolean
          source_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      search_history: {
        Row: {
          created_at: string
          id: string
          results_count: number | null
          search_filters: Json | null
          search_query: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          results_count?: number | null
          search_filters?: Json | null
          search_query: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          results_count?: number | null
          search_filters?: Json | null
          search_query?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      search_quotas: {
        Row: {
          clipboard_copies_limit: number | null
          clipboard_copies_used: number | null
          created_at: string
          exports_limit: number | null
          exports_used: number | null
          favorites_limit: number | null
          favorites_used: number | null
          id: string
          plan_type: string
          reset_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          clipboard_copies_limit?: number | null
          clipboard_copies_used?: number | null
          created_at?: string
          exports_limit?: number | null
          exports_used?: number | null
          favorites_limit?: number | null
          favorites_used?: number | null
          id?: string
          plan_type?: string
          reset_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          clipboard_copies_limit?: number | null
          clipboard_copies_used?: number | null
          created_at?: string
          exports_limit?: number | null
          exports_used?: number | null
          favorites_limit?: number | null
          favorites_used?: number | null
          id?: string
          plan_type?: string
          reset_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          is_supra_admin: boolean | null
          role: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          is_supra_admin?: boolean | null
          role: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          is_supra_admin?: boolean | null
          role?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          ip_address: unknown | null
          last_activity: string
          session_token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: unknown | null
          last_activity?: string
          session_token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: unknown | null
          last_activity?: string
          session_token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          assigned_by: string | null
          company: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          normalized_email: string | null
          phone: string | null
          plan_type: string | null
          position: string | null
          subscribed: boolean | null
          subscription_end: string | null
          trial_end: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          assigned_by?: string | null
          company?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          normalized_email?: string | null
          phone?: string | null
          plan_type?: string | null
          position?: string | null
          subscribed?: boolean | null
          subscription_end?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          assigned_by?: string | null
          company?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          normalized_email?: string | null
          phone?: string | null
          plan_type?: string | null
          position?: string | null
          subscribed?: boolean | null
          subscription_end?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          status: string | null
          token: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          role: string
          status?: string | null
          token: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          status?: string | null
          token?: string
          workspace_id?: string
        }
        Relationships: []
      }
      workspace_trials: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          is_active: boolean
          started_at: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          started_at?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          started_at?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_trials_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          billing_address: string | null
          billing_company: string | null
          billing_country: string | null
          billing_postal_code: string | null
          billing_siren: string | null
          billing_vat_number: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          plan_type: string
          updated_at: string
        }
        Insert: {
          billing_address?: string | null
          billing_company?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          billing_siren?: string | null
          billing_vat_number?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
          plan_type?: string
          updated_at?: string
        }
        Update: {
          billing_address?: string | null
          billing_company?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          billing_siren?: string | null
          billing_vat_number?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          plan_type?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_sessions: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      get_accessible_plan_tiers: {
        Args: { user_plan: string }
        Returns: string[]
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_workspace_plan: {
        Args: { user_uuid?: string }
        Returns: string
      }
      has_company_access: {
        Args: { company_id: string }
        Returns: boolean
      }
      has_workspace_access: {
        Args: { workspace_id: string }
        Returns: boolean
      }
      is_company_owner: {
        Args: { company_id: string }
        Returns: boolean
      }
      is_supra_admin: {
        Args: { user_uuid?: string }
        Returns: boolean
      }
      is_workspace_owner: {
        Args: { workspace_id: string }
        Returns: boolean
      }
      normalize_email: {
        Args: { email_input: string }
        Returns: string
      }
      sync_user_quotas_with_plans: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      workspace_has_access: {
        Args: { workspace_uuid: string }
        Returns: boolean
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
    Enums: {},
  },
} as const

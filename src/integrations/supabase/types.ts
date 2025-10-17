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
          error_samples: Json | null
          failed: number | null
          file_name: string
          file_size: number | null
          finished_at: string | null
          id: string
          imported_by: string
          inserted: number | null
          processed: number | null
          records_failed: number | null
          records_inserted: number | null
          records_processed: number | null
          records_updated: number | null
          started_at: string | null
          status: string | null
          storage_path: string | null
          updated: number | null
          user_id: string | null
          version_id: string | null
          workspace_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_details?: Json | null
          error_samples?: Json | null
          failed?: number | null
          file_name: string
          file_size?: number | null
          finished_at?: string | null
          id?: string
          imported_by: string
          inserted?: number | null
          processed?: number | null
          records_failed?: number | null
          records_inserted?: number | null
          records_processed?: number | null
          records_updated?: number | null
          started_at?: string | null
          status?: string | null
          storage_path?: string | null
          updated?: number | null
          user_id?: string | null
          version_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_details?: Json | null
          error_samples?: Json | null
          failed?: number | null
          file_name?: string
          file_size?: number | null
          finished_at?: string | null
          id?: string
          imported_by?: string
          inserted?: number | null
          processed?: number | null
          records_failed?: number | null
          records_inserted?: number | null
          records_processed?: number | null
          records_updated?: number | null
          started_at?: string | null
          status?: string | null
          storage_path?: string | null
          updated?: number | null
          user_id?: string | null
          version_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_imports_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "fe_versions"
            referencedColumns: ["id"]
          },
        ]
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
          Commentaires_en: string | null
          Contributeur: string | null
          Contributeur_en: string | null
          Méthodologie: string | null
          Méthodologie_en: string | null
          Type_de_données: string | null
          Type_de_données_en: string | null
          created_at: string | null
          dataset_id: string | null
          Date: number | null
          Description: string | null
          Description_en: string | null
          factor_key: string | null
          FE: number
          id: string
          import_type: string | null
          Incertitude: string | null
          ID_FE: string
          language: string
          Localisation: string | null
          Localisation_en: string | null
          Nom: string
          Nom_en: string | null
          Périmètre: string | null
          Périmètre_en: string | null
          Secteur: string
          Secteur_en: string | null
          Source: string
          "Sous-secteur": string | null
          "Sous-secteur_en": string | null
          "Unité donnée d'activité": string
          Unite_en: string | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          Commentaires?: string | null
          Commentaires_en?: string | null
          Contributeur?: string | null
          Contributeur_en?: string | null
          Méthodologie?: string | null
          Méthodologie_en?: string | null
          Type_de_données?: string | null
          Type_de_données_en?: string | null
          created_at?: string | null
          dataset_id?: string | null
          Date?: number | null
          Description?: string | null
          Description_en?: string | null
          factor_key?: string | null
          FE: number
          id?: string
          import_type?: string | null
          Incertitude?: string | null
          ID_FE: string
          language?: string
          Localisation?: string | null
          Localisation_en?: string | null
          Nom: string
          Nom_en?: string | null
          Périmètre?: string | null
          Périmètre_en?: string | null
          Secteur: string
          Secteur_en?: string | null
          Source: string
          "Sous-secteur"?: string | null
          "Sous-secteur_en"?: string | null
          "Unité donnée d'activité": string
          Unite_en?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          Commentaires?: string | null
          Commentaires_en?: string | null
          Contributeur?: string | null
          Contributeur_en?: string | null
          Méthodologie?: string | null
          Méthodologie_en?: string | null
          Type_de_données?: string | null
          Type_de_données_en?: string | null
          created_at?: string | null
          dataset_id?: string | null
          Date?: number | null
          Description?: string | null
          Description_en?: string | null
          factor_key?: string | null
          FE?: number
          id?: string
          import_type?: string | null
          Incertitude?: string | null
          ID_FE?: string
          language?: string
          Localisation?: string | null
          Localisation_en?: string | null
          Nom?: string
          Nom_en?: string | null
          Périmètre?: string | null
          Périmètre_en?: string | null
          Secteur?: string
          Secteur_en?: string | null
          Source?: string
          "Sous-secteur"?: string | null
          "Sous-secteur_en"?: string | null
          "Unité donnée d'activité"?: string
          Unite_en?: string | null
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
      emission_factors_all_search: {
        Row: {
          access_level: string
          assigned_workspace_ids: string[] | null
          Commentaires_en: string | null
          Commentaires_fr: string | null
          Date: number | null
          Description_en: string | null
          Description_fr: string | null
          FE: number | null
          Incertitude: string | null
          languages: string[]
          Localisation_en: string | null
          Localisation_fr: string | null
          Nom_en: string | null
          Nom_fr: string | null
          object_id: string
          Périmètre_en: string | null
          Périmètre_fr: string | null
          scope: string
          Secteur_en: string | null
          Secteur_fr: string | null
          Source: string
          "Sous-secteur_en": string | null
          "Sous-secteur_fr": string | null
          Unite_en: string | null
          Unite_fr: string | null
          workspace_id: string | null
        }
        Insert: {
          access_level: string
          assigned_workspace_ids?: string[] | null
          Commentaires_en?: string | null
          Commentaires_fr?: string | null
          Date?: number | null
          Description_en?: string | null
          Description_fr?: string | null
          FE?: number | null
          Incertitude?: string | null
          languages: string[]
          Localisation_en?: string | null
          Localisation_fr?: string | null
          Nom_en?: string | null
          Nom_fr?: string | null
          object_id: string
          Périmètre_en?: string | null
          Périmètre_fr?: string | null
          scope: string
          Secteur_en?: string | null
          Secteur_fr?: string | null
          Source: string
          "Sous-secteur_en"?: string | null
          "Sous-secteur_fr"?: string | null
          Unite_en?: string | null
          Unite_fr?: string | null
          workspace_id?: string | null
        }
        Update: {
          access_level?: string
          assigned_workspace_ids?: string[] | null
          Commentaires_en?: string | null
          Commentaires_fr?: string | null
          Date?: number | null
          Description_en?: string | null
          Description_fr?: string | null
          FE?: number | null
          Incertitude?: string | null
          languages?: string[]
          Localisation_en?: string | null
          Localisation_fr?: string | null
          Nom_en?: string | null
          Nom_fr?: string | null
          object_id?: string
          Périmètre_en?: string | null
          Périmètre_fr?: string | null
          scope?: string
          Secteur_en?: string | null
          Secteur_fr?: string | null
          Source?: string
          "Sous-secteur_en"?: string | null
          "Sous-secteur_fr"?: string | null
          Unite_en?: string | null
          Unite_fr?: string | null
          workspace_id?: string | null
        }
        Relationships: []
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
      fe_versions: {
        Row: {
          checksum: string | null
          created_at: string
          created_by: string
          dataset_id: string | null
          id: string
          language: string
          notes: string | null
          version_label: string
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          created_by: string
          dataset_id?: string | null
          id?: string
          language?: string
          notes?: string | null
          version_label: string
        }
        Update: {
          checksum?: string | null
          created_at?: string
          created_by?: string
          dataset_id?: string | null
          id?: string
          language?: string
          notes?: string | null
          version_label?: string
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
      plan_tiers: {
        Row: {
          created_at: string
          display_name_en: string
          display_name_fr: string
          id: string
          is_active: boolean
          max_users: number
          plan_type: string
          sort_order: number
          tier_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name_en: string
          display_name_fr: string
          id?: string
          is_active?: boolean
          max_users: number
          plan_type: string
          sort_order?: number
          tier_code: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name_en?: string
          display_name_fr?: string
          id?: string
          is_active?: boolean
          max_users?: number
          plan_type?: string
          sort_order?: number
          tier_code?: string
          updated_at?: string
        }
        Relationships: []
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
          plan_tier: string | null
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
          plan_tier?: string | null
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
          plan_tier?: string | null
          plan_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_workspaces_plan_tier"
            columns: ["plan_tier"]
            isOneToOne: false
            referencedRelation: "plan_tiers"
            referencedColumns: ["tier_code"]
          }
        ]
      }
    }
    Views: {
      system_health_check: {
        Row: {
          component: string | null
          healthy: number | null
          issues: number | null
          total: number | null
        }
        Relationships: []
      }
      workspace_quotas_monitoring: {
        Row: {
          action_required: string | null
          auth_status: string | null
          clipboard_copies_limit: number | null
          email: string | null
          expected_clipboard_limit: number | null
          expected_exports_limit: number | null
          expected_favorites_limit: number | null
          exports_limit: number | null
          favorites_limit: number | null
          quota_status: string | null
          user_role: string | null
          workspace_id: string | null
          workspace_name: string | null
          workspace_plan: string | null
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
      workspace_summary: {
        Row: {
          plan_type: string | null
          total_users: number | null
          users_with_correct_quotas: number | null
          users_with_quotas: number | null
          valid_users: number | null
          workspace_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      adjust_favorites_quota: {
        Args: { p_delta: number; p_user: string }
        Returns: undefined
      }
      audit_and_fix_all_quotas: {
        Args: Record<PropertyKey, never>
        Returns: {
          issues_fixed: number
          issues_found: number
          workspace_name: string
        }[]
      }
      bulk_manage_fe_source_assignments: {
        Args: {
          p_assigned_source_names: string[]
          p_unassigned_source_names: string[]
          p_workspace_id: string
        }
        Returns: undefined
      }
      calculate_factor_key: {
        Args: {
          p_language?: string
          p_localisation: string
          p_nom: string
          p_perimetre: string
          p_source: string
          p_unite: string
          p_workspace_id: string
        }
        Returns: string
      }
      can_manage_user_roles: {
        Args: { target_workspace_id: string }
        Returns: boolean
      }
      can_view_user_roles: {
        Args: { target_user_id: string; target_workspace_id: string }
        Returns: boolean
      }
      cleanup_invalid_users: {
        Args: Record<PropertyKey, never>
        Returns: {
          action: string
          email: string
        }[]
      }
      complete_webhook_batch: {
        Args: {
          p_batch_id: string
          p_error_message?: string
          p_success: boolean
        }
        Returns: boolean
      }
      ensure_user_quotas: {
        Args: { user_uuid: string }
        Returns: undefined
      }
      get_accessible_plan_tiers: {
        Args: { user_plan: string }
        Returns: string[]
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_next_webhook_batches: {
        Args: { p_limit?: number }
        Returns: {
          id: string
          object_ids: string[]
          operation_type: string
          priority: number
          scheduled_at: string
          source_name: string
        }[]
      }
      get_quota_limits: {
        Args: { workspace_plan_type: string }
        Returns: {
          clipboard_copies_limit: number
          exports_limit: number
          favorites_limit: number
        }[]
      }
      get_user_workspace_plan: {
        Args: { user_uuid?: string }
        Returns: string
      }
      get_workspace_quotas: {
        Args: { workspace_uuid: string }
        Returns: {
          clipboard_copies_limit: number
          exports_limit: number
          favorites_limit: number
        }[]
      }
      get_workspace_users_with_roles: {
        Args: { target_workspace_id: string }
        Returns: {
          created_at: string
          email: string
          first_name: string
          last_name: string
          user_id: string
          user_roles: Json
        }[]
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
        Args: Record<PropertyKey, never> | { user_uuid?: string }
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
      queue_webhook_batch: {
        Args: {
          p_object_ids?: string[]
          p_operation_type: string
          p_priority?: number
          p_source_name: string
        }
        Returns: string
      }
      rebuild_emission_factors_all_search: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      record_algolia_metric: {
        Args: {
          p_additional_data?: Json
          p_metric_type: string
          p_metric_value: number
          p_user_id?: string
          p_workspace_id?: string
        }
        Returns: string
      }
      refresh_ef_all_for_source: {
        Args: { p_source: string }
        Returns: undefined
      }
      refresh_projection_for_source: {
        Args: { p_language?: string; p_source: string } | { p_source: string }
        Returns: undefined
      }
      refresh_projection_for_source_fr: {
        Args: { p_source: string }
        Returns: undefined
      }
      refresh_projection_for_source_safe: {
        Args: { p_source: string }
        Returns: undefined
      }
      safe_to_int: {
        Args: { v: string }
        Returns: number
      }
      safe_to_numeric: {
        Args: { v: number } | { v: string }
        Returns: number
      }
      sync_user_quotas_with_plans: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      sync_workspace_user_quotas: {
        Args: { target_workspace_id: string }
        Returns: number
      }
      update_user_quotas_from_workspace: {
        Args: { target_user_id: string }
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

 

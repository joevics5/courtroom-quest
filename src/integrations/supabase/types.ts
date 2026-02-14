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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      case_invitations: {
        Row: {
          accepted_at: string | null
          case_id: string | null
          created_at: string | null
          id: string
          invitee_email: string
          invitee_user_id: string | null
          inviter_user_id: string
          session_id: string | null
          status: string | null
        }
        Insert: {
          accepted_at?: string | null
          case_id?: string | null
          created_at?: string | null
          id?: string
          invitee_email: string
          invitee_user_id?: string | null
          inviter_user_id: string
          session_id?: string | null
          status?: string | null
        }
        Update: {
          accepted_at?: string | null
          case_id?: string | null
          created_at?: string | null
          id?: string
          invitee_email?: string
          invitee_user_id?: string | null
          inviter_user_id?: string
          session_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_invitations_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_invitations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "case_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      case_sessions: {
        Row: {
          case_id: string
          completed_at: string | null
          current_phase: string
          current_trial_phase: number | null
          evidence_filed: boolean | null
          id: string
          jury_selection_complete: boolean | null
          opposing_counsel_id: string | null
          opposing_counsel_user_id: string | null
          phase_start_times: Json | null
          phase_timings: Json | null
          session_state: Json | null
          started_at: string | null
          timer_paused_at: string | null
          timer_started_at: string | null
          total_pause_duration: number | null
          trial_duration: number | null
          trial_mode: string | null
          trial_type: string | null
          updated_at: string | null
          user_id: string
          witnesses_locked: boolean | null
        }
        Insert: {
          case_id: string
          completed_at?: string | null
          current_phase?: string
          current_trial_phase?: number | null
          evidence_filed?: boolean | null
          id?: string
          jury_selection_complete?: boolean | null
          opposing_counsel_id?: string | null
          opposing_counsel_user_id?: string | null
          phase_start_times?: Json | null
          phase_timings?: Json | null
          session_state?: Json | null
          started_at?: string | null
          timer_paused_at?: string | null
          timer_started_at?: string | null
          total_pause_duration?: number | null
          trial_duration?: number | null
          trial_mode?: string | null
          trial_type?: string | null
          updated_at?: string | null
          user_id: string
          witnesses_locked?: boolean | null
        }
        Update: {
          case_id?: string
          completed_at?: string | null
          current_phase?: string
          current_trial_phase?: number | null
          evidence_filed?: boolean | null
          id?: string
          jury_selection_complete?: boolean | null
          opposing_counsel_id?: string | null
          opposing_counsel_user_id?: string | null
          phase_start_times?: Json | null
          phase_timings?: Json | null
          session_state?: Json | null
          started_at?: string | null
          timer_paused_at?: string | null
          timer_started_at?: string | null
          total_pause_duration?: number | null
          trial_duration?: number | null
          trial_mode?: string | null
          trial_type?: string | null
          updated_at?: string | null
          user_id?: string
          witnesses_locked?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "case_sessions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_winners: {
        Row: {
          case_id: string
          id: string
          level_achieved: string
          user_id: string
          username: string
          verdict_score: number | null
          won_at: string | null
        }
        Insert: {
          case_id: string
          id?: string
          level_achieved: string
          user_id: string
          username: string
          verdict_score?: number | null
          won_at?: string | null
        }
        Update: {
          case_id?: string
          id?: string
          level_achieved?: string
          user_id?: string
          username?: string
          verdict_score?: number | null
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_winners_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          case_type: string
          created_at: string | null
          created_by: string | null
          defendant_name: string | null
          description: string
          difficulty: string | null
          id: string
          is_multiplayer: boolean | null
          is_preset: boolean | null
          minimum_tier: string | null
          title: string
          truth_state: Json | null
          updated_at: string | null
        }
        Insert: {
          case_type: string
          created_at?: string | null
          created_by?: string | null
          defendant_name?: string | null
          description: string
          difficulty?: string | null
          id?: string
          is_multiplayer?: boolean | null
          is_preset?: boolean | null
          minimum_tier?: string | null
          title: string
          truth_state?: Json | null
          updated_at?: string | null
        }
        Update: {
          case_type?: string
          created_at?: string | null
          created_by?: string | null
          defendant_name?: string | null
          description?: string
          difficulty?: string | null
          id?: string
          is_multiplayer?: boolean | null
          is_preset?: boolean | null
          minimum_tier?: string | null
          title?: string
          truth_state?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      evidence: {
        Row: {
          auto_tagged: boolean | null
          case_id: string
          content: string | null
          created_at: string | null
          description: string | null
          discovered_at: string | null
          evidence_type: string
          exhibit_label: string | null
          file_data: string | null
          file_url: string | null
          id: string
          is_hidden: boolean | null
          relevance: string | null
          tags: string[] | null
          title: string
        }
        Insert: {
          auto_tagged?: boolean | null
          case_id: string
          content?: string | null
          created_at?: string | null
          description?: string | null
          discovered_at?: string | null
          evidence_type: string
          exhibit_label?: string | null
          file_data?: string | null
          file_url?: string | null
          id?: string
          is_hidden?: boolean | null
          relevance?: string | null
          tags?: string[] | null
          title: string
        }
        Update: {
          auto_tagged?: boolean | null
          case_id?: string
          content?: string | null
          created_at?: string | null
          description?: string | null
          discovered_at?: string | null
          evidence_type?: string
          exhibit_label?: string | null
          file_data?: string | null
          file_url?: string | null
          id?: string
          is_hidden?: boolean | null
          relevance?: string | null
          tags?: string[] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      jurors: {
        Row: {
          age: number | null
          background: string
          biases: Json | null
          created_at: string | null
          id: string
          name: string
          occupation: string | null
          personality_traits: Json | null
          photo_url: string | null
        }
        Insert: {
          age?: number | null
          background: string
          biases?: Json | null
          created_at?: string | null
          id?: string
          name: string
          occupation?: string | null
          personality_traits?: Json | null
          photo_url?: string | null
        }
        Update: {
          age?: number | null
          background?: string
          biases?: Json | null
          created_at?: string | null
          id?: string
          name?: string
          occupation?: string | null
          personality_traits?: Json | null
          photo_url?: string | null
        }
        Relationships: []
      }
      jury_selections: {
        Row: {
          created_at: string | null
          id: string
          juror_id: string
          selected_by: string
          selection_order: number | null
          session_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          juror_id: string
          selected_by: string
          selection_order?: number | null
          session_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          juror_id?: string
          selected_by?: string
          selection_order?: number | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jury_selections_juror_id_fkey"
            columns: ["juror_id"]
            isOneToOne: false
            referencedRelation: "jurors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jury_selections_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "case_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      multiplayer_invites: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          invitee_email: string
          invitee_id: string | null
          inviter_id: string
          role: string
          session_id: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          invitee_email: string
          invitee_id?: string | null
          inviter_id: string
          role?: string
          session_id: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          invitee_email?: string
          invitee_id?: string | null
          inviter_id?: string
          role?: string
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "multiplayer_invites_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "case_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_events: {
        Row: {
          content: string
          event_order: number | null
          event_type: string
          id: string
          metadata: Json | null
          session_id: string
          speaker_name: string | null
          speaker_role: string
          timestamp: string | null
        }
        Insert: {
          content: string
          event_order?: number | null
          event_type: string
          id?: string
          metadata?: Json | null
          session_id: string
          speaker_name?: string | null
          speaker_role: string
          timestamp?: string | null
        }
        Update: {
          content?: string
          event_order?: number | null
          event_type?: string
          id?: string
          metadata?: Json | null
          session_id?: string
          speaker_name?: string | null
          speaker_role?: string
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trial_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "case_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_settings: {
        Row: {
          closing_statement_minutes: number | null
          created_at: string | null
          deliberation_minutes: number | null
          duration_minutes: number
          id: string
          opening_statement_minutes: number | null
          session_id: string | null
          timer_paused_at: string | null
          timer_started_at: string | null
          total_pause_duration: number | null
          trial_mode: string
          witness_examination_minutes: number | null
          witness_limit: number | null
        }
        Insert: {
          closing_statement_minutes?: number | null
          created_at?: string | null
          deliberation_minutes?: number | null
          duration_minutes?: number
          id?: string
          opening_statement_minutes?: number | null
          session_id?: string | null
          timer_paused_at?: string | null
          timer_started_at?: string | null
          total_pause_duration?: number | null
          trial_mode?: string
          witness_examination_minutes?: number | null
          witness_limit?: number | null
        }
        Update: {
          closing_statement_minutes?: number | null
          created_at?: string | null
          deliberation_minutes?: number | null
          duration_minutes?: number
          id?: string
          opening_statement_minutes?: number | null
          session_id?: string | null
          timer_paused_at?: string | null
          timer_started_at?: string | null
          total_pause_duration?: number | null
          trial_mode?: string
          witness_examination_minutes?: number | null
          witness_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trial_settings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "case_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          case_creation_count: number | null
          created_at: string | null
          current_level: string | null
          is_admin: boolean | null
          subscription_tier: string
          trial_count: number | null
          updated_at: string | null
          user_id: string
          voice_minutes_remaining: number | null
          wins_count: number | null
        }
        Insert: {
          case_creation_count?: number | null
          created_at?: string | null
          current_level?: string | null
          is_admin?: boolean | null
          subscription_tier?: string
          trial_count?: number | null
          updated_at?: string | null
          user_id: string
          voice_minutes_remaining?: number | null
          wins_count?: number | null
        }
        Update: {
          case_creation_count?: number | null
          created_at?: string | null
          current_level?: string | null
          is_admin?: boolean | null
          subscription_tier?: string
          trial_count?: number | null
          updated_at?: string | null
          user_id?: string
          voice_minutes_remaining?: number | null
          wins_count?: number | null
        }
        Relationships: []
      }
      verdicts: {
        Row: {
          delivered_at: string | null
          evidence_cited: string[] | null
          id: string
          missed_opportunities: string[] | null
          outcome: string
          reasoning: string
          score: number | null
          session_id: string
          witness_performance: Json | null
        }
        Insert: {
          delivered_at?: string | null
          evidence_cited?: string[] | null
          id?: string
          missed_opportunities?: string[] | null
          outcome: string
          reasoning: string
          score?: number | null
          session_id: string
          witness_performance?: Json | null
        }
        Update: {
          delivered_at?: string | null
          evidence_cited?: string[] | null
          id?: string
          missed_opportunities?: string[] | null
          outcome?: string
          reasoning?: string
          score?: number | null
          session_id?: string
          witness_performance?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "verdicts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "case_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      witness_interactions: {
        Row: {
          asked_at: string | null
          id: string
          interaction_order: number | null
          phase: string
          question: string
          response: string
          revealed_evidence: string | null
          session_id: string
          witness_id: string
        }
        Insert: {
          asked_at?: string | null
          id?: string
          interaction_order?: number | null
          phase: string
          question: string
          response: string
          revealed_evidence?: string | null
          session_id: string
          witness_id: string
        }
        Update: {
          asked_at?: string | null
          id?: string
          interaction_order?: number | null
          phase?: string
          question?: string
          response?: string
          revealed_evidence?: string | null
          session_id?: string
          witness_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "witness_interactions_revealed_evidence_fkey"
            columns: ["revealed_evidence"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "witness_interactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "case_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "witness_interactions_witness_id_fkey"
            columns: ["witness_id"]
            isOneToOne: false
            referencedRelation: "witnesses"
            referencedColumns: ["id"]
          },
        ]
      }
      witnesses: {
        Row: {
          background: string
          base_testimony: string
          case_id: string
          created_at: string | null
          id: string
          knowledge_scope: Json | null
          name: string
          personality_traits: Json | null
          photo_url: string | null
          role: string
          use_ai: boolean | null
        }
        Insert: {
          background: string
          base_testimony: string
          case_id: string
          created_at?: string | null
          id?: string
          knowledge_scope?: Json | null
          name: string
          personality_traits?: Json | null
          photo_url?: string | null
          role: string
          use_ai?: boolean | null
        }
        Update: {
          background?: string
          base_testimony?: string
          case_id?: string
          created_at?: string | null
          id?: string
          knowledge_scope?: Json | null
          name?: string
          personality_traits?: Json | null
          photo_url?: string | null
          role?: string
          use_ai?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "witnesses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_next_exhibit_label: { Args: { case_uuid: string }; Returns: string }
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

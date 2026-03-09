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
      branded_products: {
        Row: {
          aliases: string[] | null
          brand: string
          category: string
          created_at: string
          display_name: string
          generic_food_id: string | null
          id: string
          keywords: string[] | null
          product_name: string
          simplified_name: string | null
        }
        Insert: {
          aliases?: string[] | null
          brand: string
          category?: string
          created_at?: string
          display_name: string
          generic_food_id?: string | null
          id?: string
          keywords?: string[] | null
          product_name: string
          simplified_name?: string | null
        }
        Update: {
          aliases?: string[] | null
          brand?: string
          category?: string
          created_at?: string
          display_name?: string
          generic_food_id?: string | null
          id?: string
          keywords?: string[] | null
          product_name?: string
          simplified_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branded_products_generic_food_id_fkey"
            columns: ["generic_food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ]
      }
      common_meal_items: {
        Row: {
          amount_grams: number | null
          amount_ml: number | null
          food_id: string
          id: string
          meal_id: string
          portion_count: number | null
        }
        Insert: {
          amount_grams?: number | null
          amount_ml?: number | null
          food_id: string
          id?: string
          meal_id: string
          portion_count?: number | null
        }
        Update: {
          amount_grams?: number | null
          amount_ml?: number | null
          food_id?: string
          id?: string
          meal_id?: string
          portion_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "common_meal_items_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "common_meal_items_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "common_meals"
            referencedColumns: ["id"]
          },
        ]
      }
      common_meals: {
        Row: {
          aliases: string[] | null
          category: string
          created_at: string
          display_name: string
          id: string
          keywords: string[] | null
          simplified_name: string | null
        }
        Insert: {
          aliases?: string[] | null
          category?: string
          created_at?: string
          display_name: string
          id?: string
          keywords?: string[] | null
          simplified_name?: string | null
        }
        Update: {
          aliases?: string[] | null
          category?: string
          created_at?: string
          display_name?: string
          id?: string
          keywords?: string[] | null
          simplified_name?: string | null
        }
        Relationships: []
      }
      food_entries: {
        Row: {
          fluid_ml: number
          food_id: string | null
          id: string
          logged_at: string
          meal_id: string | null
          name: string
          phosphate_mg: number
          portions: number
          potassium_mg: number
          protein_g: number
          sodium_mg: number
          user_id: string
        }
        Insert: {
          fluid_ml?: number
          food_id?: string | null
          id?: string
          logged_at?: string
          meal_id?: string | null
          name: string
          phosphate_mg?: number
          portions?: number
          potassium_mg?: number
          protein_g?: number
          sodium_mg?: number
          user_id: string
        }
        Update: {
          fluid_ml?: number
          food_id?: string | null
          id?: string
          logged_at?: string
          meal_id?: string | null
          name?: string
          phosphate_mg?: number
          portions?: number
          potassium_mg?: number
          protein_g?: number
          sodium_mg?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_entries_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_entries_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      foods: {
        Row: {
          aliases: string[] | null
          brand: string | null
          category: string
          created_at: string
          dialysis_risk_label: string | null
          display_name: string | null
          fluid_ml: number
          id: string
          keywords: string[] | null
          name: string
          phosphate_mg: number
          portion_description: string
          portion_grams: number
          potassium_mg: number
          protein_g: number
          search_rank: number | null
          simplified_name: string | null
          sodium_mg: number
          source_name: string | null
        }
        Insert: {
          aliases?: string[] | null
          brand?: string | null
          category?: string
          created_at?: string
          dialysis_risk_label?: string | null
          display_name?: string | null
          fluid_ml?: number
          id?: string
          keywords?: string[] | null
          name: string
          phosphate_mg?: number
          portion_description: string
          portion_grams?: number
          potassium_mg?: number
          protein_g?: number
          search_rank?: number | null
          simplified_name?: string | null
          sodium_mg?: number
          source_name?: string | null
        }
        Update: {
          aliases?: string[] | null
          brand?: string | null
          category?: string
          created_at?: string
          dialysis_risk_label?: string | null
          display_name?: string | null
          fluid_ml?: number
          id?: string
          keywords?: string[] | null
          name?: string
          phosphate_mg?: number
          portion_description?: string
          portion_grams?: number
          potassium_mg?: number
          protein_g?: number
          search_rank?: number | null
          simplified_name?: string | null
          sodium_mg?: number
          source_name?: string | null
        }
        Relationships: []
      }
      meals: {
        Row: {
          created_at: string
          favorite_name: string | null
          id: string
          is_favorite: boolean
          logged_at: string
          meal_type: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          favorite_name?: string | null
          id?: string
          is_favorite?: boolean
          logged_at?: string
          meal_type?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          favorite_name?: string | null
          id?: string
          is_favorite?: boolean
          logged_at?: string
          meal_type?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      missing_searches: {
        Row: {
          created_at: string
          id: string
          normalized_search_term: string
          result_type: string
          search_term: string
          suggested_match: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          normalized_search_term: string
          result_type?: string
          search_term: string
          suggested_match?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          normalized_search_term?: string
          result_type?: string
          search_term?: string
          suggested_match?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      product_aliases: {
        Row: {
          alias: string
          id: string
          normalized_alias: string
          target_id: string
          target_type: string
        }
        Insert: {
          alias: string
          id?: string
          normalized_alias: string
          target_id: string
          target_type: string
        }
        Update: {
          alias?: string
          id?: string
          normalized_alias?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      search_logs: {
        Row: {
          created_at: string
          id: string
          match_quality: string | null
          matched: boolean
          matched_food_id: string | null
          query: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          match_quality?: string | null
          matched?: boolean
          matched_food_id?: string | null
          query: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          match_quality?: string | null
          matched?: boolean
          matched_food_id?: string | null
          query?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_logs_matched_food_id_fkey"
            columns: ["matched_food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ]
      }
      symptom_entries: {
        Row: {
          id: string
          logged_at: string
          notes: string | null
          severity_score: number
          symptom_name: string
          user_id: string
        }
        Insert: {
          id?: string
          logged_at?: string
          notes?: string | null
          severity_score?: number
          symptom_name: string
          user_id: string
        }
        Update: {
          id?: string
          logged_at?: string
          notes?: string | null
          severity_score?: number
          symptom_name?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_display_name: { Args: { raw_name: string }; Returns: string }
      get_most_used_foods: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          aliases: string[] | null
          brand: string | null
          category: string
          created_at: string
          dialysis_risk_label: string | null
          display_name: string | null
          fluid_ml: number
          id: string
          keywords: string[] | null
          name: string
          phosphate_mg: number
          portion_description: string
          portion_grams: number
          potassium_mg: number
          protein_g: number
          search_rank: number | null
          simplified_name: string | null
          sodium_mg: number
          source_name: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "foods"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_recent_foods: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          aliases: string[] | null
          brand: string | null
          category: string
          created_at: string
          dialysis_risk_label: string | null
          display_name: string | null
          fluid_ml: number
          id: string
          keywords: string[] | null
          name: string
          phosphate_mg: number
          portion_description: string
          portion_grams: number
          potassium_mg: number
          protein_g: number
          search_rank: number | null
          simplified_name: string | null
          sodium_mg: number
          source_name: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "foods"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_foods: {
        Args: { page_offset?: number; page_size?: number; search_query: string }
        Returns: {
          aliases: string[] | null
          brand: string | null
          category: string
          created_at: string
          dialysis_risk_label: string | null
          display_name: string | null
          fluid_ml: number
          id: string
          keywords: string[] | null
          name: string
          phosphate_mg: number
          portion_description: string
          portion_grams: number
          potassium_mg: number
          protein_g: number
          search_rank: number | null
          simplified_name: string | null
          sodium_mg: number
          source_name: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "foods"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_foods_by_type: {
        Args: {
          is_drink?: boolean
          page_offset?: number
          page_size?: number
          search_query: string
        }
        Returns: {
          aliases: string[] | null
          brand: string | null
          category: string
          created_at: string
          dialysis_risk_label: string | null
          display_name: string | null
          fluid_ml: number
          id: string
          keywords: string[] | null
          name: string
          phosphate_mg: number
          portion_description: string
          portion_grams: number
          potassium_mg: number
          protein_g: number
          search_rank: number | null
          simplified_name: string | null
          sodium_mg: number
          source_name: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "foods"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_foods_ranked: {
        Args: { page_offset?: number; page_size?: number; search_query: string }
        Returns: {
          aliases: string[] | null
          brand: string | null
          category: string
          created_at: string
          dialysis_risk_label: string | null
          display_name: string | null
          fluid_ml: number
          id: string
          keywords: string[] | null
          name: string
          phosphate_mg: number
          portion_description: string
          portion_grams: number
          potassium_mg: number
          protein_g: number
          search_rank: number | null
          simplified_name: string | null
          sodium_mg: number
          source_name: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "foods"
          isOneToOne: false
          isSetofReturn: true
        }
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

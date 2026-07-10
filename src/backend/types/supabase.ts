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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          description: string | null
          entity_id: number | null
          entity_type: string
          id: number
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: number | null
          entity_type: string
          id?: number
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: number | null
          entity_type?: string
          id?: number
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      borrow_records: {
        Row: {
          actual_return_date: string | null
          approved_by: string | null
          borrowed_date: string
          borrower_id: string
          condition_after: string | null
          condition_before: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          equipment_id: number
          expected_return_date: string | null
          id: number
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          actual_return_date?: string | null
          approved_by?: string | null
          borrowed_date?: string
          borrower_id: string
          condition_after?: string | null
          condition_before?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          equipment_id: number
          expected_return_date?: string | null
          id?: number
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          actual_return_date?: string | null
          approved_by?: string | null
          borrowed_date?: string
          borrower_id?: string
          condition_after?: string | null
          condition_before?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          equipment_id?: number
          expected_return_date?: string | null
          id?: number
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "borrow_records_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrow_records_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrow_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrow_records_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrow_records_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: number
          name: string
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
          programs: string[]
          short_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          programs?: string[]
          short_name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          programs?: string[]
          short_name?: string
        }
        Relationships: []
      }
      equipment: {
        Row: {
          assigned_room: string | null
          category: string | null
          category_id: number | null
          condition: string | null
          created_at: string
          department_id: string | null
          description: string | null
          equipment_code: string
          equipment_name: string
          facility_id: number | null
          id: number
          item_photo: string | null
          location: string | null
          purchase_date: string | null
          qr_code: string | null
          qr_path: string | null
          quantity: number
          remarks: string | null
          status: string
          supplier: string | null
          supplier_id: number | null
          unit: string | null
          updated_at: string
          value: number | null
        }
        Insert: {
          assigned_room?: string | null
          category?: string | null
          category_id?: number | null
          condition?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          equipment_code: string
          equipment_name: string
          facility_id?: number | null
          id?: number
          item_photo?: string | null
          location?: string | null
          purchase_date?: string | null
          qr_code?: string | null
          qr_path?: string | null
          quantity?: number
          remarks?: string | null
          status?: string
          supplier?: string | null
          supplier_id?: number | null
          unit?: string | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          assigned_room?: string | null
          category?: string | null
          category_id?: number | null
          condition?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          equipment_code?: string
          equipment_name?: string
          facility_id?: number | null
          id?: number
          item_photo?: string | null
          location?: string | null
          purchase_date?: string | null
          qr_code?: string | null
          qr_path?: string | null
          quantity?: number
          remarks?: string | null
          status?: string
          supplier?: string | null
          supplier_id?: number | null
          unit?: string | null
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      facilities: {
        Row: {
          assigned_equipment_count: number
          capacity: number
          created_at: string
          current_availability: string
          department_id: string | null
          facility_type: string
          id: number
          maintenance_history_count: number
          name: string
          updated_at: string
        }
        Insert: {
          assigned_equipment_count?: number
          capacity?: number
          created_at?: string
          current_availability?: string
          department_id?: string | null
          facility_type: string
          id?: number
          maintenance_history_count?: number
          name: string
          updated_at?: string
        }
        Update: {
          assigned_equipment_count?: number
          capacity?: number
          created_at?: string
          current_availability?: string
          department_id?: string | null
          facility_type?: string
          id?: number
          maintenance_history_count?: number
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facilities_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      login_logs: {
        Row: {
          created_at: string
          event: string
          id: number
          ip_address: string | null
          profile_id: string | null
          role: string | null
        }
        Insert: {
          created_at?: string
          event: string
          id?: number
          ip_address?: string | null
          profile_id?: string | null
          role?: string | null
        }
        Update: {
          created_at?: string
          event?: string
          id?: number
          ip_address?: string | null
          profile_id?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "login_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          assigned_to_id: string | null
          department_id: string | null
          description: string | null
          equipment_id: number | null
          facility_id: number | null
          id: number
          priority: string
          requested_at: string
          requester_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to_id?: string | null
          department_id?: string | null
          description?: string | null
          equipment_id?: number | null
          facility_id?: number | null
          id?: number
          priority?: string
          requested_at?: string
          requester_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to_id?: string | null
          department_id?: string | null
          description?: string | null
          equipment_id?: number | null
          facility_id?: number | null
          id?: number
          priority?: string
          requested_at?: string
          requester_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_assigned_to_id_fkey"
            columns: ["assigned_to_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          department_id: string | null
          id: number
          is_read: boolean
          message: string
          profile_id: string | null
          title: string
          tone: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: number
          is_read?: boolean
          message: string
          profile_id?: string | null
          title: string
          tone?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: number
          is_read?: boolean
          message?: string
          profile_id?: string | null
          title?: string
          tone?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department_id: string | null
          email: string
          employee_id: string | null
          first_name: string | null
          full_name: string
          id: string
          last_name: string | null
          phone: string | null
          position: string | null
          profile_picture_url: string | null
          role: string
          status: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          email: string
          employee_id?: string | null
          first_name?: string | null
          full_name: string
          id: string
          last_name?: string | null
          phone?: string | null
          position?: string | null
          profile_picture_url?: string | null
          role: string
          status?: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          email?: string
          employee_id?: string | null
          first_name?: string | null
          full_name?: string
          id?: string
          last_name?: string | null
          phone?: string | null
          position?: string | null
          profile_picture_url?: string | null
          role?: string
          status?: string
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_codes: {
        Row: {
          created_at: string
          equipment_id: number
          id: number
          qr_code_data: string | null
          qr_image_path: string | null
        }
        Insert: {
          created_at?: string
          equipment_id: number
          id?: number
          qr_code_data?: string | null
          qr_image_path?: string | null
        }
        Update: {
          created_at?: string
          equipment_id?: number
          id?: number
          qr_code_data?: string | null
          qr_image_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qr_codes_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: true
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact_person: string | null
          created_at: string
          email: string | null
          id: number
          name: string
          phone: string | null
        }
        Insert: {
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: number
          name: string
          phone?: string | null
        }
        Update: {
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: number
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_department_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      email_for_username: { Args: { lookup_username: string }; Returns: string }
      is_department_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
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

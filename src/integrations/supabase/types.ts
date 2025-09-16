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
      api_configurations: {
        Row: {
          access_token: string | null
          api_key: string | null
          client_id: string | null
          client_secret: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          redirect_url: string | null
          refresh_token: string | null
          service_name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          api_key?: string | null
          client_id?: string | null
          client_secret?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          redirect_url?: string | null
          refresh_token?: string | null
          service_name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          api_key?: string | null
          client_id?: string | null
          client_secret?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          redirect_url?: string | null
          refresh_token?: string | null
          service_name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          created_at: string | null
          description: string | null
          end_time: string
          event_id: string | null
          id: string
          is_health_related: boolean | null
          start_time: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_time: string
          event_id?: string | null
          id?: string
          is_health_related?: boolean | null
          start_time: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_time?: string
          event_id?: string | null
          id?: string
          is_health_related?: boolean | null
          start_time?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      fcm_tokens: {
        Row: {
          created_at: string
          device_info: Json | null
          id: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: Json | null
          id?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: Json | null
          id?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      food_items: {
        Row: {
          barcode: string | null
          brand: string | null
          calories_per_100g: number | null
          carbs_per_100g: number | null
          category: string | null
          created_at: string
          created_by: string | null
          fat_per_100g: number | null
          fiber_per_100g: number | null
          id: string
          image_url: string | null
          is_out_of_stock: boolean | null
          is_user_created: boolean | null
          name: string
          nutritional_data: Json | null
          preferred_meal_times: string[] | null
          protein_per_100g: number | null
          serving_size: number | null
          serving_unit: string | null
          sodium_per_100mg: number | null
          sugar_per_100g: number | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          calories_per_100g?: number | null
          carbs_per_100g?: number | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          fat_per_100g?: number | null
          fiber_per_100g?: number | null
          id?: string
          image_url?: string | null
          is_out_of_stock?: boolean | null
          is_user_created?: boolean | null
          name: string
          nutritional_data?: Json | null
          preferred_meal_times?: string[] | null
          protein_per_100g?: number | null
          serving_size?: number | null
          serving_unit?: string | null
          sodium_per_100mg?: number | null
          sugar_per_100g?: number | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          calories_per_100g?: number | null
          carbs_per_100g?: number | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          fat_per_100g?: number | null
          fiber_per_100g?: number | null
          id?: string
          image_url?: string | null
          is_out_of_stock?: boolean | null
          is_user_created?: boolean | null
          name?: string
          nutritional_data?: Json | null
          preferred_meal_times?: string[] | null
          protein_per_100g?: number | null
          serving_size?: number | null
          serving_unit?: string | null
          sodium_per_100mg?: number | null
          sugar_per_100g?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      health_data: {
        Row: {
          created_at: string | null
          data_type: string
          date: string
          id: string
          metadata: Json | null
          unit: string | null
          user_id: string
          value: number | null
        }
        Insert: {
          created_at?: string | null
          data_type: string
          date: string
          id?: string
          metadata?: Json | null
          unit?: string | null
          user_id: string
          value?: number | null
        }
        Update: {
          created_at?: string | null
          data_type?: string
          date?: string
          id?: string
          metadata?: Json | null
          unit?: string | null
          user_id?: string
          value?: number | null
        }
        Relationships: []
      }
      meal_items: {
        Row: {
          calories: number | null
          carbs: number | null
          created_at: string
          fat: number | null
          food_item_id: string | null
          id: string
          meal_id: string
          protein: number | null
          quantity: number
          recipe_id: string | null
          unit: string
        }
        Insert: {
          calories?: number | null
          carbs?: number | null
          created_at?: string
          fat?: number | null
          food_item_id?: string | null
          id?: string
          meal_id: string
          protein?: number | null
          quantity: number
          recipe_id?: string | null
          unit?: string
        }
        Update: {
          calories?: number | null
          carbs?: number | null
          created_at?: string
          fat?: number | null
          food_item_id?: string | null
          id?: string
          meal_id?: string
          protein?: number | null
          quantity?: number
          recipe_id?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_items_food_item_id_fkey"
            columns: ["food_item_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_items_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          total_calories: number | null
          total_carbs: number | null
          total_fat: number | null
          total_protein: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          total_calories?: number | null
          total_carbs?: number | null
          total_fat?: number | null
          total_protein?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          total_calories?: number | null
          total_carbs?: number | null
          total_fat?: number | null
          total_protein?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meals: {
        Row: {
          calories: number | null
          carbs: number | null
          created_at: string
          fat: number | null
          id: string
          meal_plan_id: string
          meal_type: string
          name: string | null
          notes: string | null
          protein: number | null
          updated_at: string
        }
        Insert: {
          calories?: number | null
          carbs?: number | null
          created_at?: string
          fat?: number | null
          id?: string
          meal_plan_id: string
          meal_type: string
          name?: string | null
          notes?: string | null
          protein?: number | null
          updated_at?: string
        }
        Update: {
          calories?: number | null
          carbs?: number | null
          created_at?: string
          fat?: number | null
          id?: string
          meal_plan_id?: string
          meal_type?: string
          name?: string | null
          notes?: string | null
          protein?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meals_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_logs: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          total_calories: number | null
          total_carbs: number | null
          total_fat: number | null
          total_fiber: number | null
          total_protein: number | null
          total_sodium: number | null
          total_sugar: number | null
          updated_at: string
          user_id: string
          water_intake: number | null
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          total_calories?: number | null
          total_carbs?: number | null
          total_fat?: number | null
          total_fiber?: number | null
          total_protein?: number | null
          total_sodium?: number | null
          total_sugar?: number | null
          updated_at?: string
          user_id: string
          water_intake?: number | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          total_calories?: number | null
          total_carbs?: number | null
          total_fat?: number | null
          total_fiber?: number | null
          total_protein?: number | null
          total_sodium?: number | null
          total_sugar?: number | null
          updated_at?: string
          user_id?: string
          water_intake?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          units_preference: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          units_preference?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          units_preference?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          created_at: string
          food_item_id: string
          id: string
          notes: string | null
          quantity: number
          recipe_id: string
          unit: string
        }
        Insert: {
          created_at?: string
          food_item_id: string
          id?: string
          notes?: string | null
          quantity: number
          recipe_id: string
          unit?: string
        }
        Update: {
          created_at?: string
          food_item_id?: string
          id?: string
          notes?: string | null
          quantity?: number
          recipe_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_food_item_id_fkey"
            columns: ["food_item_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          cook_time: number | null
          created_at: string
          description: string | null
          difficulty: string | null
          id: string
          image_url: string | null
          instructions: string | null
          is_out_of_stock: boolean | null
          is_public: boolean | null
          name: string
          preferred_meal_times: string[] | null
          prep_time: number | null
          servings: number | null
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cook_time?: number | null
          created_at?: string
          description?: string | null
          difficulty?: string | null
          id?: string
          image_url?: string | null
          instructions?: string | null
          is_out_of_stock?: boolean | null
          is_public?: boolean | null
          name: string
          preferred_meal_times?: string[] | null
          prep_time?: number | null
          servings?: number | null
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cook_time?: number | null
          created_at?: string
          description?: string | null
          difficulty?: string | null
          id?: string
          image_url?: string | null
          instructions?: string | null
          is_out_of_stock?: boolean | null
          is_public?: boolean | null
          name?: string
          preferred_meal_times?: string[] | null
          prep_time?: number | null
          servings?: number | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      routines: {
        Row: {
          amazon_routine_id: string | null
          created_at: string | null
          description: string | null
          duration_days: number | null
          id: string
          is_active: boolean | null
          reminder_times: string[] | null
          routine_type: string
          schedule_days: number[] | null
          schedule_time: string | null
          start_date: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amazon_routine_id?: string | null
          created_at?: string | null
          description?: string | null
          duration_days?: number | null
          id?: string
          is_active?: boolean | null
          reminder_times?: string[] | null
          routine_type: string
          schedule_days?: number[] | null
          schedule_time?: string | null
          start_date?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amazon_routine_id?: string | null
          created_at?: string | null
          description?: string | null
          duration_days?: number | null
          id?: string
          is_active?: boolean | null
          reminder_times?: string[] | null
          routine_type?: string
          schedule_days?: number[] | null
          schedule_time?: string | null
          start_date?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      scheduled_notifications: {
        Row: {
          body: string
          created_at: string
          data: Json | null
          error_message: string | null
          id: string
          scheduled_for: string
          sent_at: string | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json | null
          error_message?: string | null
          id?: string
          scheduled_for: string
          sent_at?: string | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json | null
          error_message?: string | null
          id?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      shared_calendar_settings: {
        Row: {
          created_at: string
          id: string
          managed_by: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          managed_by: string
          setting_key: string
          setting_value: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          managed_by?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      shopping_list_items: {
        Row: {
          created_at: string
          food_item_id: string | null
          id: string
          is_purchased: boolean | null
          name: string
          notes: string | null
          quantity: number | null
          shopping_list_id: string
          unit: string | null
        }
        Insert: {
          created_at?: string
          food_item_id?: string | null
          id?: string
          is_purchased?: boolean | null
          name: string
          notes?: string | null
          quantity?: number | null
          shopping_list_id: string
          unit?: string | null
        }
        Update: {
          created_at?: string
          food_item_id?: string | null
          id?: string
          is_purchased?: boolean | null
          name?: string
          notes?: string | null
          quantity?: number | null
          shopping_list_id?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopping_list_items_food_item_id_fkey"
            columns: ["food_item_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_list_items_shopping_list_id_fkey"
            columns: ["shopping_list_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_lists: {
        Row: {
          created_at: string
          id: string
          is_completed: boolean | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_completed?: boolean | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_completed?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          priority: string
          project: string | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean
          priority?: string
          project?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          priority?: string
          project?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          calendar_event_id: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          priority: string
          project: string | null
          reminder_sent: boolean | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          calendar_event_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          project?: string | null
          reminder_sent?: boolean | null
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          calendar_event_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          project?: string | null
          reminder_sent?: boolean | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      weight_goals: {
        Row: {
          created_at: string
          daily_calorie_deficit: number
          id: string
          is_active: boolean
          start_date: string
          start_weight: number
          target_date: string
          target_weight: number
          updated_at: string
          user_id: string
          weekly_loss_target: number
        }
        Insert: {
          created_at?: string
          daily_calorie_deficit?: number
          id?: string
          is_active?: boolean
          start_date?: string
          start_weight: number
          target_date: string
          target_weight: number
          updated_at?: string
          user_id: string
          weekly_loss_target?: number
        }
        Update: {
          created_at?: string
          daily_calorie_deficit?: number
          id?: string
          is_active?: boolean
          start_date?: string
          start_weight?: number
          target_date?: string
          target_weight?: number
          updated_at?: string
          user_id?: string
          weekly_loss_target?: number
        }
        Relationships: []
      }
      weight_progress: {
        Row: {
          calorie_deficit_achieved: number | null
          calories_burned: number | null
          calories_consumed: number | null
          created_at: string
          current_weight: number | null
          date: string
          goal_id: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          calorie_deficit_achieved?: number | null
          calories_burned?: number | null
          calories_consumed?: number | null
          created_at?: string
          current_weight?: number | null
          date?: string
          goal_id: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          calorie_deficit_achieved?: number | null
          calories_burned?: number | null
          calories_consumed?: number | null
          created_at?: string
          current_weight?: number | null
          date?: string
          goal_id?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weight_progress_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "weight_goals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      master_google_config: {
        Row: {
          access_token: string | null
          api_key: string | null
          client_id: string | null
          client_secret: string | null
          created_at: string | null
          expires_at: string | null
          id: string | null
          is_active: boolean | null
          redirect_url: string | null
          refresh_token: string | null
          service_name: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          access_token?: string | null
          api_key?: string | null
          client_id?: string | null
          client_secret?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          is_active?: boolean | null
          redirect_url?: string | null
          refresh_token?: string | null
          service_name?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          access_token?: string | null
          api_key?: string | null
          client_id?: string | null
          client_secret?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          is_active?: boolean | null
          redirect_url?: string | null
          refresh_token?: string | null
          service_name?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
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

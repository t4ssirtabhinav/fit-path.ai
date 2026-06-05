export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          onboarding_complete: boolean;
          onboarding_path: 'plan' | 'track' | null;
          country: string | null;
          invite_code: string | null;
          timezone: string;
          last_onboarded_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string;
          avatar_url?: string | null;
          onboarding_complete?: boolean;
          onboarding_path?: 'plan' | 'track' | null;
          country?: string | null;
          invite_code?: string | null;
          timezone?: string;
          last_onboarded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          avatar_url?: string | null;
          onboarding_complete?: boolean;
          onboarding_path?: 'plan' | 'track' | null;
          country?: string | null;
          invite_code?: string | null;
          timezone?: string;
          last_onboarded_at?: string | null;
          updated_at?: string;
        };
      };
      health_profiles: {
        Row: {
          id: string;
          user_id: string;
          age: number | null;
          weight_kg: number | null;
          height_cm: number | null;
          gender: string | null;
          fitness_goals: string[];
          body_type: string | null;
          activity_level: string | null;
          diet_type: string | null;
          health_concerns: string[];
          injuries: string[];
          medications: string | null;
          sleep_hours_current: number | null;
          commitment_days_per_week: number | null;
          preferred_workout_time: string | null;
          food_preferences: string[];
          food_dislikes: string[];
          goal_timeline_months: number | null;
          personalization_comments: string | null;
          activity_modalities: string[];
          onboarding_details: Json;
          stress_level: number | null;
          hydration_level: string | null;
          job_type: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          age?: number | null;
          weight_kg?: number | null;
          height_cm?: number | null;
          gender?: string | null;
          fitness_goals?: string[];
          body_type?: string | null;
          activity_level?: string | null;
          diet_type?: string | null;
          health_concerns?: string[];
          injuries?: string[];
          medications?: string | null;
          sleep_hours_current?: number | null;
          commitment_days_per_week?: number | null;
          preferred_workout_time?: string | null;
          food_preferences?: string[];
          food_dislikes?: string[];
          goal_timeline_months?: number | null;
          personalization_comments?: string | null;
          activity_modalities?: string[];
          onboarding_details?: Json;
          stress_level?: number | null;
          hydration_level?: string | null;
          job_type?: string | null;
        };
        Update: Partial<Database['public']['Tables']['health_profiles']['Insert']>;
      };
      tracking_config: {
        Row: {
          id: string;
          user_id: string;
          selected_trackers: string[];
          reminder_morning: string | null;
          reminder_evening: string | null;
          reminder_style: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          selected_trackers?: string[];
          reminder_morning?: string | null;
          reminder_evening?: string | null;
          reminder_style?: string;
        };
        Update: Partial<Database['public']['Tables']['tracking_config']['Insert']>;
      };
      plans: {
        Row: {
          id: string;
          user_id: string;
          phase: number;
          is_active: boolean;
          plan_data: Json;
          generated_at: string;
          valid_until: string | null;
          last_regenerated_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          phase?: number;
          is_active?: boolean;
          plan_data?: Json;
          generated_at?: string;
          valid_until?: string | null;
          last_regenerated_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['plans']['Insert']>;
      };
      daily_tasks: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string | null;
          task_date: string;
          category: 'workout' | 'meal' | 'supplement' | 'habit' | 'sleep';
          title: string;
          description: string | null;
          target_value: number | null;
          unit: string | null;
          order_index: number;
          is_rest_day: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_id?: string | null;
          task_date: string;
          category: 'workout' | 'meal' | 'supplement' | 'habit' | 'sleep';
          title: string;
          description?: string | null;
          target_value?: number | null;
          unit?: string | null;
          order_index?: number;
          is_rest_day?: boolean;
        };
        Update: Partial<Database['public']['Tables']['daily_tasks']['Insert']>;
      };
      task_logs: {
        Row: {
          id: string;
          user_id: string;
          task_id: string;
          log_date: string;
          completed: boolean;
          completed_at: string | null;
          value_logged: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id: string;
          log_date: string;
          completed?: boolean;
          completed_at?: string | null;
          value_logged?: number | null;
          notes?: string | null;
        };
        Update: Partial<Database['public']['Tables']['task_logs']['Insert']>;
      };
      body_measurements: {
        Row: {
          id: string;
          user_id: string;
          measured_at: string;
          weight_kg: number | null;
          waist_cm: number | null;
          chest_cm: number | null;
          hips_cm: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          measured_at?: string;
          weight_kg?: number | null;
          waist_cm?: number | null;
          chest_cm?: number | null;
          hips_cm?: number | null;
          notes?: string | null;
        };
        Update: Partial<Database['public']['Tables']['body_measurements']['Insert']>;
      };
      streaks: {
        Row: {
          id: string;
          user_id: string;
          current_streak: number;
          longest_streak: number;
          total_active_days: number;
          total_missed_days: number;
          last_active_date: string | null;
          monthly_completion_rate: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          current_streak?: number;
          longest_streak?: number;
          total_active_days?: number;
          total_missed_days?: number;
          last_active_date?: string | null;
          monthly_completion_rate?: number;
        };
        Update: Partial<Database['public']['Tables']['streaks']['Insert']>;
      };
      buddies: {
        Row: {
          id: string;
          requester_id: string;
          recipient_id: string;
          status: 'pending' | 'active' | 'declined';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          requester_id: string;
          recipient_id: string;
          status?: 'pending' | 'active' | 'declined';
        };
        Update: Partial<Database['public']['Tables']['buddies']['Insert']>;
      };
      daily_logs: {
        Row: {
          id: string;
          user_id: string;
          log_date: string;
          workout_comments: string | null;
          energy_level: number | null;
          meal_comments: string | null;
          supplement_comments: string | null;
          illness_comments: string | null;
          sleep_comments: string | null;
          vitals_comments: string | null;
          other_comments: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          log_date: string;
          workout_comments?: string | null;
          energy_level?: number | null;
          meal_comments?: string | null;
          supplement_comments?: string | null;
          illness_comments?: string | null;
          sleep_comments?: string | null;
          vitals_comments?: string | null;
          other_comments?: string | null;
        };
        Update: Partial<Database['public']['Tables']['daily_logs']['Insert']>;
      };
      milestones: {
        Row: {
          id: string;
          user_id: string;
          milestone_key: string;
          unlocked_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          milestone_key: string;
          unlocked_at?: string;
        };
        Update: Partial<Database['public']['Tables']['milestones']['Insert']>;
      };
    };
  };
}

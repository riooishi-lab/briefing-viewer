import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase環境変数が設定されていません。.env.example を参照してください。')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── 型定義 ───

export interface Company {
  id: string
  name: string
  created_at: string
}

export interface AdminUser {
  id: string
  email: string
  company_id: string
  company?: Company
  created_at: string
}

export interface Student {
  id: string
  name: string
  email: string
  token: string
  token_expires_at: string
  company_id: string
  created_at: string
}

export interface BriefingVideo {
  id: string
  title: string
  description: string | null
  youtube_url: string
  duration_sec: number | null
  is_published: boolean
  company_id: string
  created_at: string
}

export type WatchEventType = 'play' | 'pause' | 'seek' | 'ended' | 'heartbeat'

export interface WatchEvent {
  id: string
  student_id: string
  video_id: string
  event_type: WatchEventType
  position_sec: number
  session_id: string | null
  company_id: string
  created_at: string
}

export interface SurveyQuestion {
  id: string
  video_id: string
  trigger_sec: number
  question_text: string
  choices: string[]  // JSONB → string[]
  company_id: string
  created_at: string
}

export interface SurveyResponse {
  id: string
  student_id: string
  question_id: string
  video_id: string
  selected_choice: string
  session_id: string | null
  company_id: string
  created_at: string
  question?: SurveyQuestion
}

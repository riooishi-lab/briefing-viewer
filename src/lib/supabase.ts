import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isConfigured) {
  console.error('Supabase環境変数が設定されていません。VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY を確認してください。')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
)

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
  youtube_url: string | null
  video_url: string | null
  duration_sec: number | null
  is_published: boolean
  chapter_survey_mode: 'all' | 'chapter_only'
  chapter_display_mode: 'none' | 'text' | 'image'
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

export interface SurveySet {
  id: string
  video_id: string
  name: string
  is_active: boolean
  company_id: string
  created_at: string
}

export interface SurveyQuestion {
  id: string
  video_id: string
  trigger_sec: number
  question_text: string
  choices: string[]  // JSONB → string[]
  chapter_id: string | null
  survey_set_id: string | null
  company_id: string
  created_at: string
}

export interface VideoChapter {
  id: string
  video_id: string
  label: string
  start_sec: number
  sort_order: number
  thumbnail_url: string | null
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
  survey_set_id: string | null
  company_id: string
  created_at: string
  question?: SurveyQuestion
}

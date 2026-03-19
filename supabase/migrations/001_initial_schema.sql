-- ============================================================
-- 説明会動画配信システム 初期スキーマ
-- ============================================================

-- ─── 企業 ───
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 管理者ユーザー ───
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 学生 ───
CREATE TABLE IF NOT EXISTS public.students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  token UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE,
  token_expires_at TIMESTAMPTZ DEFAULT (now() + interval '90 days') NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 説明会動画 ───
CREATE TABLE IF NOT EXISTS public.briefing_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  youtube_url TEXT NOT NULL,
  duration_sec INTEGER,
  is_published BOOLEAN NOT NULL DEFAULT false,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 視聴イベント ───
CREATE TABLE IF NOT EXISTS public.watch_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.briefing_videos(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('play', 'pause', 'seek', 'ended', 'heartbeat')),
  position_sec REAL NOT NULL DEFAULT 0,
  session_id TEXT,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── アンケート設問 ───
CREATE TABLE IF NOT EXISTS public.survey_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES public.briefing_videos(id) ON DELETE CASCADE,
  trigger_sec INTEGER NOT NULL DEFAULT 0,      -- 動画開始から何秒後に表示するか
  question_text TEXT NOT NULL,
  choices JSONB NOT NULL DEFAULT '[]',          -- ["選択肢A", "選択肢B", ...]
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── アンケート回答 ───
CREATE TABLE IF NOT EXISTS public.survey_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.survey_questions(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.briefing_videos(id) ON DELETE CASCADE,
  selected_choice TEXT NOT NULL,
  session_id TEXT,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, question_id)              -- 1学生1設問につき1回答
);

-- ─── RLS 有効化 ───
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.briefing_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

-- ─── ヘルパー関数 ───
CREATE OR REPLACE FUNCTION public.my_company_id()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT company_id FROM public.admin_users
  WHERE email = auth.email()
  LIMIT 1;
$$;

-- ─── RLS ポリシー ───

-- companies: 認証ユーザーは自社のみ
CREATE POLICY "companies_select" ON public.companies
  FOR SELECT USING (id = public.my_company_id());
CREATE POLICY "companies_all" ON public.companies
  FOR ALL USING (id = public.my_company_id());

-- admin_users: 自分のレコードのみ
CREATE POLICY "admin_users_select" ON public.admin_users
  FOR SELECT USING (email = auth.email());

-- students: 認証ユーザーは自社のみ / anon はトークンでSELECTのみ
CREATE POLICY "students_auth" ON public.students
  FOR ALL USING (company_id = public.my_company_id());
CREATE POLICY "students_anon_select" ON public.students
  FOR SELECT TO anon USING (true);

-- briefing_videos: 認証ユーザーは自社 / anon は公開中のみ
CREATE POLICY "videos_auth" ON public.briefing_videos
  FOR ALL USING (company_id = public.my_company_id());
CREATE POLICY "videos_anon_select" ON public.briefing_videos
  FOR SELECT TO anon USING (is_published = true);

-- watch_events: 認証ユーザーは自社 / anon はINSERTのみ
CREATE POLICY "watch_events_auth" ON public.watch_events
  FOR ALL USING (company_id = public.my_company_id());
CREATE POLICY "watch_events_anon_insert" ON public.watch_events
  FOR INSERT TO anon WITH CHECK (true);

-- survey_questions: 認証ユーザーは自社 / anon はSELECTのみ
CREATE POLICY "questions_auth" ON public.survey_questions
  FOR ALL USING (company_id = public.my_company_id());
CREATE POLICY "questions_anon_select" ON public.survey_questions
  FOR SELECT TO anon USING (true);

-- survey_responses: 認証ユーザーは自社 / anon はINSERT+SELECT
CREATE POLICY "responses_auth" ON public.survey_responses
  FOR ALL USING (company_id = public.my_company_id());
CREATE POLICY "responses_anon_insert" ON public.survey_responses
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "responses_anon_select" ON public.survey_responses
  FOR SELECT TO anon USING (true);

-- ─── インデックス ───
CREATE INDEX IF NOT EXISTS idx_watch_events_student ON public.watch_events(student_id);
CREATE INDEX IF NOT EXISTS idx_watch_events_video ON public.watch_events(video_id);
CREATE INDEX IF NOT EXISTS idx_watch_events_company ON public.watch_events(company_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_student ON public.survey_responses(student_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_question ON public.survey_responses(question_id);

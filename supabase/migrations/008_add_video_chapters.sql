-- チャプター（パート）機能: 1本の動画を複数パートに分割し、
-- 学生がパートを選んで視聴、パートごとにアンケートを紐付け可能にする

-- ─── チャプターテーブル ───
CREATE TABLE IF NOT EXISTS public.video_chapters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES public.briefing_videos(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  start_sec INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── RLS ───
ALTER TABLE public.video_chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chapters_auth" ON public.video_chapters
  FOR ALL USING (company_id = public.my_company_id());

CREATE POLICY "chapters_anon_select" ON public.video_chapters
  FOR SELECT TO anon USING (true);

-- ─── インデックス ───
CREATE INDEX IF NOT EXISTS idx_video_chapters_video ON public.video_chapters(video_id);

-- ─── survey_questions にチャプター紐付け ───
-- NULL = 全体（どのチャプターからでも表示）、指定 = そのチャプターのみ
ALTER TABLE public.survey_questions
  ADD COLUMN IF NOT EXISTS chapter_id UUID REFERENCES public.video_chapters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_survey_questions_chapter ON public.survey_questions(chapter_id);

-- ─── briefing_videos にチャプターアンケートモード ───
-- 'all' = 最初から見た人に全アンケート表示（デフォルト・従来互換）
-- 'chapter_only' = チャプター紐付け分のみ表示
ALTER TABLE public.briefing_videos
  ADD COLUMN IF NOT EXISTS chapter_survey_mode TEXT DEFAULT 'all';

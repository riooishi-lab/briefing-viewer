-- アンケートセット（バージョン管理）
-- 設問を「セット」単位でまとめ、有効化/無効化でバージョン管理する
-- 有効なセットの設問のみ学生に表示される

-- ─── アンケートセットテーブル ───
CREATE TABLE IF NOT EXISTS public.survey_sets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES public.briefing_videos(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── RLS ───
ALTER TABLE public.survey_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "survey_sets_auth" ON public.survey_sets
  FOR ALL USING (company_id = public.my_company_id());

CREATE POLICY "survey_sets_anon_select" ON public.survey_sets
  FOR SELECT TO anon USING (true);

-- ─── インデックス ───
CREATE INDEX IF NOT EXISTS idx_survey_sets_video ON public.survey_sets(video_id);

-- ─── survey_questions にセット紐付け ───
ALTER TABLE public.survey_questions
  ADD COLUMN IF NOT EXISTS survey_set_id UUID REFERENCES public.survey_sets(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_survey_questions_set ON public.survey_questions(survey_set_id);

-- ─── survey_responses にセット紐付け（どのセットで回答したか記録） ───
ALTER TABLE public.survey_responses
  ADD COLUMN IF NOT EXISTS survey_set_id UUID REFERENCES public.survey_sets(id) ON DELETE SET NULL;

-- ─── 既存データの移行: 既存の設問をデフォルトセットにまとめる ───
-- （既存設問がある場合のみ実行される）
DO $$
DECLARE
  v_video RECORD;
  v_set_id UUID;
BEGIN
  FOR v_video IN
    SELECT DISTINCT video_id, company_id FROM public.survey_questions WHERE survey_set_id IS NULL
  LOOP
    INSERT INTO public.survey_sets (video_id, name, is_active, company_id)
    VALUES (v_video.video_id, '初期アンケート', true, v_video.company_id)
    RETURNING id INTO v_set_id;

    UPDATE public.survey_questions
    SET survey_set_id = v_set_id
    WHERE video_id = v_video.video_id AND survey_set_id IS NULL;

    UPDATE public.survey_responses
    SET survey_set_id = v_set_id
    WHERE video_id = v_video.video_id AND survey_set_id IS NULL;
  END LOOP;
END;
$$;

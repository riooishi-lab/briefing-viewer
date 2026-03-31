-- 学生に卒業年度タグ追加
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS graduation_year INTEGER;

-- 学生の論理削除用カラム
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- watch_events の外部キーを CASCADE から SET NULL に変更
-- （学生削除時にログを残すため）
ALTER TABLE public.watch_events
  DROP CONSTRAINT IF EXISTS watch_events_student_id_fkey;
ALTER TABLE public.watch_events
  ADD CONSTRAINT watch_events_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE SET NULL;

-- survey_responses も同様
ALTER TABLE public.survey_responses
  DROP CONSTRAINT IF EXISTS survey_responses_student_id_fkey;
ALTER TABLE public.survey_responses
  ADD CONSTRAINT survey_responses_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE SET NULL;

-- student_id を nullable に変更
ALTER TABLE public.watch_events ALTER COLUMN student_id DROP NOT NULL;
ALTER TABLE public.survey_responses ALTER COLUMN student_id DROP NOT NULL;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_students_graduation_year ON public.students(graduation_year);
CREATE INDEX IF NOT EXISTS idx_students_deleted_at ON public.students(deleted_at);

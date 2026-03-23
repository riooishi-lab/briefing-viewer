-- 直接アップロード動画のURL保存用カラムを追加
ALTER TABLE public.briefing_videos
  ADD COLUMN IF NOT EXISTS video_url TEXT;

-- youtube_url を NULL 許容に変更（アップロード動画の場合は不要）
ALTER TABLE public.briefing_videos
  ALTER COLUMN youtube_url DROP NOT NULL;

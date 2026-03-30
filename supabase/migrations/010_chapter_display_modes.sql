-- チャプター表示モード: none(選択なし) / text(テキスト) / image(サムネイル)
ALTER TABLE public.briefing_videos
  ADD COLUMN IF NOT EXISTS chapter_display_mode TEXT DEFAULT 'text';

-- チャプターごとのサムネイル画像URL
ALTER TABLE public.video_chapters
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

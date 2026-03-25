-- anon ユーザーが動画の duration_sec を更新できる SECURITY DEFINER 関数
-- (RLS を回避して duration_sec のみを安全に更新する)
CREATE OR REPLACE FUNCTION public.update_video_duration(p_video_id UUID, p_duration INTEGER)
RETURNS void
LANGUAGE sql SECURITY DEFINER
AS $$
  UPDATE public.briefing_videos
  SET duration_sec = p_duration
  WHERE id = p_video_id AND (duration_sec IS NULL OR duration_sec = 0);
$$;

GRANT EXECUTE ON FUNCTION public.update_video_duration(UUID, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.update_video_duration(UUID, INTEGER) TO authenticated;

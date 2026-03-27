-- セキュリティ強化: トークンベースの視聴イベント・アンケート回答記録
-- クライアントから student_id を直接受け取らず、token で認証しサーバー側で解決する
-- (参照: ai-example-ts ADR-0003 Security Hardening)

-- ─── 視聴イベント記録 RPC ───
CREATE OR REPLACE FUNCTION public.record_watch_event(
  p_token UUID,
  p_video_id UUID,
  p_event_type TEXT,
  p_position_sec REAL DEFAULT 0,
  p_session_id TEXT DEFAULT NULL,
  p_device_type TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_student_id UUID;
  v_company_id UUID;
BEGIN
  -- トークンから学生を特定（有効期限チェック付き）
  SELECT id, company_id INTO v_student_id, v_company_id
  FROM public.students
  WHERE token = p_token
    AND token_expires_at > now();

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  -- イベント種別バリデーション
  IF p_event_type NOT IN ('play', 'pause', 'seek', 'ended', 'heartbeat') THEN
    RAISE EXCEPTION 'Invalid event_type: %', p_event_type;
  END IF;

  INSERT INTO public.watch_events
    (student_id, video_id, event_type, position_sec, session_id, company_id, device_type)
  VALUES
    (v_student_id, p_video_id, p_event_type, p_position_sec, p_session_id, v_company_id, p_device_type);
END;
$$;

-- ─── アンケート回答記録 RPC ───
CREATE OR REPLACE FUNCTION public.record_survey_response(
  p_token UUID,
  p_question_id UUID,
  p_video_id UUID,
  p_selected_choice TEXT,
  p_session_id TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_student_id UUID;
  v_company_id UUID;
BEGIN
  SELECT id, company_id INTO v_student_id, v_company_id
  FROM public.students
  WHERE token = p_token
    AND token_expires_at > now();

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  INSERT INTO public.survey_responses
    (student_id, question_id, video_id, selected_choice, session_id, company_id)
  VALUES
    (v_student_id, p_question_id, p_video_id, p_selected_choice, p_session_id, v_company_id)
  ON CONFLICT (student_id, question_id) DO NOTHING;
END;
$$;

-- ─── 実行権限付与 ───
GRANT EXECUTE ON FUNCTION public.record_watch_event(UUID, UUID, TEXT, REAL, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.record_watch_event(UUID, UUID, TEXT, REAL, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_survey_response(UUID, UUID, UUID, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.record_survey_response(UUID, UUID, UUID, TEXT, TEXT) TO authenticated;

-- ─── 直接 INSERT ポリシーを削除（RPC 経由のみ許可） ───
-- これにより anon ユーザーが student_id を偽装して直接 INSERT することを防止
DROP POLICY IF EXISTS "watch_events_anon_insert" ON public.watch_events;
DROP POLICY IF EXISTS "responses_anon_insert" ON public.survey_responses;

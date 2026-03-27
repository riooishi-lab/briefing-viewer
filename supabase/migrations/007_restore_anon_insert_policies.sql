-- anon ユーザーの直接 INSERT ポリシーを復元
-- migration 006 で削除したが、RPC 未適用環境でのフォールバックとして必要
-- RPC が利用可能な場合はクライアント側で RPC を優先使用する

DROP POLICY IF EXISTS "watch_events_anon_insert" ON public.watch_events;
CREATE POLICY "watch_events_anon_insert" ON public.watch_events
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "responses_anon_insert" ON public.survey_responses;
CREATE POLICY "responses_anon_insert" ON public.survey_responses
  FOR INSERT TO anon WITH CHECK (true);

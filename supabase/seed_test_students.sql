-- テスト用架空学生10人を追加
-- 使用方法: Supabase SQL Editor で company_id を置換して実行
-- 既存の company_id は管理画面の admin_users テーブルから確認できます

DO $$
DECLARE
  v_company_id UUID;
BEGIN
  -- 最初の企業IDを取得（環境に合わせて変更可）
  SELECT id INTO v_company_id FROM public.companies LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'companies テーブルにデータがありません';
  END IF;

  INSERT INTO public.students (name, email, company_id) VALUES
    ('田中 太郎',   'tanaka.taro@example.com',     v_company_id),
    ('佐藤 花子',   'sato.hanako@example.com',     v_company_id),
    ('鈴木 一郎',   'suzuki.ichiro@example.com',   v_company_id),
    ('高橋 美咲',   'takahashi.misaki@example.com', v_company_id),
    ('伊藤 健太',   'ito.kenta@example.com',       v_company_id),
    ('渡辺 さくら', 'watanabe.sakura@example.com',  v_company_id),
    ('山本 大輔',   'yamamoto.daisuke@example.com', v_company_id),
    ('中村 優子',   'nakamura.yuko@example.com',   v_company_id),
    ('小林 翔太',   'kobayashi.shota@example.com', v_company_id),
    ('加藤 あおい', 'kato.aoi@example.com',        v_company_id)
  ON CONFLICT (email) DO NOTHING;
END;
$$;

-- device_type カラムが未追加の環境向けに再実行しても安全
ALTER TABLE watch_events ADD COLUMN IF NOT EXISTS device_type TEXT;

-- 既存ログを全て PC として復元
UPDATE watch_events SET device_type = 'PC' WHERE device_type IS NULL;

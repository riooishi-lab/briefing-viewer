-- watch_events に視聴端末種別を追加
ALTER TABLE watch_events ADD COLUMN IF NOT EXISTS device_type TEXT;

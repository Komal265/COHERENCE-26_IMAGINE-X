-- Auto follow-up: send another email 3h + 5–6 min jitter if lead doesn't respond
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS follow_up_after TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS auto_follow_up_sent_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.messages.follow_up_after IS 'When to send automatic follow-up (3h + 5–6 min jitter after first send)';
COMMENT ON COLUMN public.messages.auto_follow_up_sent_at IS 'When the automatic follow-up was sent';

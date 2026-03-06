-- Add inbox/reply fields to messages table
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_text TEXT,
  ADD COLUMN IF NOT EXISTS reply_tone TEXT CHECK (reply_tone IN ('positive', 'neutral', 'negative')),
  ADD COLUMN IF NOT EXISTS followup_message TEXT,
  ADD COLUMN IF NOT EXISTS reply_received_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS thread_id UUID,
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tone_confidence INTEGER;

-- Update status check to include 'replied' and 'followup_sent'
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_status_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_status_check
  CHECK (status IN ('pending', 'generated', 'sent', 'failed', 'replied', 'followup_sent'));

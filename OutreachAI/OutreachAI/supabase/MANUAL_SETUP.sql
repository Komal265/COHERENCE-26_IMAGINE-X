-- Run this in Supabase Dashboard → SQL Editor if migrations haven't been applied
-- Copy and paste the entire file, then click Run

-- 1. Base schema
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE IF NOT EXISTS public.workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Untitled Workflow',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read workflows" ON public.workflows;
CREATE POLICY "Anyone can read workflows" ON public.workflows FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert workflows" ON public.workflows;
CREATE POLICY "Anyone can insert workflows" ON public.workflows FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update workflows" ON public.workflows;
CREATE POLICY "Anyone can update workflows" ON public.workflows FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Anyone can delete workflows" ON public.workflows;
CREATE POLICY "Anyone can delete workflows" ON public.workflows FOR DELETE USING (true);

CREATE TABLE IF NOT EXISTS public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  industry TEXT,
  role TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'clustered', 'message_generated', 'waiting_delay', 'email_sent', 'replied')),
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read leads" ON public.leads;
CREATE POLICY "Anyone can read leads" ON public.leads FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert leads" ON public.leads;
CREATE POLICY "Anyone can insert leads" ON public.leads FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update leads" ON public.leads;
CREATE POLICY "Anyone can update leads" ON public.leads FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Anyone can delete leads" ON public.leads;
CREATE POLICY "Anyone can delete leads" ON public.leads FOR DELETE USING (true);

CREATE TABLE IF NOT EXISTS public.workflow_nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL,
  label TEXT NOT NULL,
  config JSONB DEFAULT '{}',
  position_x DOUBLE PRECISION NOT NULL DEFAULT 0,
  position_y DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.workflow_nodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read workflow_nodes" ON public.workflow_nodes;
CREATE POLICY "Anyone can read workflow_nodes" ON public.workflow_nodes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert workflow_nodes" ON public.workflow_nodes;
CREATE POLICY "Anyone can insert workflow_nodes" ON public.workflow_nodes FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update workflow_nodes" ON public.workflow_nodes;
CREATE POLICY "Anyone can update workflow_nodes" ON public.workflow_nodes FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Anyone can delete workflow_nodes" ON public.workflow_nodes;
CREATE POLICY "Anyone can delete workflow_nodes" ON public.workflow_nodes FOR DELETE USING (true);

CREATE TABLE IF NOT EXISTS public.workflow_edges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  source_node UUID NOT NULL REFERENCES public.workflow_nodes(id) ON DELETE CASCADE,
  target_node UUID NOT NULL REFERENCES public.workflow_nodes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.workflow_edges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read workflow_edges" ON public.workflow_edges;
CREATE POLICY "Anyone can read workflow_edges" ON public.workflow_edges FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert workflow_edges" ON public.workflow_edges;
CREATE POLICY "Anyone can insert workflow_edges" ON public.workflow_edges FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update workflow_edges" ON public.workflow_edges;
CREATE POLICY "Anyone can update workflow_edges" ON public.workflow_edges FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Anyone can delete workflow_edges" ON public.workflow_edges;
CREATE POLICY "Anyone can delete workflow_edges" ON public.workflow_edges FOR DELETE USING (true);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE SET NULL,
  generated_message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generated', 'sent', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read messages" ON public.messages;
CREATE POLICY "Anyone can read messages" ON public.messages FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert messages" ON public.messages;
CREATE POLICY "Anyone can insert messages" ON public.messages FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update messages" ON public.messages;
CREATE POLICY "Anyone can update messages" ON public.messages FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Anyone can delete messages" ON public.messages;
CREATE POLICY "Anyone can delete messages" ON public.messages FOR DELETE USING (true);

CREATE TABLE IF NOT EXISTS public.execution_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE SET NULL,
  node_id UUID REFERENCES public.workflow_nodes(id) ON DELETE SET NULL,
  node_type TEXT,
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed', 'failed', 'skipped')),
  details JSONB DEFAULT '{}',
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.execution_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read execution_logs" ON public.execution_logs;
CREATE POLICY "Anyone can read execution_logs" ON public.execution_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert execution_logs" ON public.execution_logs;
CREATE POLICY "Anyone can insert execution_logs" ON public.execution_logs FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update execution_logs" ON public.execution_logs;
CREATE POLICY "Anyone can update execution_logs" ON public.execution_logs FOR UPDATE USING (true);

-- 2. Inbox fields
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_text TEXT,
  ADD COLUMN IF NOT EXISTS reply_tone TEXT CHECK (reply_tone IN ('positive', 'neutral', 'negative')),
  ADD COLUMN IF NOT EXISTS followup_message TEXT,
  ADD COLUMN IF NOT EXISTS reply_received_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS thread_id UUID,
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tone_confidence INTEGER;

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_status_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_status_check
  CHECK (status IN ('pending', 'generated', 'sent', 'failed', 'replied', 'followup_sent'));

-- Triggers
DROP TRIGGER IF EXISTS update_workflows_updated_at ON public.workflows;
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_leads_updated_at ON public.leads;
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

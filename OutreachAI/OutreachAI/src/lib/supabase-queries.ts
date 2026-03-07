import { supabase } from "@/integrations/supabase/client";

// ============ LEADS ============
export async function fetchLeads(workflowId?: string) {
  let query = supabase.from("leads").select("*").order("created_at", { ascending: false });
  if (workflowId) query = query.eq("workflow_id", workflowId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function insertLeads(leads: Array<{ name: string; email: string; company?: string; industry?: string; role?: string; workflow_id?: string }>) {
  const { data, error } = await supabase.from("leads").insert(leads).select();
  if (error) throw error;
  return data;
}

export async function updateLeadStatus(leadId: string, status: string) {
  const { error } = await supabase.from("leads").update({ status }).eq("id", leadId);
  if (error) throw error;
}

export async function updateLeadWorkflow(leadId: string, workflowId: string) {
  const { error } = await supabase.from("leads").update({ workflow_id: workflowId }).eq("id", leadId);
  if (error) throw error;
}

// ============ WORKFLOWS ============
export async function fetchWorkflows() {
  const { data, error } = await supabase.from("workflows").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createWorkflow(name: string) {
  const { data, error } = await supabase.from("workflows").insert({ name }).select().single();
  if (error) throw error;
  return data;
}

export async function updateWorkflowStatus(id: string, status: string) {
  const { error } = await supabase.from("workflows").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteWorkflow(id: string) {
  const { error } = await supabase.from("workflows").delete().eq("id", id);
  if (error) throw error;
}

// ============ WORKFLOW NODES & EDGES ============
export async function fetchWorkflowNodes(workflowId: string) {
  const { data, error } = await supabase.from("workflow_nodes").select("*").eq("workflow_id", workflowId);
  if (error) throw error;
  return data;
}

export async function fetchWorkflowEdges(workflowId: string) {
  const { data, error } = await supabase.from("workflow_edges").select("*").eq("workflow_id", workflowId);
  if (error) throw error;
  return data;
}

export async function saveWorkflowNodes(workflowId: string, nodes: Array<{ id?: string; node_type: string; label: string; config: Record<string, any>; position_x: number; position_y: number }>) {
  // Delete existing nodes first
  await supabase.from("workflow_edges").delete().eq("workflow_id", workflowId);
  await supabase.from("workflow_nodes").delete().eq("workflow_id", workflowId);
  
  if (nodes.length === 0) return [];
  const insertData = nodes.map((n) => ({ ...n, workflow_id: workflowId, config: n.config as any }));
  const { data, error } = await supabase.from("workflow_nodes").insert(insertData as any).select();
  if (error) throw error;
  return data;
}

export async function saveWorkflowEdges(workflowId: string, edges: Array<{ source_node: string; target_node: string }>) {
  if (edges.length === 0) return [];
  const insertData = edges.map((e) => ({ ...e, workflow_id: workflowId }));
  const { data, error } = await supabase.from("workflow_edges").insert(insertData).select();
  if (error) throw error;
  return data;
}

// ============ MESSAGES ============
export async function fetchMessages(workflowId?: string) {
  let query = supabase.from("messages").select("*").order("created_at", { ascending: false });
  if (workflowId) query = query.eq("workflow_id", workflowId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createMessage(leadId: string, workflowId: string, generatedMessage: string, status = "generated") {
  const { data, error } = await supabase.from("messages").insert({ lead_id: leadId, workflow_id: workflowId, generated_message: generatedMessage, status }).select().single();
  if (error) throw error;
  return data;
}

export async function updateMessageStatus(id: string, status: string) {
  const { error } = await supabase.from("messages").update({ status }).eq("id", id);
  if (error) throw error;
}

/** 3 hours in ms; jitter 5–6 minutes in ms */
const FOLLOW_UP_DELAY_MS = 3 * 60 * 60 * 1000;
const JITTER_MIN_MS = 5 * 60 * 1000;
const JITTER_EXTRA_MS = 1 * 60 * 1000; // 5 + random(0,1) min

/** Call when first email is sent: sets status to 'sent' and schedule auto follow-up at now + 3h + 5–6 min jitter */
export async function updateMessageSentWithFollowUpSchedule(messageId: string) {
  const followUpAfter = new Date(Date.now() + FOLLOW_UP_DELAY_MS + JITTER_MIN_MS + Math.random() * JITTER_EXTRA_MS).toISOString();
  const { error } = await supabase
    .from("messages")
    .update({ status: "sent", follow_up_after: followUpAfter } as any)
    .eq("id", messageId);
  if (error) throw error;
}

/** Messages with no reply that are past follow_up_after and not yet sent auto follow-up */
export async function fetchMessagesEligibleForAutoFollowUp() {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("messages")
    .select(`
      id,
      lead_id,
      generated_message,
      follow_up_after,
      leads (id, name, email, company)
    `)
    .eq("status", "sent")
    .is("reply_text", null)
    .not("follow_up_after", "is", null)
    .lte("follow_up_after", now)
    .is("auto_follow_up_sent_at", null);
  if (error) throw error;
  return data || [];
}

/** Mark that the automatic follow-up was sent (so we don't send again) */
export async function markAutoFollowUpSent(messageId: string, followupMessage: string) {
  const { error } = await supabase
    .from("messages")
    .update({
      status: "followup_sent",
      followup_message: followupMessage,
      auto_follow_up_sent_at: new Date().toISOString(),
    } as any)
    .eq("id", messageId);
  if (error) throw error;
}

export async function fetchLatestMessageForLead(leadId: string, workflowId: string) {
  const { data, error } = await supabase
    .from("messages")
    .select("id")
    .eq("lead_id", leadId)
    .eq("workflow_id", workflowId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchMessageById(messageId: string) {
  const { data, error } = await supabase.from("messages").select("id, generated_message").eq("id", messageId).single();
  if (error) throw error;
  return data;
}

// ============ INBOX / REPLIES ============
export async function fetchInboxMessages(filter?: "all" | "positive" | "neutral" | "negative" | "unread") {
  const { data, error } = await supabase
    .from("messages")
    .select(`
      *,
      leads (id, name, email, company, role, industry)
    `)
    .order("created_at", { ascending: false });
  if (error) throw error;
  let filtered = (data || []).filter((m: any) => m.reply_text != null);
  if (filter === "positive" || filter === "neutral" || filter === "negative") {
    filtered = filtered.filter((m: any) => m.reply_tone === filter);
  }
  if (filter === "unread") {
    filtered = filtered.filter((m: any) => !m.is_read);
  }
  return filtered.sort((a: any, b: any) =>
    new Date(b.reply_received_at || b.created_at).getTime() - new Date(a.reply_received_at || a.created_at).getTime()
  );
}

/** Fetch all sent emails for Inbox (status sent, replied, or followup_sent) with leads */
export async function fetchInboxSentMessages() {
  const { data, error } = await supabase
    .from("messages")
    .select(`
      *,
      leads (id, name, email, company, role, industry)
    `)
    .in("status", ["sent", "replied", "followup_sent"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Fetch messages that are sent, have no reply yet, and have a scheduled auto follow-up (for Inbox countdown) */
export async function fetchPendingFollowUpMessages() {
  const { data, error } = await supabase
    .from("messages")
    .select(`
      id,
      lead_id,
      follow_up_after,
      created_at,
      leads (id, name, email, company)
    `)
    .eq("status", "sent")
    .is("reply_text", null)
    .not("follow_up_after", "is", null)
    .is("auto_follow_up_sent_at", null)
    .order("follow_up_after", { ascending: true });
  if (error) throw error;
  return data || [];
}

/** Fetch only messages that have a reply (for Inbox — replies only) */
export async function fetchMessagesWithReplies() {
  const { data, error } = await supabase
    .from("messages")
    .select(`
      *,
      leads (id, name, email, company, role, industry)
    `)
    .not("reply_text", "is", null)
    .order("reply_received_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addReplyToMessage(
  messageId: string,
  replyText: string,
  replyTone?: string,
  followupMessage?: string
) {
  const { data, error } = await supabase
    .from("messages")
    .update({
      reply_text: replyText,
      reply_tone: replyTone || null,
      followup_message: followupMessage || null,
      reply_received_at: new Date().toISOString(),
      status: "replied",
      is_read: false,
    } as any)
    .eq("id", messageId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMessageReply(
  messageId: string,
  updates: { reply_tone?: string; followup_message?: string; tone_confidence?: number }
) {
  const { data, error } = await supabase
    .from("messages")
    .update(updates as any)
    .eq("id", messageId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markMessageRead(messageId: string) {
  const { error } = await supabase.from("messages").update({ is_read: true } as any).eq("id", messageId);
  if (error) throw error;
}

export async function updateMessageFollowupSent(messageId: string) {
  const { error } = await supabase.from("messages").update({ status: "followup_sent" } as any).eq("id", messageId);
  if (error) throw error;
}

export async function fetchInboxStats() {
  const { data } = await supabase.from("messages").select("reply_tone, is_read").not("reply_text", "is", null);
  const stats = {
    total: data?.length ?? 0,
    positive: data?.filter((m) => m.reply_tone === "positive").length ?? 0,
    neutral: data?.filter((m) => m.reply_tone === "neutral").length ?? 0,
    negative: data?.filter((m) => m.reply_tone === "negative").length ?? 0,
    unread: data?.filter((m) => !m.is_read).length ?? 0,
  };
  return stats;
}

// ============ EXECUTION LOGS ============
export async function createExecutionLog(log: { lead_id?: string; workflow_id?: string; node_id?: string; node_type?: string; status: string; details?: Record<string, any> }) {
  const { data, error } = await supabase.from("execution_logs").insert(log as any).select().single();
  if (error) throw error;
  return data;
}

export async function fetchExecutionLogs(workflowId?: string) {
  let query = supabase.from("execution_logs").select("*").order("executed_at", { ascending: false }).limit(100);
  if (workflowId) query = query.eq("workflow_id", workflowId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ============ DASHBOARD STATS ============
export async function fetchDashboardStats() {
  const [leadsRes, msgsRes, sentRes, repliedRes] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }),
    supabase.from("messages").select("id", { count: "exact", head: true }),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("status", "sent"),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "replied"),
  ]);

  const totalLeads = leadsRes.count ?? 0;
  const totalMessages = msgsRes.count ?? 0;
  const sentMessages = sentRes.count ?? 0;
  const repliedLeads = repliedRes.count ?? 0;
  const conversionRate = totalLeads > 0 ? ((repliedLeads / totalLeads) * 100).toFixed(1) : "0.0";

  let repliesReceived = 0;
  let followupsSent = 0;
  try {
    const [repliesRes, followupsRes] = await Promise.all([
      supabase.from("messages").select("id", { count: "exact", head: true }).not("reply_text", "is", null),
      supabase.from("messages").select("id", { count: "exact", head: true }).eq("status", "followup_sent"),
    ]);
    repliesReceived = repliesRes.count ?? 0;
    followupsSent = followupsRes.count ?? 0;
  } catch {
    // Inbox columns may not exist yet
  }

  return {
    totalLeads,
    totalMessages,
    sentMessages,
    repliedLeads,
    conversionRate,
    repliesReceived,
    followupsSent,
  };
}

export async function fetchLeadStatusCounts() {
  const { data, error } = await supabase.from("leads").select("status");
  if (error) throw error;
  
  const counts: Record<string, number> = {};
  data.forEach((l) => {
    counts[l.status] = (counts[l.status] || 0) + 1;
  });
  return counts;
}

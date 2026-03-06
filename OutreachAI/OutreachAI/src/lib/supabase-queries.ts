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

export async function fetchMessagesWithReplies() {
  const { data, error } = await supabase
    .from("messages")
    .select(`
      *,
      leads (id, name, email, company, role, industry)
    `)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).filter((m: any) => m.reply_text != null);
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

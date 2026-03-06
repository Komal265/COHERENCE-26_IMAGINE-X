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

  return { totalLeads, totalMessages, sentMessages, repliedLeads, conversionRate };
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

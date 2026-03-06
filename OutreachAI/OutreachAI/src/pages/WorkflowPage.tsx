import { useState, useCallback, useRef, useEffect } from "react";
import {
  ReactFlow, Background, Controls, MiniMap, addEdge,
  useNodesState, useEdgesState,
  type Connection, type Node, type Edge, type NodeTypes,
  Panel, MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";
import {
  Upload, Brain, Mail, Linkedin, Clock, GitBranch, Filter, Split,
  Shield, Gauge, CheckSquare, FileText, RefreshCw, Send,
  Play, GripVertical, Zap, Save, Sparkles, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import WorkflowNode from "@/components/workflow/WorkflowNode";
import {
  fetchWorkflowNodes, fetchWorkflowEdges,
  saveWorkflowNodes, saveWorkflowEdges,
  createWorkflow, fetchLeads, createExecutionLog,
  updateLeadStatus, createMessage,
} from "@/lib/supabase-queries";
import { supabase } from "@/integrations/supabase/client";

const nodeCategories = [
  {
    label: "Trigger",
    nodes: [
      { type: "trigger", label: "Lead Upload", icon: Upload, iconName: "Upload", desc: "Start when leads imported" },
      { type: "trigger", label: "New Lead Added", icon: Zap, iconName: "Zap", desc: "Trigger on new lead" },
    ],
  },
  {
    label: "Action",
    nodes: [
      { type: "action", label: "AI Generate Message", icon: Brain, iconName: "Brain", desc: "Generate personalized outreach" },
      { type: "action", label: "Send Email", icon: Mail, iconName: "Mail", desc: "Send via email" },
      { type: "action", label: "Send LinkedIn", icon: Linkedin, iconName: "Linkedin", desc: "Send LinkedIn message" },
      { type: "action", label: "Wait Delay", icon: Clock, iconName: "Clock", desc: "Human-like delay" },
    ],
  },
  {
    label: "Logic",
    nodes: [
      { type: "logic", label: "Condition", icon: GitBranch, iconName: "GitBranch", desc: "Branch by condition" },
      { type: "logic", label: "Lead Filter", icon: Filter, iconName: "Filter", desc: "Filter leads" },
      { type: "logic", label: "A/B Split", icon: Split, iconName: "Split", desc: "Split test messages" },
    ],
  },
  {
    label: "Control",
    nodes: [
      { type: "control", label: "Throttling Guard", icon: Shield, iconName: "Shield", desc: "Rate limit protection" },
      { type: "control", label: "Rate Limit", icon: Gauge, iconName: "Gauge", desc: "Max sends per hour" },
      { type: "control", label: "Compliance Check", icon: CheckSquare, iconName: "CheckSquare", desc: "Verify compliance" },
    ],
  },
  {
    label: "Output",
    nodes: [
      { type: "output", label: "Log Event", icon: FileText, iconName: "FileText", desc: "Log activity" },
      { type: "output", label: "Update Status", icon: RefreshCw, iconName: "RefreshCw", desc: "Update lead status" },
      { type: "output", label: "Send to CRM", icon: Send, iconName: "Send", desc: "Push to CRM" },
    ],
  },
];

const categoryColors: Record<string, string> = {
  trigger: "border-primary bg-primary/5 dark:bg-primary/20",
  action: "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/40",
  logic: "border-violet-400 bg-violet-50 dark:border-violet-500 dark:bg-violet-900/40",
  control: "border-warning bg-warning/5 dark:bg-amber-900/40 dark:border-amber-500",
  output: "border-success bg-success/5 dark:bg-emerald-900/40 dark:border-emerald-500",
};

const categoryIconColors: Record<string, string> = {
  trigger: "text-primary",
  action: "text-blue-600 dark:text-blue-400",
  logic: "text-violet-600 dark:text-violet-400",
  control: "text-amber-600 dark:text-amber-400",
  output: "text-emerald-600 dark:text-emerald-400",
};

const edgeStyle = { stroke: "hsl(29, 100%, 50%)", strokeWidth: 2 };
const edgeMarker = { type: MarkerType.ArrowClosed as const, color: "hsl(29, 100%, 50%)" };

const nodeTypes: NodeTypes = { workflowNode: WorkflowNode };

const labelToIcon: Record<string, string> = {
  "Lead Upload": "Upload", "New Lead Added": "Zap",
  "AI Generate Message": "Brain", "Send Email": "Mail", "Send LinkedIn": "Linkedin", "Wait Delay": "Clock",
  "Condition": "GitBranch", "Lead Filter": "Filter", "A/B Split": "Split",
  "Throttling Guard": "Shield", "Rate Limit": "Gauge", "Compliance Check": "CheckSquare",
  "Log Event": "FileText", "Update Status": "RefreshCw", "Send to CRM": "Send",
};

export default function WorkflowPage() {
  const { resolvedTheme } = useTheme();
  const [searchParams] = useSearchParams();
  const workflowId = searchParams.get("id");
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGeneratingWorkflow, setIsGeneratingWorkflow] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const nodeIdCounter = useRef(1);
  const nodeIdMap = useRef<Map<string, string>>(new Map()); // DB id -> flow id

  // Load workflow from DB
  useEffect(() => {
    if (!workflowId) return;
    const load = async () => {
      try {
        const [dbNodes, dbEdges] = await Promise.all([
          fetchWorkflowNodes(workflowId),
          fetchWorkflowEdges(workflowId),
        ]);
        
        const flowNodes: Node[] = dbNodes.map((n) => {
          const flowId = String(nodeIdCounter.current++);
          nodeIdMap.current.set(n.id, flowId);
          return {
            id: flowId,
            type: "workflowNode",
            position: { x: n.position_x, y: n.position_y },
            data: {
              label: n.label,
              icon: (n.config as any)?.icon || "Zap",
              category: n.node_type,
              desc: (n.config as any)?.desc || "",
              dbId: n.id,
            },
          };
        });

        const flowEdges: Edge[] = dbEdges.map((e) => ({
          id: `e-${e.id}`,
          source: nodeIdMap.current.get(e.source_node) || "",
          target: nodeIdMap.current.get(e.target_node) || "",
          animated: true,
          style: edgeStyle,
          markerEnd: edgeMarker,
        })).filter((e) => e.source && e.target);

        setNodes(flowNodes);
        setEdges(flowEdges);
      } catch {
        toast.error("Failed to load workflow");
      }
    };
    load();
  }, [workflowId, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) => addEdge({ ...params, animated: true, style: edgeStyle, markerEnd: edgeMarker }, eds)),
    [setEdges]
  );

  const onDragStart = (event: React.DragEvent, nodeData: any) => {
    event.dataTransfer.setData("application/reactflow", JSON.stringify(nodeData));
    event.dataTransfer.effectAllowed = "move";
  };

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const data = JSON.parse(event.dataTransfer.getData("application/reactflow"));
      const position = { x: event.clientX - 300, y: event.clientY - 100 };
      const newNode: Node = {
        id: String(nodeIdCounter.current++),
        type: "workflowNode",
        position,
        data: { label: data.label, icon: data.iconName, category: data.type, desc: data.desc },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // Save workflow to DB
  const saveWorkflow = async () => {
    let wfId = workflowId;
    setSaving(true);
    try {
      if (!wfId) {
        const wf = await createWorkflow("Untitled Workflow");
        wfId = wf.id;
        window.history.replaceState(null, "", `/workflow?id=${wfId}`);
      }

      const dbNodes = nodes.map((n) => ({
        node_type: (n.data.category as string) || "action",
        label: (n.data.label as string) || "Node",
        config: { icon: n.data.icon, desc: n.data.desc },
        position_x: n.position.x,
        position_y: n.position.y,
      }));

      const savedNodes = await saveWorkflowNodes(wfId, dbNodes);

      // Build mapping from flow node index to DB node id
      const flowToDb = new Map<string, string>();
      nodes.forEach((n, i) => {
        if (savedNodes[i]) flowToDb.set(n.id, savedNodes[i].id);
      });

      const dbEdges = edges
        .map((e) => ({
          source_node: flowToDb.get(e.source) || "",
          target_node: flowToDb.get(e.target) || "",
        }))
        .filter((e) => e.source_node && e.target_node);

      await saveWorkflowEdges(wfId, dbEdges);
      toast.success("Workflow saved!");
    } catch (err: any) {
      toast.error("Save failed: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  // Run workflow execution
  const runWorkflow = async () => {
    if (!workflowId) {
      toast.error("Save the workflow first");
      return;
    }
    setIsRunning(true);
    try {
      const leads = await fetchLeads(workflowId);
      if (leads.length === 0) {
        // Try all leads without workflow assignment
        const allLeads = await fetchLeads();
        if (allLeads.length === 0) {
          toast.error("No leads found. Import leads first.");
          setIsRunning(false);
          return;
        }
        // Use all uploaded leads
        leads.push(...allLeads.filter((l) => l.status === "uploaded"));
      }

      const nodeIds = nodes.map((n) => n.id);

      for (let li = 0; li < Math.min(leads.length, 10); li++) {
        const lead = leads[li];
        for (let ni = 0; ni < nodeIds.length; ni++) {
          // Highlight active node
          setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, isActive: n.id === nodeIds[ni] } })));

          const nodeData = nodes[ni]?.data;
          const nodeLabel = (nodeData?.label as string) || "";

          await createExecutionLog({
            lead_id: lead.id,
            workflow_id: workflowId,
            node_type: nodeLabel,
            status: "started",
          });

          // Process based on node type
          if (nodeLabel.includes("AI")) {
            await updateLeadStatus(lead.id, "message_generated");
            // Call AI edge function if available
            try {
              const { data: aiData } = await supabase.functions.invoke("generate-message", {
                body: { lead: { name: lead.name, company: lead.company, industry: lead.industry, role: lead.role } },
              });
              if (aiData?.message) {
                await createMessage(lead.id, workflowId, aiData.message, "generated");
              }
            } catch {
              // AI not set up yet, create placeholder
              await createMessage(lead.id, workflowId, `Hi ${lead.name}, I'd love to connect about opportunities at ${lead.company || "your company"}.`, "generated");
            }
          } else if (nodeLabel.includes("Wait") || nodeLabel.includes("Delay")) {
            await updateLeadStatus(lead.id, "waiting_delay");
            await new Promise((r) => setTimeout(r, 2000)); // 2s simulated delay
          } else if (nodeLabel.includes("Email")) {
            await updateLeadStatus(lead.id, "email_sent");
          } else if (nodeLabel.includes("Update")) {
            // Already updated above
          }

          await createExecutionLog({
            lead_id: lead.id,
            workflow_id: workflowId,
            node_type: nodeLabel,
            status: "completed",
          });

          await new Promise((r) => setTimeout(r, 800));
        }
      }

      setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, isActive: false } })));
      toast.success("Workflow execution complete!");
    } catch (err: any) {
      toast.error("Execution failed: " + (err.message || "Unknown error"));
    } finally {
      setIsRunning(false);
    }
  };

  const generateWorkflowFromPrompt = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Enter a prompt to generate a workflow");
      return;
    }
    setIsGeneratingWorkflow(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-workflow", {
        body: { prompt: aiPrompt.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const { nodes: aiNodes, edges: aiEdges } = data as {
        nodes: Array<{ label: string; type: string; icon?: string; desc: string }>;
        edges: Array<[number, number]>;
      };

      if (!aiNodes?.length) {
        toast.error("AI returned no nodes. Try a different prompt.");
        return;
      }

      const NODE_WIDTH = 220;
      const NODE_HEIGHT = 80;
      const flowNodes: Node[] = aiNodes.map((n, i) => ({
        id: String(nodeIdCounter.current++),
        type: "workflowNode",
        position: { x: i * (NODE_WIDTH + 60), y: 100 },
        data: {
          label: n.label,
          icon: n.icon || labelToIcon[n.label] || "Zap",
          category: n.type,
          desc: n.desc || "",
        },
      }));

      const flowEdges: Edge[] = (aiEdges || []).map(([src, tgt]) => ({
        id: `e-${src}-${tgt}`,
        source: flowNodes[src]?.id || "",
        target: flowNodes[tgt]?.id || "",
        animated: true,
        style: edgeStyle,
        markerEnd: edgeMarker,
      })).filter((e) => e.source && e.target);

      setNodes(flowNodes);
      setEdges(flowEdges);
      setAiPrompt("");
      setShowAiPanel(false);
      toast.success("Workflow generated! Save to persist.");
    } catch (err: any) {
      toast.error("Generation failed: " + (err.message || "Unknown error"));
    } finally {
      setIsGeneratingWorkflow(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Left Sidebar */}
      <div className="w-64 border-r border-border bg-card overflow-y-auto p-3 shrink-0">
        <Collapsible open={showAiPanel} onOpenChange={setShowAiPanel}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full mb-3 rounded-xl justify-start gap-2 bg-primary/5 border-primary/30 hover:bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
              Generate with AI
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-2 mb-3 p-2 rounded-lg bg-muted/50">
              <Textarea
                placeholder="e.g. Send personalized emails to new leads with a 2 min delay between each"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="min-h-[72px] text-xs resize-none"
                disabled={isGeneratingWorkflow}
              />
              <Button
                size="sm"
                className="w-full rounded-lg"
                onClick={generateWorkflowFromPrompt}
                disabled={isGeneratingWorkflow}
              >
                {isGeneratingWorkflow ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="h-3 w-3 mr-1.5" />
                    Generate
                  </>
                )}
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
        <h2 className="text-sm font-display font-semibold text-foreground mb-3 px-1">Node Library</h2>
        {nodeCategories.map((cat) => (
          <div key={cat.label} className="mb-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 px-1">{cat.label}</p>
            {cat.nodes.map((node) => (
              <div
                key={node.label}
                draggable
                onDragStart={(e) => onDragStart(e, node)}
                className={`flex items-center gap-2.5 p-2 rounded-lg border mb-1.5 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow ${categoryColors[node.type]}`}
              >
                <GripVertical className="h-3 w-3 text-muted-foreground shrink-0 dark:text-muted-foreground/80" />
                <node.icon className={`h-4 w-4 shrink-0 ${categoryIconColors[node.type] || "text-foreground"}`} />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{node.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{node.desc}</p>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Canvas */}
      <div className="flex-1 relative" onDrop={onDrop} onDragOver={onDragOver}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="bg-background"
        >
          <Background
            color={resolvedTheme === "dark" ? "hsl(20, 12%, 18%)" : "hsl(30, 20%, 85%)"}
            gap={20}
            size={1}
          />
          <Controls />
          <MiniMap nodeStrokeColor="hsl(29, 100%, 50%)" nodeColor="hsl(29, 100%, 90%)" nodeBorderRadius={8} />
          <Panel position="top-right">
            <div className="flex gap-2">
              <Button onClick={saveWorkflow} disabled={saving} variant="outline" className="rounded-xl shadow-lg" size="lg">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button onClick={runWorkflow} disabled={isRunning} className="rounded-xl shadow-lg glow-orange" size="lg">
                <Play className="h-4 w-4 mr-2" />
                {isRunning ? "Running..." : "Run Workflow"}
              </Button>
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}

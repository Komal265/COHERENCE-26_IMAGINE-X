import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Copy, Trash2, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { fetchWorkflows, createWorkflow, updateWorkflowStatus, deleteWorkflow } from "@/lib/supabase-queries";
import { supabase } from "@/integrations/supabase/client";

const statusStyles: Record<string, string> = {
  active: "bg-success/10 text-success",
  paused: "bg-warning/10 text-warning",
  draft: "bg-muted text-muted-foreground",
};

interface WorkflowRow {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

export default function AutomationPage() {
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const data = await fetchWorkflows();
      setWorkflows(data as WorkflowRow[]);
    } catch {
      toast.error("Failed to load workflows");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    try {
      const wf = await createWorkflow("New Workflow");
      toast.success("Workflow created");
      navigate(`/workflow?id=${wf.id}`);
    } catch {
      toast.error("Failed to create workflow");
    }
  };

  const handleToggleStatus = async (wf: WorkflowRow) => {
    const newStatus = wf.status === "active" ? "paused" : "active";
    try {
      await updateWorkflowStatus(wf.id, newStatus);
      toast.success(`Workflow ${newStatus}`);
      load();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWorkflow(id);
      toast.success("Workflow deleted");
      load();
    } catch {
      toast.error("Failed to delete workflow");
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Automations</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your outreach workflows</p>
        </div>
        <Button className="rounded-xl" onClick={handleCreate}>
          <Zap className="h-4 w-4 mr-2" /> New Workflow
        </Button>
      </div>

      {workflows.length === 0 && !loading && (
        <Card className="rounded-xl">
          <CardContent className="p-12 text-center text-muted-foreground">
            No workflows yet. Create one to get started.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {workflows.map((wf, i) => (
          <motion.div key={wf.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="rounded-xl cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/workflow?id=${wf.id}`)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{wf.name}</p>
                      <p className="text-xs text-muted-foreground">Created {new Date(wf.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge className={`border-0 rounded-md ${statusStyles[wf.status] || statusStyles.draft}`}>{wf.status}</Badge>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleToggleStatus(wf)}>
                        {wf.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive" onClick={() => handleDelete(wf.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

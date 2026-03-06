import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, MessageSquare, Send, Reply, TrendingUp, Activity, Layers, AlertTriangle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchDashboardStats, fetchLeadStatusCounts, fetchExecutionLogs } from "@/lib/supabase-queries";

const funnelStages = [
  { key: "uploaded", label: "Leads Uploaded", fill: "hsl(29, 100%, 50%)" },
  { key: "clustered", label: "Clustered", fill: "hsl(29, 100%, 58%)" },
  { key: "message_generated", label: "Messages Generated", fill: "hsl(29, 100%, 65%)" },
  { key: "email_sent", label: "Emails Sent", fill: "hsl(29, 100%, 72%)" },
  { key: "replied", label: "Replies", fill: "hsl(29, 100%, 80%)" },
];

export default function DashboardPage() {
  const [stats, setStats] = useState({ totalLeads: 0, totalMessages: 0, sentMessages: 0, repliedLeads: 0, conversionRate: "0.0" });
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [failedCount, setFailedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, sc, logs] = await Promise.all([
          fetchDashboardStats(),
          fetchLeadStatusCounts(),
          fetchExecutionLogs(),
        ]);
        setStats(s);
        setStatusCounts(sc);
        setFailedCount(logs.filter((l) => l.status === "failed").length);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const statCards = [
    { label: "Leads Imported", value: stats.totalLeads, icon: Users, color: "text-primary" },
    { label: "Messages Generated", value: stats.totalMessages, icon: MessageSquare, color: "text-blue-500" },
    { label: "Messages Sent", value: stats.sentMessages, icon: Send, color: "text-violet-500" },
    { label: "Replies Received", value: stats.repliedLeads, icon: Reply, color: "text-success" },
    { label: "Conversion Rate", value: `${stats.conversionRate}%`, icon: TrendingUp, color: "text-primary" },
  ];

  const maxFunnel = Math.max(
    ...funnelStages.map((s) => statusCounts[s.key] || 0),
    // Count leads at or past each stage
    1
  );

  // Cumulative count: leads at this stage or later
  const getCumulativeCount = (stageKey: string) => {
    const stageOrder = funnelStages.map((s) => s.key);
    const idx = stageOrder.indexOf(stageKey);
    let count = 0;
    for (let i = idx; i < stageOrder.length; i++) {
      count += statusCounts[stageOrder[i]] || 0;
    }
    return count;
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {loading ? "Loading metrics..." : "Outreach performance overview"}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {statCards.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <p className="text-2xl font-display font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Funnel */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg font-display">Lead Progression Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {funnelStages.map((stage, i) => {
                  const count = getCumulativeCount(stage.key);
                  const total = stats.totalLeads || 1;
                  return (
                    <div key={stage.key} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-36 shrink-0 truncate">{stage.label}</span>
                      <div className="flex-1 h-7 bg-muted rounded-lg overflow-hidden">
                        <motion.div
                          className="h-full rounded-lg"
                          style={{ backgroundColor: stage.fill }}
                          initial={{ width: 0 }}
                          animate={{ width: `${(count / total) * 100}%` }}
                          transition={{ delay: 0.4 + i * 0.1, duration: 0.6 }}
                        />
                      </div>
                      <span className="text-sm font-medium w-12 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* System Health */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg font-display">System Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/50">
                  <Activity className="h-4 w-4 text-success" />
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge className="bg-success/10 text-success border-0 text-xs mt-0.5">Online</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/50">
                  <Layers className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Leads</p>
                    <p className="text-sm font-semibold">{stats.totalLeads}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/50">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <div>
                    <p className="text-xs text-muted-foreground">Pending</p>
                    <p className="text-sm font-semibold">{statusCounts.uploaded || 0}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/50">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <div>
                    <p className="text-xs text-muted-foreground">Failed</p>
                    <p className="text-sm font-semibold">{failedCount}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

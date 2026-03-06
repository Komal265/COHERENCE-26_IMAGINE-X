import { motion } from "framer-motion";
import { Mail, CheckCircle, Eye, Clock } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface MessageDetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: {
    id: string;
    name: string;
    email: string;
    company?: string | null;
    industry?: string | null;
    role?: string | null;
    status?: string;
  } | null;
  message?: string;
  /** Event timestamps - simulated for demo */
  events?: {
    sent?: string;
    delivered?: string;
    opened?: string;
  };
  /** Risk score 0-100 for this lead's interaction history */
  riskScore?: number;
}

const steps = [
  { key: "sent", label: "Sent", icon: Mail },
  { key: "delivered", label: "Delivered", icon: CheckCircle },
  { key: "opened", label: "Opened", icon: Eye },
];

export function MessageDetailPanel({
  open,
  onOpenChange,
  lead,
  message = "",
  events = {
    sent: "2:34 PM",
    delivered: "2:35 PM",
    opened: "3:12 PM",
  },
  riskScore = 24,
}: MessageDetailPanelProps) {
  if (!lead) return null;

  const getStepStatus = (key: string) => {
    if (key === "sent") return "complete";
    if (key === "delivered") return events.delivered ? "complete" : "pending";
    if (key === "opened") return events.opened ? "complete" : "pending";
    return "pending";
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="glass-modal backdrop-blur-xl border-white/20 bg-white/10 dark:bg-slate-900/40 w-full sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                {lead.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-display">{lead.name}</p>
              <p className="text-xs font-normal text-muted-foreground">{lead.company || lead.email}</p>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Event Stepper */}
          <div className="glass-card rounded-xl p-4 border-white/20">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Event Timeline</p>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-white/20" />
              {steps.map((step, i) => {
                const status = getStepStatus(step.key);
                const Icon = step.icon;
                const timestamp = events[step.key as keyof typeof events];
                return (
                  <motion.div
                    key={step.key}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="relative flex items-center gap-4 pb-4 last:pb-0"
                  >
                    <div
                      className={cn(
                        "relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2",
                        status === "complete"
                          ? "border-primary bg-primary/20"
                          : "border-white/20 bg-white/5"
                      )}
                    >
                      <Icon className={cn("h-4 w-4", status === "complete" ? "text-primary" : "text-muted-foreground")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium", status === "complete" ? "text-foreground" : "text-muted-foreground")}>
                        {step.label}
                      </p>
                      {timestamp && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timestamp}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Message Preview */}
          <div className="glass-card rounded-xl p-4 border-white/20">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Message Preview</p>
            <div className="rounded-lg border border-white/10 bg-black/10 dark:bg-white/5 p-3 text-sm text-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
              {message || "No message content available."}
            </div>
          </div>

          {/* Risk Gauge */}
          <div className="glass-card rounded-xl p-4 border-white/20">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Interaction Risk</p>
            <div className="flex items-center gap-4">
              <div className="relative w-24 h-24 rounded-full border-2 border-white/20 p-1">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-muted/30"
                  />
                  <motion.path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    className={cn(
                      riskScore <= 30 ? "text-success" : riskScore <= 60 ? "text-warning" : "text-destructive"
                    )}
                    strokeDasharray={`${riskScore}, 100`}
                    initial={{ strokeDasharray: "0, 100" }}
                    animate={{ strokeDasharray: `${riskScore}, 100` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold">{riskScore}</span>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">
                  {riskScore <= 30 && "Low risk — standard outreach pattern"}
                  {riskScore > 30 && riskScore <= 60 && "Moderate — consider throttling"}
                  {riskScore > 60 && "High — review before next touch"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

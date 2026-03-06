import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import {
  Upload, Brain, Mail, Linkedin, Clock, GitBranch, Filter, Split,
  Shield, Gauge, CheckSquare, FileText, RefreshCw, Send, Zap,
  MessageSquare, BarChart3, Reply,
} from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  Upload, Brain, Mail, Linkedin, Clock, GitBranch, Filter, Split,
  Shield, Gauge, CheckSquare, FileText, RefreshCw, Send, Zap,
  MessageSquare, BarChart3, Reply,
};

const categoryBorders: Record<string, string> = {
  trigger: "border-primary",
  action: "border-blue-400 dark:border-blue-500",
  logic: "border-violet-400 dark:border-violet-500",
  control: "border-amber-400 dark:border-amber-500",
  output: "border-emerald-400 dark:border-emerald-500",
};

const categoryBgs: Record<string, string> = {
  trigger: "bg-primary/10",
  action: "bg-blue-100 dark:bg-blue-900/50",
  logic: "bg-violet-100 dark:bg-violet-900/50",
  control: "bg-amber-100 dark:bg-amber-900/50",
  output: "bg-emerald-100 dark:bg-emerald-900/50",
};

const categoryIconColors: Record<string, string> = {
  trigger: "text-primary",
  action: "text-blue-600 dark:text-blue-400",
  logic: "text-violet-600 dark:text-violet-400",
  control: "text-amber-600 dark:text-amber-400",
  output: "text-emerald-600 dark:text-emerald-400",
};

function WorkflowNode({ data }: NodeProps) {
  const Icon = iconMap[data.icon as string] || Zap;
  const category = (data.category as string) || "trigger";
  const isActive = data.isActive as boolean;

  return (
    <motion.div
      animate={isActive ? { scale: [1, 1.05, 1], boxShadow: ["0 0 0px hsl(29,100%,50%)", "0 0 24px hsl(29,100%,50%)", "0 0 0px hsl(29,100%,50%)"] } : {}}
      transition={{ duration: 0.8, repeat: isActive ? Infinity : 0 }}
      className={`relative rounded-xl border-2 bg-card shadow-md px-4 py-3 min-w-[180px] ${categoryBorders[category]} ${isActive ? "ring-2 ring-primary/40" : ""}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-primary !border-primary-foreground !w-2.5 !h-2.5" />
      <Handle type="source" position={Position.Right} className="!bg-primary !border-primary-foreground !w-2.5 !h-2.5" />
      
      <div className="flex items-center gap-2.5">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${categoryBgs[category]}`}>
          <Icon className={`h-4 w-4 ${categoryIconColors[category] || "text-foreground"}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{data.label as string}</p>
          <p className="text-[10px] text-muted-foreground truncate">{data.desc as string}</p>
        </div>
      </div>

      {/* Typing animation for AI node */}
      {isActive && (data.label as string).includes("AI") && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-2 pt-2 border-t border-border"
        >
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-primary"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
            <span className="text-[10px] text-muted-foreground ml-1">Generating...</span>
          </div>
        </motion.div>
      )}

      {/* Countdown for Wait node */}
      {isActive && (data.label as string).includes("Wait") && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-2 pt-2 border-t border-border"
        >
          <p className="text-[10px] text-muted-foreground">Delay: 3m – 7m</p>
          <div className="h-1 bg-muted rounded-full mt-1 overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 3, ease: "linear" }}
            />
          </div>
        </motion.div>
      )}

      {/* Warning for safety nodes */}
      {category === "control" && (
        <div className="mt-2 pt-2 border-t border-border">
          <p className="text-[10px] text-muted-foreground">Max 20/hr · 150/day</p>
        </div>
      )}
    </motion.div>
  );
}

export default memo(WorkflowNode);

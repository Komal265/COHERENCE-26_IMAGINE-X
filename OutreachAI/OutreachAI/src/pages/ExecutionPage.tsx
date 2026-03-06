import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Mail, User, AlertCircle, Send, Mailbox, FileText,
  Sparkles, Database, ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { fetchLeads } from "@/lib/supabase-queries";

interface Lead {
  id: string;
  name: string;
  email: string;
  company: string | null;
  industry: string | null;
  role: string | null;
  status: string;
}

// Flowing connection line
function FlowingLine({ active = false }: { active?: boolean }) {
  return (
    <div className="relative w-10 h-0.5 flex items-center shrink-0">
      <div className="absolute inset-0 h-0.5 bg-muted-foreground/20 rounded-full" />
      <motion.div
        className="absolute left-0 top-0 h-full bg-primary/60 rounded-full"
        initial={{ width: 0 }}
        animate={{ width: active ? "100%" : 0 }}
        transition={{ duration: 0.6 }}
      />
      {active && (
        <>
          <motion.div
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary"
            animate={{ x: [0, 36] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-primary/60"
            animate={{ x: [0, 36] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear", delay: 0.7 }}
          />
        </>
      )}
    </div>
  );
}

// Data particle
function Particle({ delay = 0, left = "20%", top = "30%" }: { delay?: number; left?: string; top?: string }) {
  return (
    <motion.div
      className="absolute w-1.5 h-1.5 rounded-full bg-primary/80"
      style={{ left, top }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: [0, 0.8, 0], scale: [0, 1, 0], y: [0, -8, 0] }}
      transition={{ duration: 1.5, repeat: Infinity, delay }}
    />
  );
}

// Leads flowing into AI engine
function LeadsFlowIntoAI({ count = 5 }: { count?: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg border-2 border-primary/60 bg-primary/20 flex items-center justify-center"
          initial={{ x: -20, opacity: 0, scale: 0.5 }}
          animate={{
            x: [0, 80, 160],
            opacity: [0, 1, 0],
            scale: [0.5, 1, 0.3],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.35,
            ease: "easeInOut",
          }}
        >
          <User className="h-3 w-3 text-primary" />
        </motion.div>
      ))}
    </div>
  );
}

// Message card flowing into envelope
function MessageFlowIntoEnvelope({ active = false }: { active?: boolean }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      {active &&
        Array.from({ length: 3 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 rounded border border-primary/50 bg-primary/10 flex items-center justify-center"
            initial={{ x: -30, opacity: 0 }}
            animate={{
              x: [0, 50, 100],
              opacity: [0, 1, 0],
              scale: [1, 0.8, 0.5],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.3,
              ease: "easeInOut",
            }}
          >
            <FileText className="h-2.5 w-2.5 text-primary" />
          </motion.div>
        ))}
    </div>
  );
}

// Animated counter
function AnimatedCounter({ value, duration = 1 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = value;
    const step = end / (duration * 60);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) {
        setDisplay(end);
        clearInterval(timer);
      } else {
        setDisplay(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <span>{display}</span>;
}

export default function ExecutionPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<"idle" | "generating" | "messages_ready" | "sending" | "complete">("idle");
  const [typingText, setTypingText] = useState("");
  const [generatedCount, setGeneratedCount] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [sentMessages, setSentMessages] = useState<{ leadId: string; leadName: string; message: string }[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchLeads();
        setLeads(data as Lead[]);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const displayLeads = leads.slice(0, 6);
  const totalCount = leads.length;
  const messagesReady = phase === "messages_ready" || phase === "sending" || phase === "complete";

  const handleGenerateMessages = () => {
    if (displayLeads.length === 0) return;
    setPhase("generating");
    setTypingText("");
    setGeneratedCount(0);
    setSentMessages([]);

    const fullText = "Generating personalized outreach...";
    let i = 0;
    const typeInterval = setInterval(() => {
      if (i < fullText.length) {
        setTypingText(fullText.slice(0, i + 1));
        i++;
      } else {
        clearInterval(typeInterval);
        const count = displayLeads.length;
        const msgs: { leadId: string; leadName: string; message: string }[] = [];
        let c = 0;
        const msgInterval = setInterval(() => {
          const lead = displayLeads[c];
          const sampleMsg = `Dear ${lead.name},

I hope this message finds you well. I am reaching out to you today regarding ${lead.company || "your organization"}. We have had the privilege of partnering with several distinguished organizations to enhance their outreach capabilities and streamline their communication workflows.

Our solution has consistently delivered measurable improvements in engagement rates and operational efficiency. I would be honoured to arrange a brief, no-obligation consultation at your convenience to explore how we might support ${lead.company || "your company"} in achieving similar results.

Please do not hesitate to reach out should you wish to discuss this further. I look forward to the possibility of connecting with you.

Kind regards`;
          msgs.push({ leadId: lead.id, leadName: lead.name, message: sampleMsg });
          setSentMessages([...msgs]);
          setGeneratedCount(c + 1);
          c++;
          if (c >= count) {
            clearInterval(msgInterval);
            setPhase("messages_ready");
          }
        }, 400);
      }
    }, 50);
  };

  const handleSendOutreach = () => {
    if (phase !== "messages_ready") return;
    setPhase("sending");
    setSentCount(0);
    const count = displayLeads.length;
    let c = 0;
    const sendInterval = setInterval(() => {
      c++;
      setSentCount(c);
      if (c >= count) {
        clearInterval(sendInterval);
        setPhase("complete");
      }
    }, 600);
  };

  const resetPipeline = () => {
    setPhase("idle");
    setGeneratedCount(0);
    setSentCount(0);
    setSentMessages([]);
  };

  const lineChartData = [
    { stage: "Leads", count: displayLeads.length },
    { stage: "Generated", count: generatedCount },
    { stage: "Sent", count: sentCount },
    { stage: "Delivered", count: phase === "complete" ? sentCount : 0 },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Execution Monitor</h1>
        <p className="text-sm text-muted-foreground mt-1">Visual pipeline: Leads → AI → Messages → Delivery</p>
      </div>

      {leads.length === 0 && !loading ? (
        <Card className="rounded-xl">
          <CardContent className="p-12 text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No leads in the system. Import leads first.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleGenerateMessages}
              disabled={phase !== "idle" || displayLeads.length === 0}
              className="rounded-xl gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Generate Messages
            </Button>
            <Button
              onClick={handleSendOutreach}
              disabled={phase !== "messages_ready"}
              variant="outline"
              className="rounded-xl gap-2"
            >
              <Send className="h-4 w-4" />
              Send Outreach
            </Button>
            {phase === "complete" && (
              <Button onClick={resetPipeline} variant="ghost" className="rounded-xl">
                Reset
              </Button>
            )}
          </div>

          {/* Visual Pipeline */}
          <Card className="rounded-xl overflow-hidden border-2">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="text-lg font-display">Outreach Pipeline</CardTitle>
              <CardDescription>Leads → AI Engine → Messages → Delivery</CardDescription>
            </CardHeader>
            <CardContent className="p-6 overflow-x-auto">
              <div className="flex items-stretch gap-3 min-h-[320px] min-w-[700px]">
                {/* 1. Leads */}
                <div className="flex flex-col items-center w-40 shrink-0">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Leads</p>
                  <motion.div
                    className={`relative w-full flex-1 min-h-[200px] rounded-xl border-2 flex flex-col items-center justify-center overflow-hidden ${
                      phase === "generating" ? "border-primary/50 bg-primary/5" : "border-muted bg-muted/30"
                    }`}
                  >
                    <Database className={`h-10 w-10 mb-1 ${phase === "generating" ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-[10px] text-muted-foreground">{displayLeads.length} leads</span>
                    <div className="flex flex-wrap gap-1 justify-center mt-2 px-1">
                      {displayLeads.slice(0, 4).map((lead) => (
                        <motion.div
                          key={lead.id}
                          whileHover={{ scale: 1.05 }}
                          className="flex items-center gap-1 p-1.5 rounded border bg-card/80"
                        >
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                              {lead.name.slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-[9px] truncate max-w-[40px]">{lead.name}</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                </div>

                <div className="relative flex items-center shrink-0 w-10">
                  <FlowingLine active={phase === "generating" || messagesReady} />
                  {phase === "generating" && <LeadsFlowIntoAI count={6} />}
                </div>

                {/* 2. AI Engine */}
                <div className="flex flex-col items-center w-40 shrink-0">
                  <p className="text-xs font-medium text-muted-foreground mb-2">AI Engine</p>
                  <motion.div
                    className={`relative w-full flex-1 min-h-[200px] rounded-xl border-2 flex flex-col items-center justify-center overflow-hidden ${
                      phase === "generating" ? "border-primary bg-primary/5 ring-2 ring-primary/30 shadow-lg" : "border-muted bg-muted/30"
                    }`}
                    animate={phase === "generating" ? { boxShadow: ["0 0 0", "0 0 24px hsl(29 100% 50% / 0.3)", "0 0 0"] } : {}}
                    transition={{ duration: 1.5, repeat: phase === "generating" ? Infinity : 0 }}
                  >
                    <Brain className={`h-10 w-10 mb-2 ${phase === "generating" ? "text-primary" : "text-muted-foreground"}`} />
                    {phase === "generating" && (
                      <>
                        <div className="text-[10px] text-muted-foreground font-mono px-2 text-center min-h-[2.5rem]">
                          {typingText}
                          <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity }}>|</motion.span>
                        </div>
                        <div className="flex gap-1 mt-2">
                          {[0, 1, 2, 3, 4].map((j) => (
                            <motion.div
                              key={j}
                              className="w-1 h-3 rounded-full bg-primary/70"
                              animate={{
                                scaleY: [0.3, 1, 0.3],
                                opacity: [0.5, 1, 0.5],
                              }}
                              transition={{
                                duration: 0.8,
                                repeat: Infinity,
                                delay: j * 0.12,
                                ease: "easeInOut",
                              }}
                              style={{ transformOrigin: "bottom" }}
                            />
                          ))}
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-1">Processing...</p>
                        <Particle delay={0} left="25%" top="35%" />
                        <Particle delay={0.5} left="60%" top="45%" />
                      </>
                    )}
                    {phase === "idle" && <span className="text-[10px] text-muted-foreground">Ready</span>}
                    {messagesReady && <span className="text-[10px] text-success font-medium">Complete</span>}
                  </motion.div>
                </div>

                <div className="flex items-center shrink-0">
                  <FlowingLine active={messagesReady} />
                </div>

                {/* 3. Message Cards */}
                <div className="flex flex-col items-center w-40 shrink-0">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Messages</p>
                  <div className="flex flex-col gap-2 flex-1 justify-center w-full">
                    {displayLeads.map((lead, i) => (
                      <motion.div
                        key={lead.id}
                        initial={{ opacity: 0, y: 20, scale: 0.8 }}
                        animate={i < generatedCount ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0.3, scale: 0.95 }}
                        transition={{ duration: 0.4 }}
                      >
                        <motion.div
                          className={`flex items-center gap-2 p-2 rounded-lg border bg-card ${phase === "sending" && i < sentCount ? "opacity-0" : ""}`}
                          whileHover={{ scale: 1.02, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                          animate={
                            phase === "sending" && i < sentCount
                              ? { x: 90, y: 0, scale: [1, 0.7, 0.4], opacity: [1, 0.8, 0] }
                              : {}
                          }
                          transition={{ duration: 0.7, ease: "easeInOut" }}
                        >
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <span className="text-[10px] truncate max-w-[80px]">For {lead.name}</span>
                        </motion.div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="relative flex items-center shrink-0 w-10">
                  <FlowingLine active={phase === "sending" || phase === "complete"} />
                  {phase === "sending" && <MessageFlowIntoEnvelope active />}
                </div>

                {/* 4. Envelopes */}
                <div className="flex flex-col items-center w-28 shrink-0">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Envelopes</p>
                  <div className="flex flex-col gap-1.5 flex-1 justify-center">
                    {displayLeads.map((_, i) => {
                      const isSent = phase === "sending" && i < sentCount;
                      const wasSent = phase === "complete" && i < sentCount;
                      return (
                        <motion.div key={i} className="relative h-9 flex items-center justify-center">
                          <motion.div
                            className={`flex items-center justify-center w-9 h-9 rounded-lg border-2 absolute ${
                              isSent || wasSent ? "border-primary/50 bg-primary/5" : "border-dashed border-muted-foreground/30 bg-muted/30"
                            }`}
                            initial={false}
                            animate={
                              isSent
                                ? { scale: [1, 0.9, 0.75], x: [0, 35, 85], y: [0, -25, -50], opacity: [1, 1, 0] }
                                : wasSent
                                ? { scale: 0, opacity: 0 }
                                : {}
                            }
                            transition={{ duration: 1, delay: isSent ? i * 0.15 : 0, ease: [0.25, 0.1, 0.25, 1] }}
                          >
                            <Mail className={`h-4 w-4 ${isSent || wasSent ? "text-primary" : "text-muted-foreground/50"}`} />
                          </motion.div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center shrink-0">
                  <FlowingLine active={phase === "complete"} />
                </div>

                {/* 5. Mailbox */}
                <div className="flex flex-col items-center w-28 shrink-0">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Mailbox</p>
                  <motion.div
                    className="flex flex-col items-center justify-center flex-1"
                    animate={phase === "complete" ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 0.5 }}
                  >
                    <motion.div
                      className="relative p-3 rounded-xl border-2 bg-muted/50 overflow-hidden"
                      animate={
                        phase === "complete"
                          ? { boxShadow: ["0 0 0", "0 0 24px hsl(142 76% 36% / 0.4)"], scale: [1, 1.08, 1.02] }
                          : {}
                      }
                      transition={{ duration: 0.6 }}
                    >
                      <Mailbox className="h-10 w-10 text-primary" />
                      {phase === "complete" && (
                        <motion.div
                          className="absolute inset-0 bg-success/20 rounded-xl"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0, 0.4, 0.15] }}
                          transition={{ duration: 0.6 }}
                        />
                      )}
                    </motion.div>
                    {phase === "complete" && (
                      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] text-success font-medium mt-1">
                        Delivered!
                      </motion.span>
                    )}
                  </motion.div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dashboard Update - shown when complete */}
          <AnimatePresence>
            {phase === "complete" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <Card className="rounded-xl border-2 border-success/30 overflow-hidden">
                  <CardHeader className="bg-success/5 border-b">
                    <CardTitle className="text-lg font-display flex items-center gap-2">
                      <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.5 }}>✓</motion.span>
                      Dashboard Update
                    </CardTitle>
                    <CardDescription>Metrics updated after delivery</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                      {[
                        { label: "Messages Sent", value: sentCount, color: "text-primary" },
                        { label: "Leads Reached", value: displayLeads.length, color: "text-blue-500" },
                        { label: "Conversion Rate", value: `${displayLeads.length > 0 ? ((sentCount / displayLeads.length) * 100).toFixed(0) : 0}%`, color: "text-violet-500" },
                      ].map((stat, i) => (
                        <motion.div
                          key={stat.label}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.1 }}
                          className="p-4 rounded-xl bg-muted/50 hover:bg-muted/70 transition-colors"
                        >
                          <p className="text-2xl font-bold">
                            {typeof stat.value === "number" ? <AnimatedCounter value={stat.value} /> : stat.value}
                          </p>
                          <p className={`text-xs font-medium mt-0.5 ${stat.color}`}>{stat.label}</p>
                        </motion.div>
                      ))}
                    </div>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                      <p className="text-sm font-medium mb-2">Pipeline Progress</p>
                      <ChartContainer config={{ count: { color: "hsl(29, 100%, 50%)" } }} className="h-32">
                        <LineChart data={lineChartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="stage" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Line type="monotone" dataKey="count" stroke="hsl(29, 100%, 50%)" strokeWidth={2} dot={{ r: 4 }} />
                        </LineChart>
                      </ChartContainer>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages Sent to Each User */}
          {sentMessages.length > 0 && (
            <Card className="rounded-xl overflow-hidden">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="text-base font-display">Messages Sent</CardTitle>
                <CardDescription>View the personalized message sent to each lead</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {sentMessages.map((item, i) => (
                    <Collapsible key={item.leadId} className="group/msg">
                      <motion.div
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="hover:bg-accent/20 transition-colors"
                      >
                        <CollapsibleTrigger className="flex w-full items-center gap-3 p-4 text-left">
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                              {item.leadName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{item.leadName}</p>
                            <p className="text-xs text-muted-foreground truncate">{item.message.slice(0, 80)}...</p>
                          </div>
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/msg:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-4 pb-4 pt-0">
                            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                              {item.message}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </motion.div>
                    </Collapsible>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Progress & Lead Journey */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle className="text-base font-display">Pipeline Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Messages generated</span>
                    <span className="font-medium">{generatedCount} / {displayLeads.length}</span>
                  </div>
                  <Progress value={displayLeads.length > 0 ? (generatedCount / displayLeads.length) * 100 : 0} className="h-2" />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sent</span>
                    <span className="font-medium">{sentCount} / {displayLeads.length}</span>
                  </div>
                  <Progress value={displayLeads.length > 0 ? (sentCount / displayLeads.length) * 100 : 0} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl overflow-hidden">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="text-base font-display">Lead Journey</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y max-h-48 overflow-y-auto">
                  {leads.slice(0, 10).map((lead, i) => (
                    <motion.div
                      key={lead.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center gap-3 p-3 hover:bg-accent/30 transition-colors group"
                    >
                      <Avatar className="h-8 w-8 shrink-0 group-hover:ring-2 group-hover:ring-primary/30 transition-all">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                          {lead.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{lead.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{lead.company || "—"}</p>
                      </div>
                      <motion.div
                        className={`w-2 h-2 rounded-full shrink-0 ${["replied", "email_sent"].includes(lead.status) ? "bg-success" : "bg-muted"}`}
                        animate={["replied", "email_sent"].includes(lead.status) ? { boxShadow: "0 0 8px hsl(142 76% 36% / 0.6)" } : {}}
                        transition={{ duration: 1.5, repeat: ["replied", "email_sent"].includes(lead.status) ? Infinity : 0 }}
                      />
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Inbox,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Send,
  RefreshCw,
  Edit3,
  Loader2,
  ChevronRight,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  fetchMessagesWithReplies,
  fetchPendingFollowUpMessages,
  updateMessageReply,
  markMessageRead,
  updateMessageFollowupSent,
  addReplyToMessage,
} from "@/lib/supabase-queries";
import { supabase } from "@/integrations/supabase/client";

type InboxFilter = "all" | "positive" | "neutral" | "negative" | "unread";

interface InboxMessage {
  id: string;
  lead_id: string;
  workflow_id: string | null;
  generated_message: string | null;
  status: string;
  reply_text: string | null;
  reply_tone: string | null;
  followup_message: string | null;
  reply_received_at: string | null;
  is_read: boolean | null;
  tone_confidence: number | null;
  created_at?: string;
  leads?: { id: string; name: string; email: string; company: string | null; role: string | null; industry?: string | null } | null;
}

const toneConfig = {
  positive: { icon: ThumbsUp, color: "bg-success/20 text-success border-success/40", label: "Positive" },
  neutral: { icon: Minus, color: "bg-warning/20 text-warning border-warning/40", label: "Neutral" },
  negative: { icon: ThumbsDown, color: "bg-destructive/20 text-destructive border-destructive/40", label: "Negative" },
};

function formatTimeAgo(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

/** Classify reply tone as positive, neutral, or negative (client-side fallback) */
function classifyToneClient(text: string): "positive" | "neutral" | "negative" {
  const t = text.toLowerCase();
  const positive = /\b(thanks|thank you|interested|great|awesome|yes|sure|sounds good|love to|happy to|excited|perfect|wonderful|looking forward)\b/i;
  const negative = /\b(no thanks|not interested|stop|unsubscribe|remove|don't contact|wrong person|busy|no time)\b/i;
  if (positive.test(t) && !negative.test(t)) return "positive";
  if (negative.test(t)) return "negative";
  return "neutral";
}

interface PendingFollowUp {
  id: string;
  lead_id: string;
  follow_up_after: string | null;
  created_at?: string;
  leads?: { id: string; name: string; email: string; company: string | null } | null;
}

/** Live countdown: "Follow-up will be sent in: 2h 34m 12s" (updates every second) */
function FollowUpCountdown({ followUpAfter }: { followUpAfter: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const end = new Date(followUpAfter).getTime();
  const rem = Math.max(0, end - now);
  const h = Math.floor(rem / 3600000);
  const m = Math.floor((rem % 3600000) / 60000);
  const s = Math.floor((rem % 60000) / 1000);
  const text = rem <= 0 ? "Any moment…" : `${h}h ${m}m ${s}s`;
  return <span className="tabular-nums">{text}</span>;
}

export default function InboxPage() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [selected, setSelected] = useState<InboxMessage | null>(null);
  const [editingFollowup, setEditingFollowup] = useState("");
  const [sendingFollowup, setSendingFollowup] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [manualReplyText, setManualReplyText] = useState("");
  const [savingReply, setSavingReply] = useState(false);
  const [checkingReplies, setCheckingReplies] = useState(false);
  const [pendingFollowUps, setPendingFollowUps] = useState<PendingFollowUp[]>([]);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMessagesWithReplies();
      setMessages((data as InboxMessage[]) || []);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInbox();
    const interval = setInterval(loadInbox, 10000);
    return () => clearInterval(interval);
  }, [loadInbox]);

  const loadPendingFollowUps = useCallback(async () => {
    try {
      const data = await fetchPendingFollowUpMessages();
      setPendingFollowUps((data as PendingFollowUp[]) || []);
    } catch {
      setPendingFollowUps([]);
    }
  }, []);

  useEffect(() => {
    loadPendingFollowUps();
    const interval = setInterval(loadPendingFollowUps, 30000);
    return () => clearInterval(interval);
  }, [loadPendingFollowUps]);

  // Poll Gmail for new lead replies so they appear instantly
  useEffect(() => {
    const poll = async () => {
      try {
        const base = window.location.origin;
        const r = await fetch(`${base}/api/fetch-replies`, { method: "POST" });
        if (r.ok) {
          const data = await r.json();
          if (data?.updated > 0) loadInbox();
        }
      } catch {
        // ignore
      }
    };
    poll();
    const t = setInterval(poll, 15000);
    return () => clearInterval(t);
  }, [loadInbox]);

  const handleCheckReplies = async () => {
    setCheckingReplies(true);
    try {
      const base = window.location.origin;
      const r = await fetch(`${base}/api/fetch-replies`, { method: "POST" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(data?.error || "Failed to fetch replies from Gmail");
        return;
      }
      if (data?.updated > 0) {
        await loadInbox();
        toast.success(`${data.updated} new reply(ies) from Gmail`);
      } else {
        toast.info("No new replies in Gmail. Make sure IMAP is enabled and the lead’s email matches your Leads list.");
      }
    } catch {
      toast.error("Could not reach the server. Is the dev server running?");
    } finally {
      setCheckingReplies(false);
    }
  };

  const filtered = messages
    .filter((m) => {
      if (filter === "all") return true;
      if (filter === "unread") return !m.is_read;
      if (filter === "positive" || filter === "neutral" || filter === "negative") return m.reply_tone === filter;
      return true;
    })
    .sort((a, b) => new Date(b.reply_received_at || b.created_at || 0).getTime() - new Date(a.reply_received_at || a.created_at || 0).getTime());

  const handleSelect = (msg: InboxMessage) => {
    setSelected(msg);
    setEditingFollowup(msg.followup_message || "");
    setManualReplyText("");
    if (!msg.is_read) markMessageRead(msg.id).catch(() => {});
  };

  const handleSaveManualReply = async () => {
    if (!selected || !manualReplyText.trim()) return;
    setSavingReply(true);
    try {
      let tone: "positive" | "neutral" | "negative" = "neutral";
      try {
        const { data: toneData } = await supabase.functions.invoke("analyze-tone", { body: { reply_text: manualReplyText } });
        tone = (toneData?.tone || classifyToneClient(manualReplyText)) as "positive" | "neutral" | "negative";
      } catch {
        tone = classifyToneClient(manualReplyText);
      }
      const lead = selected.leads || {};
      let followup = "";
      try {
        const { data: followupData } = await supabase.functions.invoke("generate-followup", {
          body: { lead, reply_text: manualReplyText, reply_tone: tone },
        });
        followup = followupData?.followup_message || "";
      } catch {
        followup = "";
      }
      await addReplyToMessage(selected.id, manualReplyText.trim(), tone, followup);
      setSelected((s) => (s?.id === selected.id ? { ...s, reply_text: manualReplyText.trim(), reply_tone: tone, followup_message: followup, reply_received_at: new Date().toISOString(), status: "replied" } : s));
      setMessages((prev) => prev.map((m) => (m.id === selected.id ? { ...m, reply_text: manualReplyText.trim(), reply_tone: tone, followup_message: followup, reply_received_at: new Date().toISOString(), status: "replied" } : m)));
      setManualReplyText("");
      setEditingFollowup(followup);
      toast.success(`Reply saved and classified as ${tone}`);
    } catch {
      toast.error("Failed to save reply");
    } finally {
      setSavingReply(false);
    }
  };

  const handleAnalyzeAndGenerate = async (msg: InboxMessage) => {
    if (!msg.reply_text) return;
    setRegenerating(true);
    try {
      const { data: toneData } = await supabase.functions.invoke("analyze-tone", {
        body: { reply_text: msg.reply_text },
      });
      const tone = toneData?.tone || "neutral";

      const lead = msg.leads || {};
      const { data: followupData } = await supabase.functions.invoke("generate-followup", {
        body: { lead, reply_text: msg.reply_text, reply_tone: tone },
      });
      const followup = followupData?.followup_message || "";

      await updateMessageReply(msg.id, { reply_tone: tone, followup_message: followup });
      setEditingFollowup(followup);
      setSelected((s) => (s?.id === msg.id ? { ...s, reply_tone: tone, followup_message: followup } : s));
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, reply_tone: tone, followup_message: followup } : m)));
      toast.success("Follow-up generated");
    } catch (e) {
      toast.error("Failed to generate follow-up");
    } finally {
      setRegenerating(false);
    }
  };

  const handleSendFollowup = async () => {
    if (!selected) return;
    setSendingFollowup(true);
    try {
      await updateMessageReply(selected.id, { followup_message: editingFollowup });
      await updateMessageFollowupSent(selected.id);
      toast.success("Follow-up sent!");
      setSelected((s) => (s ? { ...s, status: "followup_sent", followup_message: editingFollowup } : null));
      setMessages((prev) => prev.map((m) => (m.id === selected.id ? { ...m, status: "followup_sent", followup_message: editingFollowup } : m)));
    } catch {
      toast.error("Failed to send follow-up");
    } finally {
      setSendingFollowup(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Sidebar */}
      <div className="w-56 border-r border-white/20 glass-card !rounded-none shrink-0 flex flex-col">
        <div className="p-4 border-b border-white/20">
          <h2 className="font-display font-semibold text-foreground flex items-center gap-2">
            <Inbox className="h-5 w-5 text-primary" />
            Inbox
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Replies from leads</p>
        </div>
        <nav className="p-2 flex-1">
          {[
            { id: "all" as const, label: "All", icon: MessageSquare },
            { id: "positive" as const, label: "Positive", icon: ThumbsUp },
            { id: "neutral" as const, label: "Neutral", icon: Minus },
            { id: "negative" as const, label: "Negative", icon: ThumbsDown },
            { id: "unread" as const, label: "Unread", icon: Inbox },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                filter === item.id ? "bg-primary/20 text-primary font-medium" : "text-muted-foreground hover:bg-white/5"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-2 border-t border-white/20">
          <Button variant="default" size="sm" className="w-full gap-2" onClick={handleCheckReplies} disabled={checkingReplies}>
            {checkingReplies ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Check for replies from Gmail
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="w-80 border-r border-white/20 flex flex-col shrink-0">
        {/* Scheduled follow-ups — always visible so the feature is clear; shows countdown when emails sent with no reply */}
        <div className="p-3 border-b border-primary/20 bg-primary/5">
          <p className="text-xs font-medium text-foreground flex items-center gap-1.5 mb-2">
            <Clock className="h-3.5 w-3.5 text-primary" />
            Scheduled follow-ups
          </p>
          {pendingFollowUps.length > 0 ? (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {pendingFollowUps.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-white/10 bg-background/80 p-2.5 text-left"
                >
                  <p className="text-xs font-medium truncate">{item.leads?.name || "Unknown"}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{item.leads?.company || item.leads?.email || "—"}</p>
                  <p className="text-[10px] text-primary mt-1.5 flex items-center gap-1">
                    <Clock className="h-3 w-3 shrink-0" />
                    Follow-up will be sent in: <FollowUpCountdown followUpAfter={item.follow_up_after!} />
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground">
              No follow-ups scheduled. Send emails from <strong>Workflow</strong> or <strong>Execution</strong> — if a lead doesn’t reply, a follow-up is sent automatically after 3h + 5–6 min. Countdowns will appear here.
            </p>
          )}
        </div>
        <div className="p-3 border-b border-white/20">
          <p className="text-xs text-muted-foreground">
            {filtered.length} {filter === "all" ? "replies" : filter}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              <Inbox className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No replies yet</p>
              <p className="text-xs mt-1">Click &quot;Check for replies from Gmail&quot; in the sidebar to pull real lead replies.</p>
            </div>
          ) : (
            filtered.map((msg) => {
              const lead = msg.leads;
              const tc = msg.reply_tone ? (toneConfig[msg.reply_tone as keyof typeof toneConfig] || toneConfig.neutral) : toneConfig.neutral;
              const ToneIcon = tc.icon;
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => handleSelect(msg)}
                  className={`flex items-center gap-3 p-3 border-b border-white/10 cursor-pointer transition-colors hover:bg-white/5 ${
                    selected?.id === msg.id ? "bg-primary/10 border-l-2 border-l-primary" : ""
                  } ${!msg.is_read ? "bg-primary/5" : ""}`}
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="text-xs bg-primary/20 text-primary font-semibold">
                      {lead?.name?.slice(0, 2) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{lead?.name || "Unknown"}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{lead?.company || lead?.email || "—"}</p>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {msg.reply_text?.slice(0, 50) || "—"}
                      {(msg.reply_text?.length ?? 0) > 50 ? "..." : ""}
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <Badge variant="outline" className={`text-[9px] ${tc.color}`}>
                      <ToneIcon className="h-2.5 w-2.5 mr-0.5" />
                      {tc.label}
                    </Badge>
                    <span className="text-[9px] text-muted-foreground">{formatTimeAgo(msg.reply_received_at || msg.created_at)}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* Conversation Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-white/20 glass-card !rounded-none">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                        {selected.leads?.name?.slice(0, 2) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-display font-semibold">{selected.leads?.name || "Unknown"}</h3>
                      <p className="text-sm text-muted-foreground">{selected.leads?.company || "—"}</p>
                    </div>
                  </div>
                  {selected.reply_tone && (
                    <Badge variant="outline" className={toneConfig[selected.reply_tone as keyof typeof toneConfig]?.color}>
                      {toneConfig[selected.reply_tone as keyof typeof toneConfig]?.label}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Original message */}
                <Card className="border-0 glass-card">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">You</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selected.generated_message || "—"}
                    </p>
                  </CardContent>
                </Card>

                {/* Lead reply (Inbox shows only replies) */}
                <Card className="border-0 glass-card border-l-4 border-l-primary">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Lead Reply</CardTitle>
                    <p className="text-[10px] text-muted-foreground">{formatTimeAgo(selected.reply_received_at)}</p>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm whitespace-pre-wrap">{selected.reply_text || "—"}</p>
                  </CardContent>
                </Card>

                {/* AI Analysis */}
                {selected.reply_tone && (
                  <div className="rounded-xl glass-stage p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Clustered tone</p>
                    <p className="text-sm">
                      Tone: <span className="font-medium capitalize">{selected.reply_tone}</span>
                      {selected.tone_confidence && ` · Confidence: ${selected.tone_confidence}%`}
                    </p>
                  </div>
                )}

                {/* Follow-up panel — only when lead has replied */}
                {selected.reply_text && (
                <Card className="border-0 glass-card">
                  <CardHeader className="py-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">Suggested Follow-Up</CardTitle>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleAnalyzeAndGenerate(selected)}
                        disabled={regenerating}
                      >
                        {regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        Regenerate
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <Textarea
                      value={editingFollowup}
                      onChange={(e) => setEditingFollowup(e.target.value)}
                      placeholder="Generate a follow-up or type your own..."
                      className="min-h-[100px] text-sm resize-none"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="gap-2"
                        onClick={handleSendFollowup}
                        disabled={!editingFollowup.trim() || sendingFollowup || selected.status === "followup_sent"}
                      >
                        {sendingFollowup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {selected.status === "followup_sent" ? "Sent" : "Send Follow-Up"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex items-center justify-center text-muted-foreground"
            >
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="font-medium">Select a conversation</p>
                <p className="text-sm mt-1">Choose a reply from the list to view and respond</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

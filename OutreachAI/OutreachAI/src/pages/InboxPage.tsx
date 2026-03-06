import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Inbox,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Mail,
  Send,
  RefreshCw,
  Edit3,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  fetchInboxMessages,
  fetchMessagesWithReplies,
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
  leads?: { id: string; name: string; email: string; company: string | null; role: string | null } | null;
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

export default function InboxPage() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [selected, setSelected] = useState<InboxMessage | null>(null);
  const [editingFollowup, setEditingFollowup] = useState("");
  const [sendingFollowup, setSendingFollowup] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

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

  const filtered = messages.filter((m) => {
    if (filter === "all") return true;
    if (filter === "unread") return !m.is_read;
    return m.reply_tone === filter;
  });

  const handleSelect = (msg: InboxMessage) => {
    setSelected(msg);
    setEditingFollowup(msg.followup_message || "");
    if (!msg.is_read) markMessageRead(msg.id).catch(() => {});
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

  const handleSimulateReply = async () => {
    try {
      const { data: sentMessages } = await supabase.from("messages").select("id, lead_id").eq("status", "sent").limit(1);
      if (!sentMessages?.length) {
        const { data: anyMsg } = await supabase.from("messages").select("id, lead_id").limit(1);
        if (!anyMsg?.length) {
          toast.error("No messages found. Run a workflow first.");
          return;
        }
        const [m] = anyMsg;
        const { data: lead } = await supabase.from("leads").select("*").eq("id", m.lead_id).single();
        const replyText = `This sounds interesting, can you share more details about your solution?`;
        await addReplyToMessage(m.id, replyText);
        const { data: toneData } = await supabase.functions.invoke("analyze-tone", { body: { reply_text: replyText } });
        const { data: followupData } = await supabase.functions.invoke("generate-followup", {
          body: { lead, reply_text: replyText, reply_tone: toneData?.tone || "positive" },
        });
        await updateMessageReply(m.id, {
          reply_tone: toneData?.tone || "positive",
          followup_message: followupData?.followup_message || "",
        });
        toast.success("Demo reply added!");
      } else {
        const [m] = sentMessages;
        const { data: lead } = await supabase.from("leads").select("*").eq("id", m.lead_id).single();
        const replyText = `This sounds interesting, can you share more details?`;
        await addReplyToMessage(m.id, replyText);
        const { data: toneData } = await supabase.functions.invoke("analyze-tone", { body: { reply_text: replyText } });
        const { data: followupData } = await supabase.functions.invoke("generate-followup", {
          body: { lead, reply_text: replyText, reply_tone: toneData?.tone || "positive" },
        });
        await updateMessageReply(m.id, {
          reply_tone: toneData?.tone || "positive",
          followup_message: followupData?.followup_message || "",
        });
        toast.success("Demo reply added!");
      }
      loadInbox();
    } catch (e) {
      toast.error("Could not add demo reply. Ensure migration has run and AI is configured.");
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
          <p className="text-xs text-muted-foreground mt-0.5">Replies & follow-ups</p>
        </div>
        <nav className="p-2 flex-1">
          {[
            { id: "all" as const, label: "All Replies", icon: MessageSquare },
            { id: "positive" as const, label: "Positive", icon: ThumbsUp },
            { id: "neutral" as const, label: "Neutral", icon: Minus },
            { id: "negative" as const, label: "Negative", icon: ThumbsDown },
            { id: "unread" as const, label: "Unread", icon: Mail },
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
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleSimulateReply}>
            <Mail className="h-3.5 w-3.5" />
            Add Demo Reply
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="w-80 border-r border-white/20 flex flex-col shrink-0">
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
              <p className="text-xs mt-1">Replies will appear here when leads respond</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={handleSimulateReply}>
                Add Demo Reply
              </Button>
            </div>
          ) : (
            filtered.map((msg) => {
              const lead = msg.leads;
              const tc = toneConfig[msg.reply_tone as keyof typeof toneConfig] || toneConfig.neutral;
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
                    <p className="text-[10px] text-muted-foreground truncate">{lead?.company || "—"}</p>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">{msg.reply_text?.slice(0, 40)}...</p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <Badge variant="outline" className={`text-[9px] ${tc.color}`}>
                      <ToneIcon className="h-2.5 w-2.5 mr-0.5" />
                      {tc.label}
                    </Badge>
                    <span className="text-[9px] text-muted-foreground">{formatTimeAgo(msg.reply_received_at)}</span>
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

                {/* Lead reply */}
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
                    <p className="text-xs font-medium text-muted-foreground mb-1">AI Analysis</p>
                    <p className="text-sm">
                      Tone: <span className="font-medium capitalize">{selected.reply_tone}</span>
                      {selected.tone_confidence && ` · Confidence: ${selected.tone_confidence}%`}
                    </p>
                  </div>
                )}

                {/* Follow-up panel */}
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

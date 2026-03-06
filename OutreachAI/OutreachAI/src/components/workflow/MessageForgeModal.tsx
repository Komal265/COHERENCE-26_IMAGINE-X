import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Edit3, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Lead {
  id: string;
  name: string;
  email: string;
  company?: string | null;
  industry?: string | null;
  role?: string | null;
}

interface MessageForgeModalProps {
  open: boolean;
  onClose: () => void;
  onApprove: (subject: string, body: string) => void;
  lead: Lead | null;
  /** High-value leads require human approval before sending */
  isHighValue?: boolean;
}

function streamText(text: string, onChunk: (chunk: string) => void, speed = 25) {
  let i = 0;
  const interval = setInterval(() => {
    if (i < text.length) {
      onChunk(text.slice(0, i + 1));
      i++;
    } else {
      clearInterval(interval);
    }
  }, speed);
  return () => clearInterval(interval);
}

export function MessageForgeModal({
  open,
  onClose,
  onApprove,
  lead,
  isHighValue = false,
}: MessageForgeModalProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [fullSubject, setFullSubject] = useState("");
  const [fullBody, setFullBody] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [streamComplete, setStreamComplete] = useState(false);

  const sampleSubject = `Re: Opportunities at ${lead?.company || "your company"}`;
  const sampleBody = lead
    ? `Dear ${lead.name},

I hope this message finds you well. I am reaching out regarding ${lead.company || "your organization"}. We have had the privilege of partnering with several distinguished organizations to enhance their outreach capabilities.

Our solution has consistently delivered measurable improvements in engagement rates. I would be honoured to arrange a brief consultation at your convenience to explore how we might support ${lead.company || "your company"}.

Kind regards`
    : "";

  useEffect(() => {
    if (!open || !lead) return;
    setSubject("");
    setBody("");
    setFullSubject(sampleSubject);
    setFullBody(sampleBody);
    setStreamComplete(false);
    setIsEditing(false);

    const clearSubject = streamText(sampleSubject, setSubject, 40);
    let bodyTimeout: ReturnType<typeof setTimeout> | undefined;
    const subjectTimeout = setTimeout(() => {
      clearSubject();
      setSubject(sampleSubject);
      const clearBody = streamText(sampleBody, setBody, 18);
      bodyTimeout = setTimeout(() => {
        clearBody();
        setBody(sampleBody);
        setStreamComplete(true);
      }, sampleBody.length * 18 + 200);
    }, sampleSubject.length * 40 + 100);

    return () => {
      clearSubject();
      clearTimeout(subjectTimeout);
      clearTimeout(bodyTimeout);
    };
  }, [open, lead?.id]);

  const handleApprove = () => {
    onApprove(subject || fullSubject, body || fullBody);
    onClose();
  };

  const handleEdit = () => {
    setIsEditing(true);
    setFullSubject(subject || fullSubject);
    setFullBody(body || fullBody);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-modal backdrop-blur-xl border-white/20 bg-white/10 dark:bg-slate-900/40 max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Drafting Personalized Message
            {lead && (
              <span className="text-sm font-normal text-muted-foreground">
                for {lead.name}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Subject</label>
            <div className="mt-1 rounded-xl border border-white/20 bg-black/10 dark:bg-white/5 p-3 font-medium text-foreground min-h-[2.5rem]">
              {isEditing ? (
                <input
                  value={fullSubject}
                  onChange={(e) => setFullSubject(e.target.value)}
                  className="w-full bg-transparent outline-none"
                />
              ) : (
                <>
                  {subject}
                  {!streamComplete && (
                    <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity }}>|</motion.span>
                  )}
                </>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Body</label>
            <div className="mt-1 rounded-xl border border-white/20 bg-black/10 dark:bg-white/5 p-4 text-sm text-foreground min-h-[12rem] whitespace-pre-wrap">
              {isEditing ? (
                <textarea
                  value={fullBody}
                  onChange={(e) => setFullBody(e.target.value)}
                  className="w-full min-h-[10rem] bg-transparent outline-none resize-none"
                />
              ) : (
                <>
                  {body}
                  {!streamComplete && (
                    <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity }}>|</motion.span>
                  )}
                </>
              )}
            </div>
          </div>

          {isHighValue && streamComplete && !isEditing && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 flex items-center gap-2"
            >
              <span className="text-sm text-amber-600 dark:text-amber-400">High-value lead — review before sending</span>
            </motion.div>
          )}
        </div>

        <div className="flex gap-2 pt-4 border-t border-white/20">
          <Button
            variant="outline"
            className="glass-card border-white/20"
            onClick={onClose}
          >
            Cancel
          </Button>
          {isEditing ? (
            <Button onClick={handleApprove} className="gap-2">
              <Check className="h-4 w-4" />
              Approve & Continue
            </Button>
          ) : isHighValue && streamComplete ? (
            <>
              <Button variant="outline" className="glass-card border-white/20 gap-2" onClick={handleEdit}>
                <Edit3 className="h-4 w-4" />
                Edit
              </Button>
              <Button onClick={handleApprove} className="gap-2">
                <Check className="h-4 w-4" />
                Approve
              </Button>
            </>
          ) : (
            <Button onClick={handleApprove} disabled={!streamComplete} className="gap-2">
              <Check className="h-4 w-4" />
              {streamComplete ? "Continue" : "Drafting..."}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

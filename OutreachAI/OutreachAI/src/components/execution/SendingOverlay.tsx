import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Lead {
  id: string;
  name: string;
  email: string;
  company?: string | null;
}

interface SendingOverlayProps {
  open: boolean;
  leads: Lead[];
  onComplete: () => void;
  /** Index of lead currently receiving (0-based). When all done, onComplete fires. */
  currentIndex: number;
}

export function SendingOverlay({ open, leads, onComplete, currentIndex }: SendingOverlayProps) {
  const [emailsInFlight, setEmailsInFlight] = useState<number[]>([]);

  useEffect(() => {
    if (!open || leads.length === 0) return;
    if (currentIndex >= leads.length) {
      const t = setTimeout(onComplete, 800);
      return () => clearTimeout(t);
    }
    setEmailsInFlight((prev) => [...prev, currentIndex]);
    const clear = setTimeout(() => setEmailsInFlight((p) => p.filter((i) => i !== currentIndex)), 1200);
    return () => clearTimeout(clear);
  }, [open, currentIndex, leads.length, onComplete]);

  const displayLeads = leads.slice(0, 9);
  const cols = 3;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="glass-modal rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl"
          >
            <p className="text-center text-sm text-muted-foreground mb-6">Sending outreach...</p>

            {/* Central source - Mail icon emitting */}
            <div className="relative flex flex-col items-center gap-8">
              <motion.div
                className="flex items-center justify-center w-16 h-16 rounded-2xl border-2 border-primary/60 bg-primary/20"
                animate={{
                  boxShadow: [
                    "0 0 0 hsl(29 100% 50% / 0)",
                    "0 0 28px hsl(29 100% 50% / 0.5)",
                    "0 0 0 hsl(29 100% 50% / 0)",
                  ],
                }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <Mail className="h-8 w-8 text-primary" />
              </motion.div>

              {/* Email icons flying to recipients */}
              {emailsInFlight.map((idx) => {
                const lead = displayLeads[idx];
                if (!lead) return null;
                const row = Math.floor(idx / cols);
                const col = idx % cols;
                const tx = (col - 1) * 80;
                const ty = 60 + row * 70;
                return (
                  <motion.div
                    key={`fly-${idx}`}
                    className="absolute left-1/2 top-16 flex items-center justify-center w-8 h-8 rounded-lg border border-primary/50 bg-primary/20"
                    initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                    animate={{
                      x: tx,
                      y: ty,
                      opacity: [1, 1, 0],
                      scale: [1, 0.8, 0.5],
                    }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  >
                    <Mail className="h-4 w-4 text-primary" />
                  </motion.div>
                );
              })}

              {/* Recipient avatars grid */}
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
              >
                {displayLeads.map((lead, idx) => {
                  const received = idx < currentIndex;
                  return (
                    <motion.div
                      key={lead.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-500 ${
                        received
                          ? "border-primary/60 bg-primary/10 shadow-[0_0_20px_hsl(29_100%_50%_/_.3)]"
                          : "border-white/20 bg-white/5"
                      }`}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="text-xs bg-primary/20 text-primary font-semibold">
                          {lead.name.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium truncate max-w-[70px]">{lead.name}</span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Database, FileText } from "lucide-react";

const STATUS_PHRASES = [
  "Analyzing Lead Persona...",
  "Retrieving Reference Data...",
  "Drafting Personalized Logic...",
];

function TypewriterText({ phrases }: { phrases: string[] }) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [display, setDisplay] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const phrase = phrases[phraseIndex];
    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          if (display.length < phrase.length) {
            setDisplay(phrase.slice(0, display.length + 1));
          } else {
            setIsDeleting(true);
          }
        } else {
          if (display.length > 0) {
            setDisplay(display.slice(0, -1));
          } else {
            setIsDeleting(false);
            setPhraseIndex((i) => (i + 1) % phrases.length);
          }
        }
      },
      isDeleting ? 30 : 80
    );
    return () => clearTimeout(timeout);
  }, [display, isDeleting, phraseIndex, phrases]);

  return (
    <span className="font-mono text-sm text-foreground">
      {display}
      <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity }}>|</motion.span>
    </span>
  );
}

interface RAGOverlayProps {
  open: boolean;
  onComplete: () => void;
  duration?: number;
}

export function RAGOverlay({ open, onComplete, duration = 3500 }: RAGOverlayProps) {
  const [pulseCount, setPulseCount] = useState(0);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onComplete, duration);
    const pulseInterval = setInterval(() => setPulseCount((c) => c + 1), 600);
    return () => {
      clearTimeout(t);
      clearInterval(pulseInterval);
    };
  }, [open, onComplete, duration]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4 }}
            className="glass-modal rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl"
          >
            <div className="flex flex-col items-center gap-8">
              {/* Central Query node */}
              <motion.div
                className="relative flex items-center justify-center w-20 h-20 rounded-2xl border-2 border-primary/60 bg-primary/20"
                animate={{ boxShadow: ["0 0 0 hsl(29 100% 50% / 0)", "0 0 32px hsl(29 100% 50% / 0.5)", "0 0 0 hsl(29 100% 50% / 0)"] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              >
                <Search className="h-10 w-10 text-primary" />
              </motion.div>

              {/* Source nodes (Database icons) - arranged around center */}
              <div className="relative w-48 h-32 flex items-center justify-center">
                {[0, 1, 2].map((i) => {
                  const angle = (i * 120 - 90) * (Math.PI / 180);
                  const x = 70 * Math.cos(angle);
                  const y = 50 * Math.sin(angle);
                  return (
                    <motion.div
                      key={i}
                      className="absolute flex items-center justify-center w-12 h-12 rounded-xl border-2 border-blue-500/60 bg-blue-500/20"
                      style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`, transform: "translate(-50%, -50%)" }}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2 + i * 0.15 }}
                    >
                      <Database className="h-6 w-6 text-blue-400" />
                      {/* Pulse from center to this node */}
                      {pulseCount > 0 && (
                        <motion.div
                          className="absolute inset-0 rounded-xl border-2 border-primary"
                          initial={{ scale: 0.5, opacity: 0.8 }}
                          animate={{ scale: 1.5, opacity: 0 }}
                          transition={{ duration: 0.8 }}
                        />
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* File icons flying back to center */}
              <div className="relative w-32 h-16">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute flex items-center justify-center w-8 h-8 rounded-lg border border-primary/50 bg-primary/20"
                    initial={{ x: 40 + i * 20, y: 0, opacity: 0 }}
                    animate={{
                      x: [40 + i * 20, 0],
                      y: [0, 0],
                      opacity: [0, 1, 1, 0],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.4,
                      ease: "easeInOut",
                    }}
                  >
                    <FileText className="h-4 w-4 text-primary" />
                  </motion.div>
                ))}
              </div>

              {/* Typewriter status */}
              <div className="min-h-[2rem] flex items-center justify-center">
                <TypewriterText phrases={STATUS_PHRASES} />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

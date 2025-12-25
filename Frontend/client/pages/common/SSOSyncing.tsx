import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, UserCheck, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const SYNC_MESSAGES = [
  "Connecting to HRMS secure portal...",
  "Syncing your employee profile...",
  "Verifying organizational roles...",
  "Retrieving travel entitlements...",
  "Preparing your personalized dashboard...",
];

export const SSOSyncing = () => {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % SYNC_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-50 flex flex-col items-center justify-center z-50">
      <div className="w-full max-w-md p-8 text-center">
        {/* Animated Icon */}
        <div className="relative mb-8 inline-block">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="text-primary/20"
          >
            <Loader2 className="w-32 h-32" />
          </motion.div>
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <Zap className="w-12 h-12 text-primary fill-primary" />
            </motion.div>
          </div>
        </div>

        {/* Dynamic Text */}
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Secure SSO Login
        </h1>

        <div className="h-8 overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.p
              key={messageIndex}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="text-slate-500 font-medium"
            >
              {SYNC_MESSAGES[messageIndex]}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Visual Progress Indicators */}
        <div className="mt-12 flex justify-center gap-6 text-slate-400">
          <div className="flex flex-col items-center gap-2">
            <ShieldCheck
              className={`w-6 h-6 ${messageIndex >= 1 ? "text-green-500" : ""}`}
            />
            <span className="text-[10px] uppercase tracking-wider font-bold">
              Secure
            </span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <UserCheck
              className={`w-6 h-6 ${messageIndex >= 2 ? "text-green-500" : ""}`}
            />
            <span className="text-[10px] uppercase tracking-wider font-bold">
              Profile
            </span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Zap
              className={`w-6 h-6 ${messageIndex >= 3 ? "text-green-500" : ""}`}
            />
            <span className="text-[10px] uppercase tracking-wider font-bold">
              Ready
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-8 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 10 }}
          />
        </div>

        <p className="mt-8 text-xs text-slate-400">
          Redirecting to TravelExpensePro. Please do not close this window.
        </p>
      </div>
    </div>
  );
};

export default SSOSyncing;

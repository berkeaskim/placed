"use client";
import { useEffect, useRef, useState } from "react";
import { animate, motion, useReducedMotion, type Variants } from "motion/react";

/**
 * Results the agent just produced arrive one after another rather than all at once.
 * Wrap the list in <Stagger> and each item in <StaggerItem>. Reduced motion: plain fade.
 */
const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } };
const item: Variants = {
  hidden: { opacity: 0, y: 8, filter: "blur(3px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { type: "spring", bounce: 0, duration: 0.45 } },
};
const itemReduced: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.2 } } };

export function Stagger({ children, className, as = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "ul" | "ol" | "section" }) {
  const Tag = motion[as];
  return <Tag className={className} variants={container} initial="hidden" animate="show">{children}</Tag>;
}

export function StaggerItem({ children, className, as = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "li" }) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  return <Tag className={className} variants={reduce ? itemReduced : item}>{children}</Tag>;
}

/** One block fading up into place (a panel that swaps in after the agent finishes). */
export function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ type: "spring", bounce: 0, duration: 0.5, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Animated number for agent-computed figures (match %, score). Renders the final value under reduced motion. */
export function CountUp({ to, duration = 1, format = (n: number) => String(Math.round(n)) }: { to: number; duration?: number; format?: (n: number) => string }) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (reduce) return;
    const c = animate(from.current, to, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: (x) => { from.current = x; setV(x); } });
    return () => c.stop();
  }, [to, reduce, duration]);
  return <>{format(reduce ? to : v)}</>;
}

/**
 * A ring or bar that draws in to its value once. `DrawCircle` replaces a static <circle> with
 * strokeDasharray; `GrowBar` replaces a div whose width is the value.
 */
export function DrawCircle({ r, cx, cy, value, className, strokeWidth, stroke, delay = 0.1 }: { r: number; cx: number; cy: number; value: number; className?: string; strokeWidth?: number; stroke?: string; delay?: number }) {
  const reduce = useReducedMotion();
  const c = 2 * Math.PI * r;
  const target = c * (1 - Math.max(0, Math.min(1, value)));
  return (
    <motion.circle
      r={r} cx={cx} cy={cy} fill="none" className={className} strokeWidth={strokeWidth} stroke={stroke} strokeLinecap="round"
      strokeDasharray={c}
      initial={{ strokeDashoffset: reduce ? target : c }}
      animate={{ strokeDashoffset: target }}
      transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay }}
    />
  );
}

export function GrowBar({ value, className, style, delay = 0 }: { value: number; className?: string; style?: React.CSSProperties; delay?: number }) {
  const reduce = useReducedMotion();
  const w = `${Math.max(0, Math.min(1, value)) * 100}%`;
  return (
    <motion.div
      className={className} style={style}
      initial={{ width: reduce ? w : "0%" }}
      animate={{ width: w }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay }}
    />
  );
}

/** A soft scan line sweeping over a block while the agent reads it (wrap a relative, overflow-hidden parent). */
export function ScanLine({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`agent-motion-scan pointer-events-none absolute inset-x-0 top-0 h-full [animation:agent-scan_1.8s_cubic-bezier(0.4,0,0.2,1)_infinite] ${className}`}
    >
      <span className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-[#5B3DF5]/15" />
      <span className="absolute inset-x-0 bottom-0 h-px bg-[#5B3DF5]/60" />
    </span>
  );
}

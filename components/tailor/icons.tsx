/** Inline stroke icons for the tailoring screen (design direction: no emoji in UI chrome). */
type P = { className?: string; size?: number };
const Svg = ({ size = 16, className, children, strokeWidth = 2.5 }: P & { children: React.ReactNode; strokeWidth?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{children}</svg>
);

export const CheckIcon = (p: P) => <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
export const SurfaceIcon = (p: P) => <Svg {...p}><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" /><path d="M20 20v-4h-4" /></Svg>;
export const CrossIcon = (p: P) => <Svg {...p}><path d="M7 7l10 10M17 7L7 17" /></Svg>;
export const ShieldCheckIcon = (p: P) => <Svg {...p} strokeWidth={2}><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></Svg>;
export const AlertIcon = (p: P) => <Svg {...p} strokeWidth={2}><path d="M12 3l9.5 17h-19z" /><path d="M12 10v4M12 17.5v.01" /></Svg>;
export const UndoIcon = (p: P) => <Svg {...p} strokeWidth={2}><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></Svg>;
export const PencilIcon = (p: P) => <Svg {...p} strokeWidth={2}><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></Svg>;
export const DownloadIcon = (p: P) => <Svg {...p} strokeWidth={2}><path d="M12 4v11M7 10l5 5 5-5" /><path d="M5 20h14" /></Svg>;
export const QuoteIcon = (p: P) => <Svg {...p} strokeWidth={2}><path d="M7 7h4v4c0 3-1.5 5-4 6M14 7h4v4c0 3-1.5 5-4 6" /></Svg>;
export const ArrowIcon = (p: P) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
export const InfoIcon = (p: P) => <Svg {...p} strokeWidth={2}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.01" /></Svg>;
export const ChatIcon = (p: P) => <Svg {...p} strokeWidth={2}><path d="M4 5h16v11H9l-5 4z" /><path d="M9 10h6" /></Svg>;

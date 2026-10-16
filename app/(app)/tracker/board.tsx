"use client";
import { useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { motion, useDragControls, useReducedMotion, type PanInfo } from "motion/react";
import { ArrowRightLeft, GripVertical } from "lucide-react";
import type { AppStatus } from "@/lib/types";
import { celebrate } from "@/components/reward-toast";
import { COLUMNS, groupByStatus, isAppStatus } from "@/lib/tracker/status";
import { relativeTime } from "@/lib/tracker/summary";
import { DeadlineChip } from "@/components/tracker/deadline-chip";
import { STATUS_COLOR, STATUS_TINT } from "@/components/tracker/status-style";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Nudge } from "@/lib/outreach/nudges";
import { updateStatus } from "./actions";

export type Card = {
  id: string; jobId: string; title: string; company: string; status: AppStatus; updatedAt: string; lastEventAt: string | null;
  deadline: { date: string; label: string; url: string | null } | null;
  nudge: Nudge | null; outreach: { sent: number; replied: number };
};

/** Critically damped: things settle without overshoot. Cards a user throws get a touch of bounce (see whileDrag release). */
const SPRING = { type: "spring", bounce: 0, duration: 0.35 } as const;
const THROW = { type: "spring", bounce: 0.15, duration: 0.4 } as const;

/** The column under a screen point, if any (the dragged card itself is skipped by elementsFromPoint order). */
function columnAt(x: number, y: number): AppStatus | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const key = (el as HTMLElement).dataset?.column;
    if (isAppStatus(key)) return key;
  }
  return null;
}

export function Board({ cards, today, now }: { cards: Card[]; today: string; now: string }) {
  const [, start] = useTransition();
  const [over, setOver] = useState<AppStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [optimistic, move] = useOptimistic(cards, (s, { id, status }: { id: string; status: AppStatus }) =>
    s.map((c) => (c.id === id ? { ...c, status, updatedAt: new Date().toISOString() } : c)));
  const grouped = groupByStatus(optimistic);

  const change = (id: string, status: AppStatus) => {
    if (optimistic.find((c) => c.id === id)?.status === status) return;
    setError(null);
    start(async () => {
      move({ id, status });
      try {
        celebrate(await updateStatus(id, status));
      } catch {
        setError("Couldn't update that application. Try again.");
      }
    });
  };

  return (
    <>
      {error && <p role="alert" className="text-sm font-semibold text-[#B42318]">{error}</p>}
      {/* Below xl: fixed-width columns in a row that scrolls and snaps. Wide screens: all five at once. */}
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 xl:mx-0 xl:grid xl:snap-none xl:grid-cols-5 xl:overflow-visible xl:px-0">
        {COLUMNS.map((col) => {
          const list = grouped[col.key];
          const active = over === col.key;
          return (
            <section
              key={col.key}
              data-column={col.key}
              aria-label={`${col.label}, ${list.length}`}
              className="flex min-h-56 w-[82%] shrink-0 snap-start flex-col gap-2 rounded-[20px] p-2.5 transition-[background-color,box-shadow] duration-150 sm:w-[272px] xl:w-auto"
              style={{
                background: active ? STATUS_TINT[col.key] : "#F4F4F8",
                boxShadow: active ? `inset 0 0 0 2px ${STATUS_COLOR[col.key]}` : "none",
              }}
            >
              <h2 className="flex items-center gap-2 px-1.5 pt-1 text-[13px] font-bold tracking-tight">
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[col.key] }} />
                {col.label}
                <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{list.length}</span>
              </h2>
              {col.key === "rejected" && <p className="px-1.5 text-xs text-muted-foreground">Part of the game: +20 XP for logging it.</p>}
              {list.map((c) => (
                <TrackerCard key={c.id} card={c} today={today} now={now} onHover={setOver} onMove={change} />
              ))}
              {list.length === 0 && (
                <p className="mt-1 rounded-2xl border-2 border-dashed border-[#E2E2EA] px-3 py-5 text-center text-xs text-muted-foreground">
                  Drop a card here
                </p>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

function TrackerCard({ card: c, today, now, onHover, onMove }: {
  card: Card; today: string; now: string; onHover: (s: AppStatus | null) => void; onMove: (id: string, s: AppStatus) => void;
}) {
  const reduce = useReducedMotion();
  const controls = useDragControls();
  const dragged = useRef(false);

  const startDrag = (e: React.PointerEvent) => {
    // Mouse: grab the card anywhere except its links and buttons. Touch and pen use the grip, so swiping still scrolls.
    if (e.pointerType === "mouse" && (e.button !== 0 || (e.target as HTMLElement).closest("a,button"))) return;
    dragged.current = false;
    controls.start(e);
  };
  const onDrag = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) + Math.abs(info.offset.y) > 6) dragged.current = true;
    onHover(columnAt(info.point.x - window.scrollX, info.point.y - window.scrollY));
  };
  const onDragEnd = (_: unknown, info: PanInfo) => {
    const target = columnAt(info.point.x - window.scrollX, info.point.y - window.scrollY);
    onHover(null);
    if (target && target !== c.status) onMove(c.id, target);
  };

  return (
    <motion.article
      layout={!reduce}
      layoutId={reduce ? undefined : c.id}
      transition={SPRING}
      drag
      dragControls={controls}
      dragListener={false}
      dragSnapToOrigin
      dragMomentum={false}
      dragTransition={{ bounceStiffness: 500, bounceDamping: 32 }}
      onDrag={onDrag}
      onDragEnd={onDragEnd}
      whileDrag={reduce ? { zIndex: 50 } : { scale: 1.03, rotate: -1.2, zIndex: 50, boxShadow: "0 18px 40px -12px rgba(26,26,46,.35)", transition: THROW }}
      onPointerDown={startDrag}
      // A drag that ends over a link must not also open it.
      onClickCapture={(e) => { if (dragged.current) { e.preventDefault(); e.stopPropagation(); dragged.current = false; } }}
      className="group relative flex cursor-default flex-col gap-2 rounded-2xl border border-[#E6E6EF] bg-white p-3 shadow-[0_1px_2px_rgba(26,26,46,.06)] md:cursor-grab md:active:cursor-grabbing"
      style={{ touchAction: "pan-y" }}
    >
      <div className="flex items-start gap-2.5">
        <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-sm font-extrabold"
          style={{ background: STATUS_TINT[c.status], color: STATUS_COLOR[c.status] }}>
          {(c.company || c.title).trim().charAt(0).toUpperCase()}
        </span>
        <div className="flex min-w-0 flex-col">
          <Link href={`/jobs/${c.jobId}`} draggable={false} className="line-clamp-2 text-sm font-bold leading-snug tracking-tight text-foreground no-underline hover:underline">
            {c.title}
          </Link>
          <span className="truncate text-xs text-muted-foreground">
            {c.company}{c.company && " · "}<time dateTime={c.updatedAt}>{relativeTime(c.updatedAt, new Date(now))}</time>
          </span>
        </div>
        <button
          type="button"
          aria-label={`Drag ${c.title}`}
          onPointerDown={(e) => { e.stopPropagation(); dragged.current = false; controls.start(e); }}
          className="-mr-1 -mt-0.5 ml-auto hidden h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-[#B4B4C4] hover:bg-[#F4F4F8] hover:text-foreground md:flex"
        >
          <GripVertical className="size-4" />
        </button>
      </div>

      {c.deadline && <DeadlineChip label={c.deadline.label} date={c.deadline.date} today={today} url={c.deadline.url} />}
      {c.nudge && (
        <Link href={`/jobs/${c.jobId}?target=${c.nudge.target}&purpose=${c.nudge.purpose}#people`} draggable={false}
          className="rounded-xl bg-[#F4F2FF] px-2.5 py-2 text-xs font-semibold leading-snug text-[#3A20C4] no-underline">
          {c.nudge.text} →
        </Link>
      )}
      {c.status === "interview" && (
        <Link href={`/jobs/${c.jobId}#prep`} draggable={false} className="text-xs font-semibold text-[#5B3DF5]">Prep for this interview →</Link>
      )}

      <div className="flex items-center gap-2">
        {c.outreach.sent > 0 && (
          <span className="text-xs text-muted-foreground">
            {c.outreach.sent} reached · {c.outreach.replied} repl{c.outreach.replied === 1 ? "y" : "ies"}
          </span>
        )}
        <MoveMenu card={c} onMove={onMove} />
      </div>
    </motion.article>
  );
}

/** Keyboard- and touch-friendly alternative to dragging, anchored to its button. */
function MoveMenu({ card: c, onMove }: { card: Card; onMove: (id: string, s: AppStatus) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Move ${c.title}, now ${COLUMNS.find((k) => k.key === c.status)?.label}`}
        className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-muted-foreground transition-[transform,background-color] duration-100 ease-out hover:bg-[#F4F4F8] hover:text-foreground active:scale-95 data-[popup-open]:bg-[#F4F4F8]"
      >
        <ArrowRightLeft className="size-3.5" /> Move
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 rounded-xl p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 text-xs text-muted-foreground">Move to</DropdownMenuLabel>
          {COLUMNS.map((col) => (
            <DropdownMenuItem key={col.key} disabled={col.key === c.status} onClick={() => onMove(c.id, col.key)}
              className="min-h-9 gap-2 rounded-lg px-2 text-sm">
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[col.key] }} />
              {col.label}
              {col.key === c.status && <span className="ml-auto text-xs text-muted-foreground">Now</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

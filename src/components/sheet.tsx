"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/** Bottom sheet: springs up, drags down to dismiss (follows the finger), Escape closes. */
export function Sheet({ onClose, title, label, children, footer }: { onClose: () => void; title?: React.ReactNode; label: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; t: number; dy: number } | null>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const down = (e: React.PointerEvent) => { drag.current = { y: e.clientY, t: performance.now(), dy: 0 }; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); };
  const move = (e: React.PointerEvent) => {
    const d = drag.current, el = panel.current;
    if (!d || !el) return;
    d.dy = Math.max(0, e.clientY - d.y);
    el.style.transition = "none";
    el.style.transform = `translateY(${d.dy}px)`;
  };
  const up = () => {
    const d = drag.current, el = panel.current;
    drag.current = null;
    if (!d || !el) return;
    const v = d.dy / Math.max(1, performance.now() - d.t);
    el.style.transition = "transform 240ms cubic-bezier(.2,.8,.2,1)";
    if (d.dy > el.offsetHeight * 0.3 || v > 0.8) { el.style.transform = "translateY(100%)"; setTimeout(onClose, 200); }
    else el.style.transform = "";
  };
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[60]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div ref={panel} role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}
        className="sheet-spring absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-2xl border-t border-[var(--border)] bg-surface shadow-[0_-12px_40px_rgb(0_0_0/.45)] md:inset-x-auto md:left-1/2 md:w-[440px] md:-translate-x-1/2">
        <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} className="shrink-0 cursor-grab touch-none px-4 pb-2 pt-2">
          <div className="mx-auto h-1 w-10 rounded-full bg-[var(--surface-3)]" />
          {title && <div className="mt-3 text-center text-[17px] font-bold text-[var(--header)]">{title}</div>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">{children}</div>
        {footer && <div className="shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

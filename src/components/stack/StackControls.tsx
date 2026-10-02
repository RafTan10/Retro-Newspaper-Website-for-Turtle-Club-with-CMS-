import { useEffect, useRef, type ReactNode, type TouchEvent } from "react";
import { SWIPE } from "../motion";
import { KeyButton } from "../ui/KeyButton";
import { ArrowLeftIcon, ArrowRightIcon } from "../ui/icons";
import styles from "./StackControls.module.css";

type StackControlsProps = {
  onPrev: () => void;
  onNext: () => void;
  /** Turn off keyboard and swipe handling, e.g. while the reader is open */
  enabled?: boolean;
  children: ReactNode;
};

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function StackControls({ onPrev, onNext, enabled = true, children }: StackControlsProps) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || isTypingTarget(e.target)) {
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPrev();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, onNext, onPrev]);

  function handleTouchStart(e: TouchEvent) {
    if (!enabled || e.touches.length !== 1) return;
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }

  function handleTouchEnd(e: TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!enabled || !start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE.minDistance || Math.abs(dx) < Math.abs(dy) * SWIPE.dominance) return;
    // Flick the top paper away to the left to see the next one
    if (dx < 0) onNext();
    else onPrev();
  }

  return (
    <div className={styles.controls} data-paused={!enabled || undefined}>
      <KeyButton label="Previous paper" className={styles.prev} onClick={onPrev}>
        <ArrowLeftIcon />
      </KeyButton>
      <div
        className={styles.stage}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => (touchStart.current = null)}
      >
        {children}
      </div>
      <KeyButton label="Next paper" className={styles.next} onClick={onNext}>
        <ArrowRightIcon />
      </KeyButton>
    </div>
  );
}

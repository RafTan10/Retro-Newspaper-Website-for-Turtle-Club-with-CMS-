import { motion, useReducedMotion, type TargetAndTransition } from "framer-motion";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { langFor } from "../../lib/bangla";
import type { Issue } from "../../types";
import { READER } from "../motion";
import { NewspaperCover } from "../stack/NewspaperCover";
import { KeyButton } from "../ui/KeyButton";
import { ArrowLeftIcon, ArrowRightIcon, CloseIcon } from "../ui/icons";
import { PAPER_ASPECT, type PaperOrigin } from "./origin";
import { PageTurn } from "./PageTurn";
import { ReaderPage } from "./ReaderPage";
import styles from "./ReaderOverlay.module.css";

type ReaderOverlayProps = {
  issue: Issue;
  /** Where the paper sits in the stack right now */
  getOrigin: () => PaperOrigin;
  /** Called after the paper has gone back into the stack */
  onClosed: () => void;
};

type Layout = { width: number; height: number; cx: number; cy: number; narrow: boolean };

const NARROW = 640;

function measureLayout(): Layout {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (vw <= NARROW) {
    // Phones: the page gets the full width and most of the height; the close
    // key sits above it and the page keys below.
    const width = vw - 24;
    const height = Math.max(width / PAPER_ASPECT, Math.min(vh - 190, width * 1.5));
    return { width, height, cx: vw / 2, cy: 80 + height / 2, narrow: true };
  }
  // Wider screens: a landscape page like the papers in the stack, keys either side
  const width = Math.min(vw - 200, 1040, (vh - 120) * PAPER_ASPECT);
  return { width, height: width / PAPER_ASPECT, cx: vw / 2, cy: vh / 2, narrow: false };
}

function useReaderLayout() {
  const [layout, setLayout] = useState(measureLayout);
  useEffect(() => {
    const onResize = () => setLayout(measureLayout());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return layout;
}

/**
 * The pose that makes the reader page sit exactly on top of the paper in the
 * stack: same center, width, and tilt. On a taller reader page the extra
 * height is clipped away so it starts as the same landscape shape.
 */
function poseAt(origin: PaperOrigin, layout: Layout): TargetAndTransition {
  const crop = Math.max(0, (layout.height - layout.width / PAPER_ASPECT) / 2);
  return {
    x: origin.cx - layout.cx,
    y: origin.cy - layout.cy,
    scale: origin.width / layout.width,
    rotate: origin.rotate,
    clipPath: `inset(${crop}px 0px ${crop}px 0px)`,
    opacity: 1,
  };
}

const centered: TargetAndTransition = {
  x: 0,
  y: 0,
  scale: 1,
  rotate: 0,
  clipPath: "inset(0px 0px 0px 0px)",
  opacity: 1,
};

const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function ReaderOverlay({ issue, getOrigin, onClosed }: ReaderOverlayProps) {
  const reduceMotion = useReducedMotion();
  const layout = useReaderLayout();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Captured once on creation (not in the effect, which StrictMode runs twice)
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  const [startPose] = useState(() => poseAt(getOrigin(), measureLayout()));
  const [closingPose, setClosingPose] = useState<TargetAndTransition | null>(null);
  const closing = closingPose !== null;

  const pages = issue.pages;
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [turning, setTurning] = useState(false);

  const close = useCallback(() => {
    if (closing) return;
    setClosingPose(reduceMotion ? { opacity: 0 } : poseAt(getOrigin(), layout));
  }, [closing, reduceMotion, getOrigin, layout]);

  // One page turn at a time
  const turn = useCallback(
    (dir: 1 | -1) => {
      const target = index + dir;
      if (closing || turning || target < 0 || target >= pages.length) return;
      setDirection(dir);
      setTurning(true);
      setIndex(target);
    },
    [closing, turning, index, pages.length],
  );

  // Focus moves into the dialog on open and back to the paper on close
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      opener?.focus({ preventScroll: true });
    };
  }, [opener]);

  // Preload the next page's photo
  useEffect(() => {
    const next = pages[index + 1];
    if (next?.type === "photo") new Image().src = next.image;
  }, [pages, index]);

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      turn(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      turn(-1);
    } else if (e.key === "Tab") {
      // Keep focus inside the dialog
      const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  const page = pages[index];
  const atStart = index === 0;
  const atEnd = index === pages.length - 1;
  const cropTop = Math.max(0, (layout.height - layout.width / PAPER_ASPECT) / 2);

  return (
    <div
      ref={dialogRef}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
      style={
        {
          "--reader-w": `${layout.width}px`,
          "--reader-h": `${layout.height}px`,
          "--reader-cy": `${layout.cy}px`,
        } as CSSProperties
      }
      data-narrow={layout.narrow || undefined}
    >
      <motion.div
        className={styles.backdrop}
        initial={{ opacity: 0 }}
        animate={{ opacity: closing ? 0 : READER.backdropOpacity }}
        transition={READER.backdrop}
        onClick={close}
        aria-hidden="true"
      />

      <motion.div
        className={styles.frame}
        data-shot="reader-page"
        style={{
          width: layout.width,
          height: layout.height,
          left: layout.cx - layout.width / 2,
          top: layout.cy - layout.height / 2,
        }}
        initial={reduceMotion ? { ...centered, opacity: 0 } : startPose}
        animate={closingPose ?? centered}
        transition={reduceMotion ? READER.fade : closing ? READER.close : READER.open}
        onAnimationComplete={() => closing && onClosed()}
      >
        <div className={styles.sheet}>
          <header className={styles.strip}>
            <span className={styles.masthead} lang={langFor(issue.masthead)}>
              {issue.masthead}
            </span>
            <span className={styles.folio}>
              Issue {issue.issueNumber}, {formatDate(issue.date)}
            </span>
          </header>
          <div className={styles.content}>
            {page ? (
              <PageTurn pageKey={page.id} direction={direction} onTurned={() => setTurning(false)}>
                <ReaderPage page={page} />
              </PageTurn>
            ) : (
              <p className={styles.empty}>This issue has no pages yet.</p>
            )}
          </div>

          <footer className={styles.footer}>
            <h2 id={titleId} className={styles.title} lang={langFor(issue.headline)}>
              {issue.headline}
            </h2>
            <span className={styles.indicator} aria-live="polite">
              Page {pages.length ? index + 1 : 0} of {pages.length}
            </span>
          </footer>
        </div>

        {/* The cover the reader grew from; it gives way to page one, and returns on close */}
        {!reduceMotion && (
          <motion.div
            className={styles.cover}
            initial={{ opacity: 1 }}
            animate={{ opacity: closing ? 1 : 0 }}
            transition={closing ? READER.coverIn : READER.coverOut}
            aria-hidden="true"
          >
            <div className={styles.coverPaper} style={{ top: cropTop }}>
              <NewspaperCover issue={issue} priority />
            </div>
          </motion.div>
        )}
      </motion.div>

      <motion.div
        className={styles.controls}
        initial={{ opacity: 0 }}
        animate={{ opacity: closing ? 0 : 1 }}
        transition={closing ? READER.controlsOut : READER.controlsIn}
      >
        <KeyButton ref={closeRef} label="Close paper" className={styles.close} onClick={close}>
          <CloseIcon />
        </KeyButton>
        <KeyButton
          label="Previous page"
          className={styles.prev}
          aria-disabled={atStart}
          onClick={() => turn(-1)}
        >
          <ArrowLeftIcon />
        </KeyButton>
        <KeyButton
          label="Next page"
          className={styles.next}
          aria-disabled={atEnd}
          onClick={() => turn(1)}
        >
          <ArrowRightIcon />
        </KeyButton>
      </motion.div>
    </div>
  );
}

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" });

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return dateFormat.format(new Date(y, m - 1, d));
}

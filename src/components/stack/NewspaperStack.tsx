import { motion, useReducedMotion, type TargetAndTransition, type Transition } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Issue } from "../../types";
import type { PaperOrigin } from "../reader/origin";
import { CURL, SHADOW, STACK, STACK_TRANSITION } from "../motion";
import { NewspaperCover } from "./NewspaperCover";
import { PaperCurl } from "./PaperCurl";
import { StackControls } from "./StackControls";
import styles from "./NewspaperStack.module.css";

type Direction = "next" | "prev";

/**
 * A move runs through phases, one animation each:
 *   next:    lift -> away -> (paper goes to the bottom) -> settle
 *   prev:    away (out from under) -> (paper goes to the top) -> settle
 *   reduced: fade -> (reorder) -> settle as a fade in
 */
type Phase = "lift" | "away" | "fade" | "settle";
type Move = { id: string; dir: Direction; phase: Phase };

type Pose = { x: number; y: number; rotate: number };

// Small deterministic PRNG so each paper's tilt is stable between renders.
function seededRandom(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poseFor(id: string): Pose {
  const rand = seededRandom(id);
  const spread = (max: number) => (rand() * 2 - 1) * max;
  return {
    rotate: spread(STACK.maxTiltDeg),
    x: spread(STACK.maxOffsetX),
    y: spread(STACK.maxOffsetY),
  };
}

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.offsetWidth);
    const observer = new ResizeObserver(() => setWidth(el.offsetWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

type NewspaperStackProps = {
  issues: Issue[];
  /** Open the top paper; getOrigin reports where it sits in the stack */
  onOpen: (issue: Issue, getOrigin: () => PaperOrigin) => void;
  /** The paper currently lifted out into the reader, hidden from the pile */
  openId?: string | null;
};

export function NewspaperStack({ issues, onOpen, openId = null }: NewspaperStackProps) {
  const reduceMotion = useReducedMotion();
  const [order, setOrder] = useState(() => issues.map((i) => i.id));
  const [move, setMove] = useState<Move | null>(null);
  const [pileRef, paperWidth] = useElementWidth<HTMLDivElement>();

  const byId = useMemo(() => new Map(issues.map((i) => [i.id, i])), [issues]);
  const poses = useMemo(() => new Map(issues.map((i) => [i.id, poseFor(i.id)])), [issues]);

  // One animation at a time: input is ignored while a move is running.
  const go = useCallback(
    (dir: Direction) => {
      if (move || order.length < 2) return;
      const id = dir === "next" ? order[0] : order[order.length - 1];
      const phase: Phase = reduceMotion ? "fade" : dir === "next" ? "lift" : "away";
      setMove({ id, dir, phase });
    },
    [move, order, reduceMotion],
  );

  const next = useCallback(() => go("next"), [go]);
  const prev = useCallback(() => go("prev"), [go]);

  // Called when the moving paper finishes a phase. The ref guards against a
  // phase being reported twice before the next render.
  const handled = useRef<Move | null>(null);
  const advance = useCallback(
    (finished: Phase) => {
      if (!move || move.phase !== finished || handled.current === move) return;
      handled.current = move;
      if (finished === "lift") {
        setMove({ ...move, phase: "away" });
      } else if (finished === "away" || finished === "fade") {
        setOrder((o) =>
          move.dir === "next" ? [...o.slice(1), o[0]] : [o[o.length - 1], ...o.slice(0, -1)],
        );
        setMove({ ...move, phase: "settle" });
      } else {
        setMove(null);
      }
    },
    [move],
  );

  const getOrigin = useCallback(
    (id: string): PaperOrigin => {
      const rect = pileRef.current!.getBoundingClientRect();
      const pose = poses.get(id)!;
      return {
        cx: rect.left + rect.width / 2 + pose.x,
        cy: rect.top + rect.height / 2 + pose.y,
        width: rect.width,
        rotate: pose.rotate,
      };
    },
    [pileRef, poses],
  );

  function open(issue: Issue) {
    if (move) return;
    onOpen(issue, () => getOrigin(issue.id));
  }

  // Opening the reader starts on page one: fetch its photo while the paper is on top
  const topId = order[0];
  useEffect(() => {
    const first = byId.get(topId)?.pages[0];
    if (first?.type === "photo" && first.image) new Image().src = first.image;
  }, [topId, byId]);

  // A spring takes far longer to come fully to rest than it takes to look
  // landed, so input unlocks early in the landing rather than at its end.
  useEffect(() => {
    if (move?.phase !== "settle") return;
    const timer = window.setTimeout(() => advance("settle"), STACK.settleLockMs);
    return () => window.clearTimeout(timer);
  }, [move, advance]);

  function targetFor(id: string): {
    animate: TargetAndTransition;
    transition: Transition;
    /** How bent the held edge is, 0 to 1 */
    bend: number;
  } {
    const pose = poses.get(id)!;
    const rest: TargetAndTransition = {
      x: pose.x,
      y: pose.y,
      rotate: pose.rotate,
      rotateX: 0,
      rotateY: 0,
      scale: 1,
      opacity: 1,
      boxShadow: SHADOW.rest,
    };

    if (!move || move.id !== id) {
      return {
        animate: rest,
        transition: reduceMotion ? STACK_TRANSITION.fadeIn : STACK_TRANSITION.shift,
        bend: 0,
      };
    }

    // Next and previous share one path, run in opposite directions: the top
    // paper is carried off to one side and tucked under; previous pulls it back.
    const side = STACK.carrySide;
    switch (move.phase) {
      case "lift":
        return {
          animate: {
            ...rest,
            y: pose.y - STACK.liftY,
            rotateX: STACK.liftRotateX,
            rotateY: side * -STACK.liftRotateY,
            scale: STACK.liftScale,
            boxShadow: SHADOW.lifted,
          },
          transition: STACK_TRANSITION.lift,
          bend: CURL.bend.lift,
        };
      case "away":
        return {
          animate: {
            x: side * paperWidth * STACK.awayX,
            y: pose.y - STACK.awayY,
            rotate: pose.rotate + side * STACK.awayTiltDeg,
            rotateX: STACK.liftRotateX,
            rotateY: side * -STACK.awayRotateY,
            scale: STACK.liftScale,
            opacity: 1,
            boxShadow: SHADOW.lifted,
          },
          transition: STACK_TRANSITION.away,
          bend: CURL.bend.away,
        };
      case "fade":
        return { animate: { ...rest, opacity: 0 }, transition: STACK_TRANSITION.fade, bend: 0 };
      case "settle":
        return {
          animate: rest,
          transition: reduceMotion ? STACK_TRANSITION.fadeIn : STACK_TRANSITION.settle,
          bend: 0,
        };
    }
  }

  const top = byId.get(order[0]);
  const position = top ? issues.indexOf(top) + 1 : 0;

  return (
    <section className={styles.wrap} aria-roledescription="newspaper stack" aria-label="Newspapers">
      <StackControls onPrev={prev} onNext={next} enabled={openId === null}>
        <div ref={pileRef} className={styles.pile} data-shot="stack">
          {order.map((id, depth) => {
            const issue = byId.get(id);
            if (!issue) return null;
            const { animate, transition, bend } = targetFor(id);
            const isMoving = move?.id === id;
            const isTop = depth === 0;
            const shade = isTop ? 0 : STACK.lowerShade;
            // Only the papers that can move next (top and bottom) carry the
            // bendable copy, so it is already mounted and loaded when needed.
            const canCurl =
              !reduceMotion && (isMoving || depth === 0 || depth === order.length - 1);
            const curling = canCurl && isMoving;
            // The next paper (second) and the previous one (bottom) load right away
            const cover = (
              <NewspaperCover
                issue={issue}
                important={isTop}
                priority={depth < 2 || depth === order.length - 1}
              />
            );
            return (
              <motion.div
                key={id}
                className={styles.paper}
                style={{
                  zIndex: order.length - depth,
                  transformPerspective: STACK.perspective,
                }}
                initial={false}
                animate={animate}
                transition={transition}
                onAnimationComplete={isMoving ? () => advance(move.phase) : undefined}
                aria-hidden={!isTop}
              >
                {/* Hidden while lifted into the reader. Set on this plain element, not the
                    motion one, so it updates in the same commit and focus can return to it. */}
                <div
                  className={styles.sheet}
                  style={{ perspective: CURL.perspective, visibility: id === openId ? "hidden" : undefined }}
                >
                  {/* While bending, the flat sheet gives up its right part to the curl */}
                  <div
                    className={styles.flat}
                    style={curling ? { clipPath: `inset(0 calc(${CURL.region * 100}% - 1px) 0 0)` } : undefined}
                  >
                    {cover}
                    <motion.div
                      className={styles.shade}
                      initial={false}
                      animate={{ opacity: shade }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  {canCurl && (
                    <PaperCurl bend={bend} transition={transition} visible={curling} shade={shade}>
                      {cover}
                    </PaperCurl>
                  )}
                  {isTop && (
                    <button
                      type="button"
                      className={styles.open}
                      data-shot="top-paper"
                      aria-label={`Open: ${issue.headline}`}
                      onClick={() => open(issue)}
                    />
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </StackControls>

      {top && (
        <p className={styles.indicator} aria-live="polite">
          <span className="visually-hidden">{top.headline}. </span>
          Paper {position} of {issues.length}
        </p>
      )}
    </section>
  );
}

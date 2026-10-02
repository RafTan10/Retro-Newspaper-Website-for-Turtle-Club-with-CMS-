import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";
import { PAGE_TURN } from "../motion";
import styles from "./PageTurn.module.css";

type PageTurnProps = {
  /** Changes whenever the page changes */
  pageKey: string;
  /** 1 turns forward, -1 turns back */
  direction: 1 | -1;
  /** Called once the turn has finished */
  onTurned: () => void;
  children: ReactNode;
};

const turn = { duration: PAGE_TURN.duration, ease: PAGE_TURN.ease };
// The turning page holds its ink, then fades as it lifts away
const fadeAway = { ...turn, times: [0, 0.55, 1] };

/*
 * Forward: the current page turns on its left edge and lifts away, revealing
 * the next page already lying underneath.
 * Back: the previous page turns back down on top of the current one.
 */
const turnVariants: Variants = {
  enter: (dir: number) =>
    dir > 0 ? { rotateY: 0, opacity: 1, zIndex: 1 } : { rotateY: PAGE_TURN.angle, opacity: 0, zIndex: 2 },
  center: (dir: number) => ({
    rotateY: 0,
    opacity: 1,
    zIndex: dir > 0 ? 1 : 2,
    transition: { ...turn, opacity: { ...turn, duration: PAGE_TURN.duration * 0.6 } },
  }),
  exit: (dir: number) =>
    dir > 0
      ? { rotateY: PAGE_TURN.angle, opacity: [1, 1, 0], zIndex: 2, transition: { rotateY: turn, opacity: fadeAway } }
      : // Stays put under the incoming page until the turn is done
        { opacity: [1, 1], zIndex: 1, transition: turn },
};

const sweepVariants: Variants = {
  enter: (dir: number) =>
    dir > 0 ? { opacity: 0 } : { opacity: PAGE_TURN.shadow, backgroundPosition: "0% 0%" },
  center: { opacity: 0, backgroundPosition: "100% 0%", transition: turn },
  exit: (dir: number) =>
    dir > 0
      ? { opacity: PAGE_TURN.shadow, backgroundPosition: ["100% 0%", "0% 0%"], transition: turn }
      : { opacity: 0 },
};

const fadeVariants: Variants = {
  enter: { opacity: 0, zIndex: 2 },
  center: { opacity: 1, zIndex: 2, transition: { duration: 0.2 } },
  exit: { opacity: [1, 1], zIndex: 1, transition: { duration: 0.2 } },
};

export function PageTurn({ pageKey, direction, onTurned, children }: PageTurnProps) {
  const reduceMotion = useReducedMotion();
  return (
    <div className={styles.stage} style={{ perspective: PAGE_TURN.perspective }}>
      <AnimatePresence initial={false} custom={direction} onExitComplete={onTurned}>
        <motion.div
          key={pageKey}
          className={styles.page}
          custom={direction}
          variants={reduceMotion ? fadeVariants : turnVariants}
          initial="enter"
          animate="center"
          exit="exit"
        >
          {children}
          {!reduceMotion && <motion.div className={styles.sweep} custom={direction} variants={sweepVariants} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

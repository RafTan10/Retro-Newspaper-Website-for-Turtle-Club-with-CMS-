import { motion, type Transition } from "framer-motion";
import type { ReactNode } from "react";
import { CURL } from "../motion";
import styles from "./PaperCurl.module.css";

type PaperCurlProps = {
  /** 0 is flat, 1 is fully bent */
  bend: number;
  transition: Transition;
  /** Shown only while the paper is being moved; otherwise the flat sheet shows */
  visible: boolean;
  /** Opacity of the lower-paper shade, matched to the flat sheet */
  shade: number;
  children: ReactNode;
};

const start = 1 - CURL.region;
const segWidth = CURL.region / CURL.segments;
// Each strip turns a little more than the one before it: weights 1, 2, 3...
const weightSum = (CURL.segments * (CURL.segments + 1)) / 2;
const cqi = (fraction: number) => `${fraction * 100}cqi`;

/**
 * The right-hand part of a paper, bent where a hand holds it. Renders copies of
 * the cover sliced into strips; each strip hinges on the right edge of the
 * previous one so the turns add up into a curve.
 */
export function PaperCurl({ bend, transition, visible, shade, children }: PaperCurlProps) {
  let strips: ReactNode = null;
  for (let i = CURL.segments - 1; i >= 0; i--) {
    const turn = (-bend * CURL.edgeDeg * (i + 1)) / weightSum;
    // One smooth highlight across the curve, brighter toward the held edge
    const light = bend * CURL.edgeLight * ((i + 1) / CURL.segments) ** 1.5;
    strips = (
      <motion.div
        className={styles.strip}
        style={{ left: cqi(i === 0 ? start : segWidth), width: cqi(segWidth) }}
        initial={false}
        animate={{ rotateY: turn }}
        transition={transition}
      >
        <div className={styles.face}>
          <div className={styles.slice} style={{ left: cqi(-(start + i * segWidth)) }}>
            {children}
          </div>
          <motion.div
            className={styles.light}
            initial={false}
            animate={{ opacity: light }}
            transition={transition}
          />
          <motion.div
            className={styles.shade}
            initial={false}
            animate={{ opacity: shade }}
            transition={{ duration: 0.3 }}
          />
        </div>
        {strips}
      </motion.div>
    );
  }

  return (
    <div className={styles.curl} style={{ visibility: visible ? "visible" : "hidden" }} aria-hidden="true">
      {strips}
    </div>
  );
}

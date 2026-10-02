import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { PaperOrigin } from "./components/reader/origin";
import { ReaderOverlay } from "./components/reader/ReaderOverlay";
import { NewspaperStack } from "./components/stack/NewspaperStack";
import { getIssues, isConnected } from "./data/issues";
import type { Issue } from "./types";
import styles from "./HomePage.module.css";

type Load = { state: "loading" } | { state: "failed"; detail: string } | { state: "ready"; issues: Issue[] };

export function HomePage() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [reading, setReading] = useState<{ issue: Issue; getOrigin: () => PaperOrigin } | null>(null);

  const fetchIssues = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoad({ state: "loading" });
    try {
      const issues = await getIssues();
      if (!signal?.cancelled) setLoad({ state: "ready", issues });
    } catch (err) {
      if (!signal?.cancelled) setLoad({ state: "failed", detail: err instanceof Error ? err.message : "" });
    }
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };
    fetchIssues(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [fetchIssues]);

  return (
    <main className={styles.page}>
      <h1 className="visually-hidden">Turtle Club newspapers</h1>

      {load.state === "loading" && <LoadingPile />}

      {load.state === "failed" && (
        <div className={styles.state} role="alert">
          <BlankPaper />
          <p className={styles.message}>The papers couldn’t be loaded.</p>
          <p className={styles.sub}>Check your connection, then try again.</p>
          {load.detail && <p className={styles.detail}>{load.detail}</p>}
          <button type="button" className={styles.retry} onClick={() => fetchIssues()}>
            Try again
          </button>
        </div>
      )}

      {load.state === "ready" && load.issues.length === 0 && <EmptyStack />}

      {load.state === "ready" && load.issues.length > 0 && (
        <NewspaperStack
          key={load.issues.map((i) => i.id).join()}
          issues={load.issues}
          openId={reading?.issue.id ?? null}
          onOpen={(issue, getOrigin) => setReading({ issue, getOrigin })}
        />
      )}
      {reading && (
        <ReaderOverlay issue={reading.issue} getOrigin={reading.getOrigin} onClosed={() => setReading(null)} />
      )}
    </main>
  );
}

/** Blank sheets in the stack's footprint while the papers load */
function LoadingPile() {
  return (
    <div className={styles.state} role="status">
      <div className={styles.pile} aria-hidden="true">
        <span className={styles.sheet} style={{ transform: "rotate(-3deg) translate(-6px, 6px)" }} />
        <span className={styles.sheet} style={{ transform: "rotate(2deg) translate(8px, -4px)" }} />
        <span className={`${styles.sheet} ${styles.top}`} style={{ transform: "rotate(-1deg)" }} />
      </div>
      <p className={styles.sub}>Fetching the papers…</p>
    </div>
  );
}

function BlankPaper() {
  return (
    <div className={`${styles.pile} ${styles.small}`} aria-hidden="true">
      <span className={`${styles.sheet} ${styles.outline}`} style={{ transform: "rotate(-2deg)" }} />
    </div>
  );
}

/**
 * Nothing published. Editors get a way into the press room; in mock mode
 * anyone can open the CMS, so everyone sees the link.
 */
function EmptyStack() {
  const [isEditor, setIsEditor] = useState(!isConnected);

  useEffect(() => {
    if (!isConnected) return;
    let active = true;
    import("./data/auth").then(({ getEditor }) =>
      getEditor().then((editor) => active && setIsEditor(Boolean(editor))),
    );
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className={styles.state} data-shot="empty-stack">
      <BlankPaper />
      <p className={styles.message}>No issues published yet.</p>
      {isEditor ? (
        <Link to="/admin" className={styles.link}>
          Open the press room to publish one
        </Link>
      ) : (
        <p className={styles.sub}>Check back soon.</p>
      )}
    </div>
  );
}

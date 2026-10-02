import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { getEditor, onSignedOut, signOut, type Editor } from "../data/auth";
import { isConnected } from "../data/issues";
import { Login } from "./Login";
import { Button } from "./ui/Button";
import styles from "./AdminLayout.module.css";

type Gate = { state: "checking" } | { state: "signed-out" } | { state: "in"; editor: Editor | null };

/**
 * The CMS frame. With Supabase connected, only editors listed in the admins
 * table get past the sign-in. Without it, the CMS opens straight away and says
 * plainly that nothing is saved.
 */
export function AdminLayout() {
  const [gate, setGate] = useState<Gate>(isConnected ? { state: "checking" } : { state: "in", editor: null });

  useEffect(() => {
    if (!isConnected) return;
    let active = true;
    getEditor().then((editor) => active && setGate(editor ? { state: "in", editor } : { state: "signed-out" }));
    const unsubscribe = onSignedOut(() => active && setGate({ state: "signed-out" }));
    return () => {
      active = false;
      unsubscribe.then((stop) => stop());
    };
  }, []);

  useEffect(() => {
    document.title = "Press room, Turtle Club";
    document.body.dataset.surface = "paper";
    return () => {
      delete document.body.dataset.surface;
      document.title = "Turtle Club";
    };
  }, []);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link to="/admin" className={styles.brand}>
          <span className={styles.masthead}>Turtle Club</span>
          <span className={styles.room}>press room</span>
        </Link>
        <nav className={styles.nav} aria-label="Press room">
          <Link to="/" className={styles.link}>
            View site
          </Link>
          {gate.state === "in" && gate.editor && (
            <Button size="sm" variant="quiet" onClick={() => signOut().then(() => setGate({ state: "signed-out" }))}>
              Sign out
            </Button>
          )}
        </nav>
      </header>

      {!isConnected && (
        <p className={styles.notice} role="note" data-shot="notice">
          <strong>Not connected to a database. Changes are not saved.</strong> Edits last until you reload this page,
          and show on the public stack in this browser so you can preview them.
        </p>
      )}

      <main className={styles.main}>
        {gate.state === "checking" && <p className={styles.status}>Checking your sign-in…</p>}
        {gate.state === "signed-out" && <Login onSignedIn={(editor) => setGate({ state: "in", editor })} />}
        {gate.state === "in" && <Outlet />}
      </main>
    </div>
  );
}

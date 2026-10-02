import { useState, type FormEvent } from "react";
import { signIn, type Editor } from "../data/auth";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import styles from "./Login.module.css";

export function Login({ onSignedIn }: { onSignedIn: (editor: Editor) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onSignedIn(await signIn(email.trim(), password));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in. Try again.");
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate data-shot="login">
      <h1 className={styles.title}>Sign in to the press room</h1>
      <p className={styles.intro}>Only Turtle Club editors can sign in here.</p>
      <Field label="Email" type="email" autoComplete="email" inputMode="email" value={email} onValue={setEmail} />
      <Field
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onValue={setPassword}
      />
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

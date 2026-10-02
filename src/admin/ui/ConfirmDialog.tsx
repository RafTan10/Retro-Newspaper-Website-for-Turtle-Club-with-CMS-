import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import styles from "./ConfirmDialog.module.css";

type ConfirmDialogProps = {
  title: string;
  children?: ReactNode;
  /** Buttons; the one marked data-autofocus gets focus when the dialog opens */
  actions: ReactNode;
  onCancel: () => void;
};

/** A small modal for confirmations. Escape and the backdrop cancel. */
export function ConfirmDialog({ title, children, actions, onCancel }: ConfirmDialogProps) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const target =
      ref.current?.querySelector<HTMLElement>("[data-autofocus]") ?? ref.current?.querySelector<HTMLElement>("button");
    target?.focus();
    return () => opener?.focus();
  }, []);

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if (e.key === "Tab") {
      const items = Array.from(ref.current?.querySelectorAll<HTMLElement>("button, [href], input") ?? []);
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  }

  return (
    <div className={styles.overlay} onKeyDown={handleKeyDown}>
      <div className={styles.backdrop} onClick={onCancel} aria-hidden="true" />
      <div ref={ref} className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {children && <div className={styles.body}>{children}</div>}
        <div className={styles.actions}>{actions}</div>
      </div>
    </div>
  );
}

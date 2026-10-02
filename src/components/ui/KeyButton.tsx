import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import styles from "./KeyButton.module.css";

type KeyButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  /** Accessible name; required because most keycaps only hold an icon */
  label: string;
  size?: "md" | "lg";
  children: ReactNode;
};

export const KeyButton = forwardRef<HTMLButtonElement, KeyButtonProps>(function KeyButton(
  { label, size = "md", className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={[styles.key, styles[size], className].filter(Boolean).join(" ")}
      {...rest}
    >
      <span className={styles.cap}>{children}</span>
    </button>
  );
});

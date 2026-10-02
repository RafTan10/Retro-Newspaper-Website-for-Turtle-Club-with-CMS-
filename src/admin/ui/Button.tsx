import { forwardRef, type ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "plain" | "primary" | "danger" | "quiet";
  size?: "md" | "sm";
};

/** A typewriter-key button with a text label */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "plain", size = "md", className, type = "button", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={[styles.key, styles[variant], styles[size], className].filter(Boolean).join(" ")}
      {...rest}
    >
      <span className={styles.cap}>{children}</span>
    </button>
  );
});

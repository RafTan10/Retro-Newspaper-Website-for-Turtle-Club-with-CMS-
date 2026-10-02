import {
  useId,
  useState,
  type ClipboardEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { langFor } from "../../lib/bangla";
import { BIJOY_WARNING, looksLikeBijoy } from "../../lib/richText";
import styles from "./Field.module.css";

type Common = {
  label: string;
  hint?: ReactNode;
  error?: string;
  /** Called with the new text */
  onValue: (value: string) => void;
};

type InputProps = Common & Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & { multiline?: false };
type AreaProps = Common & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> & { multiline: true };

/**
 * A labelled field typed on paper. Refuses pastes of legacy Bijoy text, and
 * sets lang="bn" when the value is mainly Bangla.
 */
export function Field(props: InputProps | AreaProps) {
  const { label, hint, error, onValue, multiline, ...rest } = props;
  const id = useId();
  const [bijoy, setBijoy] = useState(false);
  const value = String(rest.value ?? "");
  const message = error ?? (bijoy ? BIJOY_WARNING : undefined);
  const describedBy = [hint && `${id}-hint`, message && `${id}-msg`].filter(Boolean).join(" ") || undefined;

  function handlePaste(e: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const isBijoy = looksLikeBijoy(e.clipboardData.getData("text/plain"));
    if (isBijoy) e.preventDefault();
    setBijoy(isBijoy);
  }

  const shared = {
    id,
    className: styles.input,
    lang: langFor(value),
    "aria-invalid": message ? true : undefined,
    "aria-describedby": describedBy,
    onPaste: handlePaste,
  };

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {multiline ? (
        <textarea
          {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          {...shared}
          onChange={(e) => onValue(e.target.value)}
        />
      ) : (
        <input
          {...(rest as InputHTMLAttributes<HTMLInputElement>)}
          {...shared}
          onChange={(e) => onValue(e.target.value)}
        />
      )}
      {hint && (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      {message && (
        <p id={`${id}-msg`} className={styles.error} role="alert">
          {message}
        </p>
      )}
    </div>
  );
}

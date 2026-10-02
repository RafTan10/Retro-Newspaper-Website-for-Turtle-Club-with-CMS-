import { useId, useRef, useState } from "react";
import { uploadImage } from "../data/issues";
import { Halftone } from "../components/ui/Halftone";
import { Button } from "./ui/Button";
import styles from "./ImageField.module.css";

type ImageFieldProps = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  error?: string;
  /** Show a "Remove photo" button (the cover image is optional) */
  removable?: boolean;
};

type Upload = { state: "idle" } | { state: "uploading"; progress: number } | { state: "failed"; message: string };

/**
 * Photo picker. On phones, accept="image/*" offers the camera or the gallery.
 * The photo is resized in the browser before it uploads.
 */
export function ImageField({ label, value, onChange, error, removable = false }: ImageFieldProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const lastFile = useRef<File | null>(null);
  const [upload, setUpload] = useState<Upload>({ state: "idle" });

  async function start(file: File) {
    lastFile.current = file;
    setUpload({ state: "uploading", progress: 0 });
    try {
      const url = await uploadImage(file, (progress) => setUpload({ state: "uploading", progress }));
      onChange(url);
      setUpload({ state: "idle" });
    } catch (err) {
      setUpload({
        state: "failed",
        message: err instanceof Error ? err.message : "The upload failed. Try again.",
      });
    }
  }

  const uploading = upload.state === "uploading";
  const percent = uploading ? Math.round(upload.progress * 100) : 0;

  return (
    <div className={styles.field}>
      <span className={styles.label} id={`${id}-label`}>
        {label}
      </span>
      <div className={styles.preview} data-empty={!value || undefined}>
        {value ? <Halftone src={value} alt="" className={styles.image} /> : <span>No photo yet</span>}
      </div>

      <input
        ref={input}
        id={id}
        type="file"
        accept="image/*"
        className="visually-hidden"
        tabIndex={-1}
        aria-labelledby={`${id}-label`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // so choosing the same photo again still triggers
          if (file) start(file);
        }}
      />

      <div className={styles.actions}>
        <Button size="sm" disabled={uploading} onClick={() => input.current?.click()}>
          {value ? "Replace photo" : "Choose photo"}
        </Button>
        {removable && value && !uploading && (
          <Button size="sm" variant="quiet" onClick={() => onChange("")}>
            Remove photo
          </Button>
        )}
      </div>

      {uploading && (
        <div className={styles.progress} role="status">
          <span>Uploading… {percent}%</span>
          <span className={styles.bar} aria-hidden="true">
            <span style={{ width: `${percent}%` }} />
          </span>
        </div>
      )}

      {upload.state === "failed" && (
        <div className={styles.failed} role="alert">
          <p>{upload.message}</p>
          {lastFile.current && (
            <Button size="sm" onClick={() => lastFile.current && start(lastFile.current)}>
              Try again
            </Button>
          )}
        </div>
      )}

      {error && upload.state !== "failed" && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

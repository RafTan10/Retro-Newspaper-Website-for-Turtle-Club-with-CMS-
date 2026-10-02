import styles from "./Halftone.module.css";

type HalftoneProps = {
  src: string;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
  /** Ask the browser to fetch this one first (the top cover, the page on screen) */
  important?: boolean;
};

/** Grayscale image with a printed halftone dot overlay. */
export function Halftone({ src, alt, className, loading = "lazy", important = false }: HalftoneProps) {
  // React 18 doesn't know fetchPriority yet; the lowercase attribute passes through
  const priority = important ? ({ fetchpriority: "high" } as Record<string, string>) : {};
  return (
    <div className={[styles.halftone, className].filter(Boolean).join(" ")}>
      <img src={src} alt={alt} loading={loading} decoding="async" draggable={false} {...priority} />
    </div>
  );
}

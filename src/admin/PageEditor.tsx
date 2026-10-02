import { Reorder, useDragControls } from "framer-motion";
import { useState } from "react";
import type { Page } from "../types";
import { ImageField } from "./ImageField";
import { RichTextEditor } from "./RichTextEditor";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import styles from "./PageEditor.module.css";

type PageEditorProps = {
  pages: Page[];
  onChange: (pages: Page[]) => void;
  /** Problems to fix before saving, by page id */
  errors: Record<string, string>;
  /** The page being worked on, shown in the preview */
  onFocusPage: (id: string) => void;
};

const newId = () => crypto.randomUUID();

export function PageEditor({ pages, onChange, errors, onFocusPage }: PageEditorProps) {
  const [justAdded, setJustAdded] = useState<string | null>(null);

  function update(id: string, patch: Partial<Page>) {
    onChange(pages.map((p) => (p.id === id ? ({ ...p, ...patch } as Page) : p)));
  }

  function move(id: string, by: -1 | 1) {
    const next = [...pages];
    const from = next.findIndex((p) => p.id === id);
    const to = from + by;
    if (to < 0 || to >= next.length) return;
    next.splice(to, 0, ...next.splice(from, 1));
    onChange(next);
  }

  function add(type: Page["type"]) {
    const id = newId();
    const order = pages.length + 1;
    const page: Page =
      type === "photo" ? { id, type, image: "", caption: "", order } : { id, type, heading: "", body: "", order };
    onChange([...pages, page]);
    setJustAdded(id);
    onFocusPage(id);
  }

  return (
    <div className={styles.editor}>
      {pages.length === 0 && <p className={styles.empty}>No pages yet. Add a photo page or a text page.</p>}

      <Reorder.Group axis="y" values={pages} onReorder={onChange} className={styles.pages}>
        {pages.map((page, index) => (
          <PageCard
            key={page.id}
            page={page}
            index={index}
            count={pages.length}
            error={errors[page.id]}
            autoFocus={page.id === justAdded}
            onFocus={() => onFocusPage(page.id)}
            onUpdate={(patch) => update(page.id, patch)}
            onMove={(by) => move(page.id, by)}
            onDelete={() => onChange(pages.filter((p) => p.id !== page.id))}
          />
        ))}
      </Reorder.Group>

      <div className={styles.add}>
        <Button onClick={() => add("photo")}>Add photo page</Button>
        <Button onClick={() => add("text")}>Add text page</Button>
      </div>
    </div>
  );
}

type PageCardProps = {
  page: Page;
  index: number;
  count: number;
  error?: string;
  autoFocus: boolean;
  onFocus: () => void;
  onUpdate: (patch: Partial<Page>) => void;
  onMove: (by: -1 | 1) => void;
  onDelete: () => void;
};

function PageCard({ page, index, count, error, autoFocus, onFocus, onUpdate, onMove, onDelete }: PageCardProps) {
  const controls = useDragControls();
  const [confirming, setConfirming] = useState(false);
  const n = index + 1;
  const kind = page.type === "photo" ? "photo" : "text";

  return (
    <Reorder.Item
      value={page}
      dragListener={false}
      dragControls={controls}
      className={styles.card}
      onFocusCapture={onFocus}
      data-shot={index === 0 ? "page-card" : undefined}
      ref={(el: HTMLLIElement | null) => {
        if (el && autoFocus) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }}
    >
      <div className={styles.cardHead}>
        <button
          type="button"
          className={styles.handle}
          aria-label={`Drag to move page ${n}`}
          onPointerDown={(e) => {
            e.preventDefault();
            controls.start(e);
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M4 6h12M4 10h12M4 14h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
          </svg>
        </button>
        <h3 className={styles.cardTitle}>
          Page {n}, {kind}
        </h3>
        <span className={styles.moves}>
          <Button size="sm" disabled={index === 0} aria-label={`Move page ${n} up`} onClick={() => onMove(-1)}>
            <Arrow up />
          </Button>
          <Button size="sm" disabled={index === count - 1} aria-label={`Move page ${n} down`} onClick={() => onMove(1)}>
            <Arrow />
          </Button>
        </span>
      </div>

      {page.type === "photo" ? (
        <>
          <ImageField label="Photo" value={page.image} onChange={(image) => onUpdate({ image })} error={error} />
          <Field
            label="Caption"
            multiline
            rows={3}
            value={page.caption}
            onValue={(caption) => onUpdate({ caption })}
            hint="Shown in the bar along the bottom of the photo."
          />
        </>
      ) : (
        <>
          <Field
            label="Heading (optional)"
            value={page.heading ?? ""}
            onValue={(heading) => onUpdate({ heading })}
          />
          <RichTextEditor label="Story text" value={page.body} onChange={(body) => onUpdate({ body })} error={error} />
        </>
      )}

      <div className={styles.cardFoot}>
        {confirming ? (
          <div className={styles.confirm} role="group" aria-label={`Delete page ${n}?`}>
            <span>Delete this page?</span>
            <Button size="sm" variant="danger" onClick={onDelete}>
              Delete page
            </Button>
            <Button size="sm" onClick={() => setConfirming(false)} autoFocus>
              Keep it
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="quiet" onClick={() => setConfirming(true)}>
            Delete page
          </Button>
        )}
      </div>
    </Reorder.Item>
  );
}

function Arrow({ up = false }: { up?: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ transform: up ? "rotate(180deg)" : undefined }}
    >
      <path d="M12 4v15M5.5 13L12 19.5L18.5 13" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="square" />
    </svg>
  );
}

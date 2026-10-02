import { ReaderPage } from "../components/reader/ReaderPage";
import { NewspaperCover } from "../components/stack/NewspaperCover";
import type { IssueDraft } from "../data/drafts";
import { langFor } from "../lib/bangla";
import type { Issue } from "../types";
import { formatDate } from "./format";
import styles from "./LivePreview.module.css";

type LivePreviewProps = {
  draft: IssueDraft;
  /** "cover" or a page id */
  target: string;
  onTarget: (target: string) => void;
};

/** The cover as it sits on the stack, or a page as it shows in the reader */
export function LivePreview({ draft, target, onTarget }: LivePreviewProps) {
  const pageIndex = draft.pages.findIndex((p) => p.id === target);
  const page = pageIndex >= 0 ? draft.pages[pageIndex] : null;
  const asIssue: Issue = { ...draft, id: draft.id ?? "preview", sortOrder: 0 };

  return (
    <div className={styles.preview} data-shot="preview">
      <div className={styles.picker} role="group" aria-label="Preview">
        <button type="button" aria-pressed={!page} className={styles.chip} onClick={() => onTarget("cover")}>
          Cover
        </button>
        {draft.pages.map((p, i) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={p.id === target}
            className={styles.chip}
            onClick={() => onTarget(p.id)}
          >
            Page {i + 1}
          </button>
        ))}
      </div>

      {!page ? (
        <div className={styles.paper}>
          <NewspaperCover issue={asIssue} priority />
        </div>
      ) : (
        <div className={styles.sheet}>
          <div className={styles.strip}>
            <span className={styles.masthead} lang={langFor(draft.masthead)}>
              {draft.masthead || "Masthead"}
            </span>
            <span className={styles.folio}>
              Issue {draft.issueNumber || "?"}, {draft.date ? formatDate(draft.date) : "no date"}
            </span>
          </div>
          <div className={styles.content}>
            {page.type === "photo" && !page.image ? (
              <p className={styles.missing}>Choose a photo to see this page.</p>
            ) : (
              <ReaderPage page={page} />
            )}
          </div>
          <div className={styles.footer}>
            <span className={styles.title} lang={langFor(draft.headline)}>
              {draft.headline}
            </span>
            <span className={styles.indicator}>
              Page {pageIndex + 1} of {draft.pages.length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

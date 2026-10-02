import { langFor } from "../../lib/bangla";
import type { Issue } from "../../types";
import { Halftone } from "../ui/Halftone";
import styles from "./NewspaperCover.module.css";

type NewspaperCoverProps = {
  issue: Issue;
  /** Load the image now rather than when it scrolls into view */
  priority?: boolean;
  /** The paper on top: its image is fetched before anything else */
  important?: boolean;
};

const dateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

function formatIssueDate(iso: string) {
  // Parse as a local date so the day never shifts across time zones
  const [y, m, d] = iso.split("-").map(Number);
  return dateFormat.format(new Date(y, m - 1, d));
}

export function NewspaperCover({ issue, priority = false, important = false }: NewspaperCoverProps) {
  return (
    <article className={styles.cover}>
      <header className={styles.head}>
        <h2 className={styles.masthead} lang={langFor(issue.masthead)}>
          {issue.masthead}
        </h2>
        <div className={styles.folio}>
          <time dateTime={issue.date}>{formatIssueDate(issue.date)}</time>
          <span>Issue {issue.issueNumber}</span>
        </div>
      </header>

      <div className={styles.lead}>
        {issue.coverImage ? (
          <Halftone
            src={issue.coverImage}
            alt=""
            className={styles.image}
            loading={priority || important ? "eager" : "lazy"}
            important={important}
          />
        ) : (
          <div className={`${styles.image} ${styles.noImage}`} />
        )}
        <span className={styles.bigNumber} aria-hidden="true">
          {issue.issueNumber}
        </span>
      </div>

      <div className={styles.story}>
        <h3 className={styles.headline} lang={langFor(issue.headline)}>
          {issue.headline}
        </h3>
        <p className={styles.excerpt} lang={langFor(issue.excerpt)}>
          {issue.excerpt}
        </p>
      </div>
    </article>
  );
}

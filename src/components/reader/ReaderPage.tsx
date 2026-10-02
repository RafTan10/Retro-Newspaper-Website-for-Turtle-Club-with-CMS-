import { useMemo } from "react";
import { langFor } from "../../lib/bangla";
import { sanitizeRichText } from "../../lib/richText";
import type { Page } from "../../types";
import { Halftone } from "../ui/Halftone";
import styles from "./ReaderPage.module.css";

type ReaderPageProps = {
  page: Page;
};

export function ReaderPage({ page }: ReaderPageProps) {
  if (page.type === "photo") {
    return (
      <figure className={styles.photo}>
        <Halftone src={page.image} alt="" className={styles.image} loading="eager" important />
        {page.caption && (
          <figcaption className={styles.caption} lang={langFor(page.caption)}>
            {page.caption}
          </figcaption>
        )}
      </figure>
    );
  }
  return <TextPageBody heading={page.heading} body={page.body} />;
}

function TextPageBody({ heading, body }: { heading?: string; body: string }) {
  // Sanitized again on render, whatever the source
  const html = useMemo(() => sanitizeRichText(body), [body]);
  return (
    <div className={styles.text}>
      <div className={styles.copy} lang={langFor(`${heading ?? ""} ${body}`)}>
        {heading && <h3 className={styles.heading}>{heading}</h3>}
        <div className={styles.body} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}

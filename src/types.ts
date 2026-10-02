export type PhotoPage = {
  id: string;
  type: "photo";
  image: string;
  caption: string;
  order: number;
};

export type TextPage = {
  id: string;
  type: "text";
  heading?: string;
  /** Sanitized HTML: p, br, strong, em, a[href] only (see src/lib/richText.ts) */
  body: string;
  order: number;
};

export type Page = PhotoPage | TextPage;

/**
 * Changes only when an editor presses a button; nothing changes it automatically.
 * Only "published" issues are on the public site.
 */
export type IssueStatus = "draft" | "published" | "hidden" | "archived";

export type Issue = {
  id: string;
  slug: string;
  masthead: string;
  issueNumber: number;
  date: string; // ISO date
  headline: string;
  excerpt: string;
  coverImage: string; // URL
  status: IssueStatus;
  sortOrder: number; // position in the stack
  pages: Page[];
  /** Set the first time the issue is published */
  publishedAt?: string | null;
  /** Last save, as stored; used to catch two editors saving over each other */
  updatedAt?: string;
  /** Email of whoever saved it last */
  updatedBy?: string | null;
  /**
   * Set when an editor deletes the issue. It then sits in Recently deleted,
   * off the public site, and is removed for good after TRASH_DAYS.
   */
  deletedAt?: string | null;
};

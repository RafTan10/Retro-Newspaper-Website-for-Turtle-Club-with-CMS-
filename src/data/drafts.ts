import type { Issue, IssueStatus, Page } from "../types";

/** What the editor sends to save: an issue without the fields the store owns */
export type IssueDraft = {
  id: string | null;
  slug: string;
  masthead: string;
  issueNumber: number;
  date: string;
  headline: string;
  excerpt: string;
  coverImage: string;
  status: IssueStatus;
  pages: Page[];
};

export function draftFromIssue(issue: Issue): IssueDraft {
  return {
    id: issue.id,
    slug: issue.slug,
    masthead: issue.masthead,
    issueNumber: issue.issueNumber,
    date: issue.date,
    headline: issue.headline,
    excerpt: issue.excerpt,
    coverImage: issue.coverImage,
    status: issue.status,
    pages: issue.pages,
  };
}

/** "Hatchlings return to the river!" -> "hatchlings-return-to-the-river" */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

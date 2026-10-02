import type { Issue, IssueStatus } from "../types";

/** How long a deleted issue stays in Recently deleted before it's removed for good */
export const TRASH_DAYS = 30;

const DAY = 24 * 60 * 60 * 1000;

/** Whole days left before a deleted issue is removed for good (0 = today) */
export function daysLeft(deletedAt: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(deletedAt).getTime() + TRASH_DAYS * DAY - now) / DAY));
}

export function isExpired(issue: Issue, now = Date.now()): boolean {
  return Boolean(issue.deletedAt) && new Date(issue.deletedAt!).getTime() + TRASH_DAYS * DAY <= now;
}

/** Restored issues never go straight back on the site: drafts stay drafts, the rest come back hidden */
export function restoredStatus(status: IssueStatus): IssueStatus {
  return status === "draft" ? "draft" : "hidden";
}

import type { Issue, IssueStatus, Page } from "../types";
import type { IssueDraft } from "./drafts";
import { ConflictError, DataError } from "./errors";
import mockIssues from "./mock-issues.json";
import { isExpired, restoredStatus } from "./trash";

// Mock mode: edits live in memory for this session and reset on reload. The
// public stack reads from here too, so editors can preview their changes.

let issues: Issue[] = structuredClone(mockIssues as Issue[]);

const EDITOR = "you (this session)";
const now = () => new Date().toISOString();
const clone = <T>(value: T): T => structuredClone(value);

function find(id: string): Issue {
  const issue = issues.find((i) => i.id === id);
  if (!issue) throw new DataError("This issue no longer exists. Go back to the list to see current issues.");
  return issue;
}

function checkFresh(issue: Issue, expectedUpdatedAt: string | undefined) {
  if (expectedUpdatedAt && issue.updatedAt && issue.updatedAt !== expectedUpdatedAt) throw new ConflictError();
}

function checkSlug(slug: string, id: string | null) {
  if (issues.some((i) => i.slug === slug && i.id !== id)) {
    throw new DataError(
      `Another issue already uses the web address "${slug}" (it may be in Archive or Recently deleted). Change the web address and save again.`,
    );
  }
}

export function mockList(): Issue[] {
  return clone([...issues].sort((a, b) => a.sortOrder - b.sortOrder));
}

export function mockGet(id: string): Issue | null {
  const issue = issues.find((i) => i.id === id);
  return issue ? clone(issue) : null;
}

export function mockSave(draft: IssueDraft, expectedUpdatedAt?: string): Issue {
  checkSlug(draft.slug, draft.id);
  const pages = draft.pages.map((p, i) => ({ ...p, order: i + 1 }));

  if (!draft.id) {
    const top = Math.min(0, ...issues.map((i) => i.sortOrder));
    const issue: Issue = {
      ...draft,
      id: `mock-${crypto.randomUUID()}`,
      pages,
      sortOrder: top - 1,
      publishedAt: draft.status === "published" ? now() : null,
      updatedAt: now(),
      updatedBy: EDITOR,
    };
    issues.push(issue);
    return clone(issue);
  }

  const existing = find(draft.id);
  checkFresh(existing, expectedUpdatedAt);
  Object.assign(existing, {
    ...draft,
    id: existing.id,
    pages,
    publishedAt: existing.publishedAt ?? (draft.status === "published" ? now() : null),
    updatedAt: now(),
    updatedBy: EDITOR,
  });
  return clone(existing);
}

export function mockSetStatus(id: string, status: IssueStatus, expectedUpdatedAt?: string): Issue {
  const issue = find(id);
  checkFresh(issue, expectedUpdatedAt);
  issue.status = status;
  if (status === "published" && !issue.publishedAt) issue.publishedAt = now();
  issue.updatedAt = now();
  issue.updatedBy = EDITOR;
  return clone(issue);
}

/** Moves the issue to Recently deleted */
export function mockTrash(id: string, expectedUpdatedAt?: string): Issue {
  const issue = find(id);
  checkFresh(issue, expectedUpdatedAt);
  issue.deletedAt = now();
  issue.updatedAt = now();
  issue.updatedBy = EDITOR;
  return clone(issue);
}

export function mockRestore(id: string): Issue {
  const issue = find(id);
  issue.deletedAt = null;
  issue.status = restoredStatus(issue.status);
  issue.updatedAt = now();
  issue.updatedBy = EDITOR;
  return clone(issue);
}

/** Permanent */
export function mockDeleteForever(id: string) {
  find(id);
  issues = issues.filter((i) => i.id !== id);
}

/** Removes deleted issues older than TRASH_DAYS; returns how many went */
export function mockPurgeExpired(): number {
  const before = issues.length;
  issues = issues.filter((i) => !isExpired(i));
  return before - issues.length;
}

export function mockReorder(ids: string[]) {
  ids.forEach((id, index) => {
    const issue = issues.find((i) => i.id === id);
    if (issue) issue.sortOrder = index + 1;
  });
}

export function mockSavePage(issueId: string, page: Page): Page {
  const issue = find(issueId);
  const index = issue.pages.findIndex((p) => p.id === page.id);
  if (index >= 0) issue.pages[index] = page;
  else issue.pages.push(page);
  issue.updatedAt = now();
  issue.updatedBy = EDITOR;
  return clone(page);
}

export function mockDeletePage(issueId: string, pageId: string) {
  const issue = find(issueId);
  issue.pages = issue.pages.filter((p) => p.id !== pageId);
  issue.updatedAt = now();
  issue.updatedBy = EDITOR;
}

/** Images stay on this device as object URLs; progress is simulated */
export async function mockUpload(file: File, onProgress?: (fraction: number) => void): Promise<string> {
  for (const step of [0.25, 0.5, 0.75, 1]) {
    await new Promise((resolve) => setTimeout(resolve, 120));
    onProgress?.(step);
  }
  return URL.createObjectURL(file);
}

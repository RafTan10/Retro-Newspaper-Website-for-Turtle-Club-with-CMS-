import type { Issue, IssueStatus, Page } from "../types";
import type { IssueDraft } from "./drafts";
import { DataError } from "./errors";
import * as mock from "./mockStore";
import { restoredStatus } from "./trash";

// The only place components get or change issue data. Uses Supabase when
// VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set; otherwise an in-memory
// copy of the mock issues that lasts for the session.

export const isConnected = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
);

// Loaded on demand so the mock-only build doesn't carry the Supabase client
const remote = () => import("./supabaseIssues");

function sortPages(issue: Issue): Issue {
  return { ...issue, pages: [...issue.pages].sort((a, b) => a.order - b.order) };
}

// Public site -------------------------------------------------------------------

/** Published issues in stack order, each with its pages in order. */
export async function getIssues(): Promise<Issue[]> {
  if (isConnected) return (await remote()).sbPublishedIssues();
  return mock.mockList().filter((i) => i.status === "published" && !i.deletedAt).map(sortPages);
}

/** One published issue with its pages, or null if there's no such issue. */
export async function getIssue(slug: string): Promise<Issue | null> {
  if (isConnected) return (await remote()).sbPublishedIssue(slug);
  const issue = mock.mockList().find((i) => i.slug === slug && i.status === "published" && !i.deletedAt);
  return issue ? sortPages(issue) : null;
}

// CMS -----------------------------------------------------------------------------

/** Every issue, any status, in stack order, including those in Recently deleted */
export async function listAllIssues(): Promise<Issue[]> {
  if (isConnected) return (await remote()).sbAllIssues();
  return mock.mockList().map(sortPages);
}

export async function getIssueById(id: string): Promise<Issue | null> {
  if (isConnected) return (await remote()).sbIssueById(id);
  const issue = mock.mockGet(id);
  return issue ? sortPages(issue) : null;
}

/**
 * Creates the issue (when draft.id is null) or saves it with its full list of
 * pages. Pass the updatedAt the editor loaded: if someone else saved since,
 * this throws ConflictError instead of overwriting their changes.
 */
export async function saveIssue(draft: IssueDraft, expectedUpdatedAt?: string): Promise<Issue> {
  if (isConnected) return (await remote()).sbSaveIssue(draft, expectedUpdatedAt);
  return mock.mockSave(draft, expectedUpdatedAt);
}

/** Publish, hide, show again, archive, restore: only ever on an editor's request */
export async function setIssueStatus(id: string, status: IssueStatus, expectedUpdatedAt?: string): Promise<Issue> {
  if (isConnected) return (await remote()).sbSetStatus(id, status, expectedUpdatedAt);
  return mock.mockSetStatus(id, status, expectedUpdatedAt);
}

/**
 * Moves the issue to Recently deleted: off the public site straight away, kept
 * with its pages and images for TRASH_DAYS so it can be restored.
 */
export async function deleteIssue(id: string, expectedUpdatedAt?: string): Promise<Issue> {
  if (isConnected) return (await remote()).sbTrash(id, expectedUpdatedAt);
  return mock.mockTrash(id, expectedUpdatedAt);
}

/** Takes an issue out of Recently deleted. It comes back hidden (drafts stay drafts). */
export async function restoreIssue(issue: Issue): Promise<Issue> {
  if (isConnected) return (await remote()).sbRestore(issue.id, restoredStatus(issue.status));
  return mock.mockRestore(issue.id);
}

/** Permanent: removes the issue, its pages, and its uploaded images */
export async function deleteIssueForever(id: string): Promise<void> {
  if (isConnected) return (await remote()).sbDeleteForever(id);
  mock.mockDeleteForever(id);
}

/**
 * Permanently removes issues that have been in Recently deleted for longer
 * than TRASH_DAYS. Runs when an editor opens the CMS, because Storage images
 * can't be removed from a database schedule. Returns how many were removed.
 */
export async function purgeExpiredIssues(): Promise<number> {
  if (isConnected) return (await remote()).sbPurgeExpired();
  return mock.mockPurgeExpired();
}

/** Sets the stack order, first id on top */
export async function reorderIssues(ids: string[]): Promise<void> {
  if (isConnected) return (await remote()).sbReorder(ids);
  mock.mockReorder(ids);
}

export async function savePage(issueId: string, page: Page): Promise<Page> {
  if (isConnected) return (await remote()).sbSavePage(issueId, page);
  return mock.mockSavePage(issueId, page);
}

export async function deletePage(issueId: string, pageId: string): Promise<void> {
  if (isConnected) return (await remote()).sbDeletePage(issueId, pageId);
  mock.mockDeletePage(issueId, pageId);
}

/**
 * Resizes the photo in the browser, then uploads it to the issue-images bucket
 * (or keeps it on this device in mock mode). Returns the image URL.
 */
export async function uploadImage(file: File, onProgress?: (fraction: number) => void): Promise<string> {
  const { prepareImage } = await import("../lib/image");
  const prepared = await prepareImage(file);
  if (prepared.size > 10 * 1024 * 1024) {
    throw new DataError("This photo is still over 10 MB after resizing. Choose a smaller photo.");
  }
  if (isConnected) return (await remote()).sbUpload(prepared, onProgress);
  return mock.mockUpload(prepared, onProgress);
}

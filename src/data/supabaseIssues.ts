import type { Issue, IssueStatus, Page } from "../types";
import type { IssueDraft } from "./drafts";
import { ConflictError, DataError, NotAllowedError } from "./errors";
import { IMAGE_BUCKET, supabase } from "./supabase";
import { TRASH_DAYS } from "./trash";

// Supabase mode. Only loaded when the env vars are set (see issues.ts).

type IssueRow = {
  id: string;
  slug: string;
  masthead: string;
  issue_number: number;
  date: string;
  headline: string;
  excerpt: string;
  cover_image: string | null;
  status: IssueStatus;
  sort_order: number;
  published_at: string | null;
  updated_at: string;
  updated_by_email: string | null;
  deleted_at: string | null;
  pages?: PageRow[] | null;
};

type PageRow = {
  id: string;
  type: "photo" | "text";
  image: string | null;
  caption: string | null;
  heading: string | null;
  body: string | null;
  order: number;
};

const PAGE_COLUMNS = "id, type, image, caption, heading, body, order";
const ISSUE_COLUMNS = `id, slug, masthead, issue_number, date, headline, excerpt, cover_image, status, sort_order, published_at, updated_at, updated_by_email, deleted_at, pages (${PAGE_COLUMNS})`;
const PUBLIC_COLUMNS = `id, slug, masthead, issue_number, date, headline, excerpt, cover_image, status, sort_order, pages (${PAGE_COLUMNS})`;

function db() {
  return supabase!;
}

function toPage(row: PageRow): Page {
  if (row.type === "photo") {
    return { id: row.id, type: "photo", image: row.image ?? "", caption: row.caption ?? "", order: row.order };
  }
  return {
    id: row.id,
    type: "text",
    ...(row.heading ? { heading: row.heading } : {}),
    body: row.body ?? "",
    order: row.order,
  };
}

function toIssue(row: IssueRow): Issue {
  return {
    id: row.id,
    slug: row.slug,
    masthead: row.masthead,
    issueNumber: row.issue_number,
    date: row.date,
    headline: row.headline,
    excerpt: row.excerpt,
    coverImage: row.cover_image ?? "",
    status: row.status,
    sortOrder: row.sort_order,
    publishedAt: row.published_at ?? null,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by_email ?? null,
    deletedAt: row.deleted_at ?? null,
    pages: (row.pages ?? []).map(toPage).sort((a, b) => a.order - b.order),
  };
}

type PgError = { message: string; code?: string };

function fail(action: string, error: PgError): never {
  if (error.message.includes("issue_conflict")) throw new ConflictError();
  if (error.message.includes("issue_not_found")) {
    throw new DataError("This issue no longer exists. Go back to the list to see current issues.");
  }
  if (error.code === "23505") {
    throw new DataError(
      "Another issue already uses this web address (it may be in Archive or Recently deleted). Change the web address and save again.",
    );
  }
  if (error.code === "42501" || /row-level security|permission denied/i.test(error.message)) {
    throw new NotAllowedError("Your account isn't allowed to make this change. Sign in again, or ask the site owner to add you as an editor.");
  }
  if (/fetch|network/i.test(error.message)) {
    throw new DataError(`Couldn't ${action}: the connection dropped. Check your internet connection and try again.`);
  }
  throw new DataError(`Couldn't ${action}: ${error.message}`);
}

// Public reads ----------------------------------------------------------------

export async function sbPublishedIssues(): Promise<Issue[]> {
  const { data, error } = await db()
    .from("issues")
    .select(PUBLIC_COLUMNS)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .returns<IssueRow[]>();
  if (error) fail("load issues", error);
  return data.map(toIssue);
}

export async function sbPublishedIssue(slug: string): Promise<Issue | null> {
  const { data, error } = await db()
    .from("issues")
    .select(PUBLIC_COLUMNS)
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle<IssueRow>();
  if (error) fail("load this issue", error);
  return data ? toIssue(data) : null;
}

// Editor reads and writes -------------------------------------------------------

export async function sbAllIssues(): Promise<Issue[]> {
  const { data, error } = await db()
    .from("issues")
    .select(ISSUE_COLUMNS)
    .order("sort_order", { ascending: true })
    .returns<IssueRow[]>();
  if (error) fail("load issues", error);
  return data.map(toIssue);
}

export async function sbIssueById(id: string): Promise<Issue | null> {
  const { data, error } = await db().from("issues").select(ISSUE_COLUMNS).eq("id", id).maybeSingle<IssueRow>();
  if (error) fail("load this issue", error);
  return data ? toIssue(data) : null;
}

export async function sbSaveIssue(draft: IssueDraft, expectedUpdatedAt?: string): Promise<Issue> {
  const pages = draft.pages.map((p, i) => ({
    id: draft.id ? p.id : null, // pages of a new issue get ids from the database
    type: p.type,
    image: p.type === "photo" ? p.image : null,
    caption: p.type === "photo" ? p.caption : null,
    heading: p.type === "text" ? (p.heading ?? null) : null,
    body: p.type === "text" ? p.body : null,
    order: i + 1,
  }));
  const { data, error } = await db().rpc("save_issue", {
    p_issue: {
      id: draft.id,
      slug: draft.slug,
      masthead: draft.masthead,
      issue_number: draft.issueNumber,
      date: draft.date,
      headline: draft.headline,
      excerpt: draft.excerpt,
      cover_image: draft.coverImage,
      status: draft.status,
    },
    p_pages: pages,
    p_expected_updated_at: expectedUpdatedAt ?? null,
  });
  if (error) fail("save the issue", error);
  const saved = await sbIssueById((data as IssueRow).id);
  if (!saved) throw new DataError("The issue was saved but couldn't be loaded again. Reload the page.");
  return saved;
}

export async function sbSetStatus(id: string, status: IssueStatus, expectedUpdatedAt?: string): Promise<Issue> {
  let query = db().from("issues").update({ status }).eq("id", id);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const { data, error } = await query.select(ISSUE_COLUMNS).returns<IssueRow[]>();
  if (error) fail("change the status", error);
  if (data.length === 0) {
    const current = await sbIssueById(id);
    if (current) throw new ConflictError();
    throw new DataError("This issue no longer exists. Go back to the list to see current issues.");
  }
  return toIssue(data[0]);
}

/** Path inside the bucket for a public URL of ours, or null for any other URL */
function bucketPath(url: string): string | null {
  const marker = `/storage/v1/object/public/${IMAGE_BUCKET}/`;
  const at = url.indexOf(marker);
  return at === -1 ? null : decodeURIComponent(url.slice(at + marker.length));
}

export async function sbTrash(id: string, expectedUpdatedAt?: string): Promise<Issue> {
  let query = db().from("issues").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const { data, error } = await query.select(ISSUE_COLUMNS).returns<IssueRow[]>();
  if (error) fail("delete the issue", error);
  if (data.length === 0) {
    if (await sbIssueById(id)) throw new ConflictError();
    throw new DataError("This issue no longer exists. Go back to the list to see current issues.");
  }
  return toIssue(data[0]);
}

export async function sbRestore(id: string, status: IssueStatus): Promise<Issue> {
  const { data, error } = await db()
    .from("issues")
    .update({ deleted_at: null, status })
    .eq("id", id)
    .select(ISSUE_COLUMNS)
    .returns<IssueRow[]>();
  if (error) fail("restore the issue", error);
  if (data.length === 0) throw new DataError("This issue no longer exists. It may have been deleted for good.");
  return toIssue(data[0]);
}

export async function sbPurgeExpired(): Promise<number> {
  const cutoff = new Date(Date.now() - TRASH_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db().from("issues").select("id").lt("deleted_at", cutoff).returns<{ id: string }[]>();
  if (error) fail("tidy up Recently deleted", error);
  for (const { id } of data) await sbDeleteForever(id);
  return data.length;
}

export async function sbDeleteForever(id: string): Promise<void> {
  const issue = await sbIssueById(id);
  if (!issue) return;
  const paths = [issue.coverImage, ...issue.pages.map((p) => (p.type === "photo" ? p.image : ""))]
    .map(bucketPath)
    .filter((p): p is string => Boolean(p));

  const { error } = await db().from("issues").delete().eq("id", id);
  if (error) fail("delete the issue", error);
  // Images go after the rows, so a failed delete never leaves an issue with broken images
  if (paths.length) await db().storage.from(IMAGE_BUCKET).remove(paths);
}

export async function sbReorder(ids: string[]): Promise<void> {
  const { error } = await db().rpc("reorder_issues", { p_ids: ids });
  if (error) fail("save the new order", error);
}

export async function sbSavePage(issueId: string, page: Page): Promise<Page> {
  const row = {
    id: page.id,
    issue_id: issueId,
    type: page.type,
    image: page.type === "photo" ? page.image : null,
    caption: page.type === "photo" ? page.caption : null,
    heading: page.type === "text" ? (page.heading ?? null) : null,
    body: page.type === "text" ? page.body : null,
    order: page.order,
  };
  const { data, error } = await db().from("pages").upsert(row).select(PAGE_COLUMNS).single<PageRow>();
  if (error) fail("save the page", error);
  return toPage(data);
}

export async function sbDeletePage(issueId: string, pageId: string): Promise<void> {
  const { error } = await db().from("pages").delete().eq("id", pageId).eq("issue_id", issueId);
  if (error) fail("delete the page", error);
}

/**
 * Uploads straight to Storage's REST endpoint with XHR, because the client
 * library doesn't report upload progress.
 */
export async function sbUpload(file: File, onProgress?: (fraction: number) => void): Promise<string> {
  const { data } = await db().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new NotAllowedError();

  const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}-${file.name}`;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${IMAGE_BUCKET}/${path}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_ANON_KEY ?? "");
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.setRequestHeader("cache-control", "max-age=31536000");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      if (xhr.status === 413) return reject(new DataError("This photo is too big to upload (over 10 MB). Choose a smaller photo."));
      if (xhr.status === 401 || xhr.status === 403) return reject(new NotAllowedError("Your account isn't allowed to upload images. Sign in again."));
      reject(new DataError(`The upload failed (error ${xhr.status}). Try again.`));
    };
    xhr.onerror = () => reject(new DataError("The upload stopped: the connection dropped. Check your connection and try again."));
    xhr.send(file);
  });

  return db().storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useBlocker, useNavigate, useParams } from "react-router-dom";
import { draftFromIssue, slugify, type IssueDraft } from "../data/drafts";
import { ConflictError } from "../data/errors";
import { getIssueById, listAllIssues, restoreIssue, saveIssue } from "../data/issues";
import { daysLeft } from "../data/trash";
import { isEmptyRichText, sanitizeRichText } from "../lib/richText";
import type { Issue, IssueStatus } from "../types";
import { formatMoment } from "./format";
import { ImageField } from "./ImageField";
import { LivePreview } from "./LivePreview";
import { PageEditor } from "./PageEditor";
import { Button } from "./ui/Button";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { Field } from "./ui/Field";
import { STATUS_LABEL } from "./status";
import { Stamp } from "./ui/Stamp";
import styles from "./IssueEditor.module.css";

type Errors = Partial<Record<"masthead" | "headline" | "issueNumber" | "date" | "slug", string>> & {
  pages?: Record<string, string>;
};

type SaveState =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved"; at: string }
  | { state: "failed"; message: string }
  | { state: "conflict" };

type LocalDraft = { savedAt: string; form: IssueDraft };

const STATUS_HELP: Record<IssueStatus, string> = {
  draft: "Not on the public site. New issues start here.",
  published: "On the stack for everyone to read.",
  hidden: "Off the public site. Stays in the main list with a Hidden stamp.",
  archived: "Off the site and moved to the Archive tab.",
};

const STATUSES: IssueStatus[] = ["draft", "published", "hidden", "archived"];

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function readLocal(key: string): LocalDraft | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as LocalDraft) : null;
  } catch {
    return null;
  }
}

function writeLocal(key: string, form: IssueDraft) {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), form }));
  } catch {
    // Storage full or blocked: the in-page form still has the changes
  }
}

function clearLocal(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function validate(form: IssueDraft): Errors {
  const errors: Errors = {};
  if (!form.masthead.trim()) errors.masthead = "Add a masthead, like Turtle Club.";
  if (!form.headline.trim()) errors.headline = "Add a headline.";
  if (!Number.isInteger(form.issueNumber) || form.issueNumber < 1) {
    errors.issueNumber = "Issue number must be a whole number above 0.";
  }
  if (!form.date) errors.date = "Choose the issue date.";
  if (!SLUG_PATTERN.test(form.slug)) {
    errors.slug = "Use lowercase letters, numbers and hyphens, like harbor-ferry-returns.";
  }
  const pages: Record<string, string> = {};
  for (const page of form.pages) {
    if (page.type === "photo" && !page.image) pages[page.id] = "Choose a photo for this page, or delete the page.";
    if (page.type === "text" && isEmptyRichText(page.body)) pages[page.id] = "Add some text to this page, or delete the page.";
  }
  if (Object.keys(pages).length) errors.pages = pages;
  return errors;
}

function countErrors(errors: Errors) {
  const { pages, ...fields } = errors;
  return Object.values(fields).filter(Boolean).length + Object.keys(pages ?? {}).length;
}

export function IssueEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const draftKey = `turtle-club:draft:${id ?? "new"}`;

  const [loaded, setLoaded] = useState<Issue | null>(null);
  const [baseline, setBaseline] = useState<IssueDraft | null>(null);
  const [form, setForm] = useState<IssueDraft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [save, setSave] = useState<SaveState>({ state: "idle" });
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [previewTarget, setPreviewTarget] = useState("cover");
  const [restorable, setRestorable] = useState<LocalDraft | null>(null);
  const skipBlock = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      let start: IssueDraft;
      if (isNew) {
        const all = await listAllIssues();
        start = {
          id: null,
          slug: "",
          masthead: "Turtle Club",
          issueNumber: Math.max(0, ...all.map((i) => i.issueNumber)) + 1,
          date: today(),
          headline: "",
          excerpt: "",
          coverImage: "",
          status: "draft",
          pages: [],
        };
        setLoaded(null);
      } else {
        const issue = await getIssueById(id);
        if (!issue) {
          setLoadError("This issue doesn't exist any more. It may have been deleted.");
          return;
        }
        setLoaded(issue);
        start = draftFromIssue(issue);
      }
      setBaseline(start);
      setForm(start);
      setSave({ state: "idle" });
      const local = readLocal(draftKey);
      setRestorable(local && JSON.stringify(local.form) !== JSON.stringify(start) ? local : null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load this issue. Try again.");
    }
  }, [id, isNew, draftKey]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(
    () => Boolean(form && baseline && JSON.stringify(form) !== JSON.stringify(baseline)),
    [form, baseline],
  );

  // Keep a copy on this device so a dropped connection or closed tab doesn't lose the story
  useEffect(() => {
    if (!form || !dirty) return;
    const timer = window.setTimeout(() => writeLocal(draftKey, form), 500);
    return () => window.clearTimeout(timer);
  }, [form, dirty, draftKey]);

  // Warn before closing the tab or leaving the editor with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !skipBlock.current && currentLocation.pathname !== nextLocation.pathname,
  );

  function patch(changes: Partial<IssueDraft>) {
    setForm((f) => (f ? { ...f, ...changes } : f));
    if (save.state === "saved" || save.state === "failed") setSave({ state: "idle" });
  }

  function setHeadline(headline: string) {
    const changes: Partial<IssueDraft> = { headline };
    if (!slugTouched && form) changes.slug = slugify(headline) || `issue-${form.issueNumber}`;
    patch(changes);
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!form) return;
    const found = validate(form);
    setErrors(found);
    if (countErrors(found) > 0) {
      setTab("edit");
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }

    setSave({ state: "saving" });
    const clean: IssueDraft = {
      ...form,
      headline: form.headline.trim(),
      masthead: form.masthead.trim(),
      pages: form.pages.map((p, i) =>
        p.type === "text"
          ? { ...p, heading: p.heading?.trim() || undefined, body: sanitizeRichText(p.body), order: i + 1 }
          : { ...p, caption: p.caption.trim(), order: i + 1 },
      ),
    };
    try {
      const saved = await saveIssue(clean, loaded?.updatedAt);
      const fresh = draftFromIssue(saved);
      clearLocal(draftKey);
      setRestorable(null);
      setLoaded(saved);
      setBaseline(fresh);
      setForm(fresh);
      setSave({ state: "saved", at: saved.updatedAt ?? new Date().toISOString() });
      if (isNew) {
        skipBlock.current = true;
        navigate(`/admin/issues/${saved.id}`, { replace: true });
      }
    } catch (err) {
      if (err instanceof ConflictError) setSave({ state: "conflict" });
      else setSave({ state: "failed", message: err instanceof Error ? err.message : "Couldn't save. Try again." });
    }
  }

  if (loadError) {
    return (
      <div className={styles.loadError} role="alert">
        <p>{loadError}</p>
        <div className={styles.row}>
          <Button onClick={load}>Try again</Button>
          <Link to="/admin" className={styles.back}>
            Back to all issues
          </Link>
        </div>
      </div>
    );
  }
  if (!form) return <p className={styles.loading}>Loading the issue…</p>;

  // A deleted issue can't be edited until it's restored
  if (loaded?.deletedAt) {
    const left = daysLeft(loaded.deletedAt);
    return (
      <div className={`${styles.banner} ${styles.alert}`} role="alert">
        <p>
          <strong>This issue is in Recently deleted.</strong> It’s off the public site and will be removed for good{" "}
          {left === 0 ? "today" : `in ${left} ${left === 1 ? "day" : "days"}`}. Restore it to edit it.
        </p>
        <div className={styles.row}>
          <Button
            variant="primary"
            onClick={async () => {
              await restoreIssue(loaded);
              load();
            }}
          >
            Restore issue
          </Button>
          <Link to="/admin" className={styles.back}>
            Back to all issues
          </Link>
        </div>
      </div>
    );
  }

  const errorCount = countErrors(errors);
  const title = isNew ? "New issue" : `Edit issue ${loaded?.issueNumber ?? form.issueNumber}`;

  return (
    <form className={styles.editor} onSubmit={submit} noValidate>
      <div className={styles.top}>
        <Link to="/admin" className={styles.back}>
          ← All issues
        </Link>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{title}</h1>
          <Stamp status={loaded?.status ?? "draft"} />
        </div>
      </div>

      {restorable && (
        <div className={styles.banner} role="status">
          <p>You have unsaved changes from {formatMoment(restorable.savedAt)} on this device.</p>
          <div className={styles.row}>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setForm(restorable.form);
                setSlugTouched(true);
                setRestorable(null);
              }}
            >
              Restore my changes
            </Button>
            <Button
              size="sm"
              onClick={() => {
                clearLocal(draftKey);
                setRestorable(null);
              }}
            >
              Discard them
            </Button>
          </div>
        </div>
      )}

      {save.state === "conflict" && (
        <div className={`${styles.banner} ${styles.alert}`} role="alert">
          <p>
            <strong>Someone else changed this issue. Reload to see their changes.</strong> Your version is kept on this
            device, so you can restore it after reloading and save it again.
          </p>
          <Button size="sm" onClick={() => (writeLocal(draftKey, form), load())}>
            Reload issue
          </Button>
        </div>
      )}

      {errorCount > 0 && (
        <div ref={summaryRef} tabIndex={-1} className={`${styles.banner} ${styles.alert}`} role="alert">
          <p>
            <strong>
              Fix {errorCount === 1 ? "1 thing" : `${errorCount} things`} before saving.
            </strong>{" "}
            Each problem is marked below.
          </p>
        </div>
      )}

      <div className={styles.tabs} role="tablist" aria-label="Editor view">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "edit"}
          className={styles.tab}
          onClick={() => setTab("edit")}
        >
          Edit
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "preview"}
          className={styles.tab}
          onClick={() => setTab("preview")}
        >
          Preview
        </button>
      </div>

      <div className={styles.columns}>
        <div className={styles.form} data-tab-hidden={tab !== "edit" || undefined}>
          <section className={styles.section} aria-labelledby="cover-heading" data-shot="cover-fields" onFocusCapture={() => setPreviewTarget("cover")}>
            <h2 id="cover-heading" className={styles.sectionTitle}>
              Cover
            </h2>
            <Field
              label="Headline"
              value={form.headline}
              onValue={setHeadline}
              error={errors.headline}
              placeholder="Harbor ferry returns after a forty-year absence"
            />
            <Field
              label="Excerpt"
              multiline
              rows={4}
              value={form.excerpt}
              onValue={(excerpt) => patch({ excerpt })}
              hint="A few sentences printed in columns under the headline."
            />
            <div className={styles.pair}>
              <Field
                label="Issue number"
                type="number"
                inputMode="numeric"
                min={1}
                value={Number.isNaN(form.issueNumber) ? "" : form.issueNumber}
                onValue={(v) => patch({ issueNumber: v === "" ? NaN : Number(v) })}
                error={errors.issueNumber}
              />
              <Field label="Date" type="date" value={form.date} onValue={(date) => patch({ date })} error={errors.date} />
            </div>
            <Field label="Masthead" value={form.masthead} onValue={(masthead) => patch({ masthead })} error={errors.masthead} />
            <Field
              label="Web address"
              value={form.slug}
              onValue={(slug) => {
                setSlugTouched(true);
                patch({ slug: slug.toLowerCase().replace(/\s+/g, "-") });
              }}
              error={errors.slug}
              hint="Lowercase letters, numbers and hyphens. Filled in from the headline."
              autoCapitalize="off"
              spellCheck={false}
            />
            <ImageField
              label="Cover photo"
              value={form.coverImage}
              onChange={(coverImage) => patch({ coverImage })}
              removable
            />
          </section>

          <section className={styles.section} aria-labelledby="status-heading" data-shot="status">
            <h2 id="status-heading" className={styles.sectionTitle}>
              Status
            </h2>
            <div className={styles.statuses} role="radiogroup" aria-labelledby="status-heading">
              {STATUSES.map((status) => (
                <label key={status} className={styles.status}>
                  <input
                    type="radio"
                    name="status"
                    value={status}
                    checked={form.status === status}
                    onChange={() => patch({ status })}
                  />
                  <span>{STATUS_LABEL[status]}</span>
                </label>
              ))}
            </div>
            <p className={styles.statusHelp}>
              {STATUS_HELP[form.status]}
              {form.status !== loaded?.status && !isNew && " Changes when you save."}
            </p>
          </section>

          <section className={styles.section} aria-labelledby="pages-heading" data-shot="pages">
            <h2 id="pages-heading" className={styles.sectionTitle}>
              Pages
            </h2>
            <PageEditor
              pages={form.pages}
              onChange={(pages) => patch({ pages })}
              errors={errors.pages ?? {}}
              onFocusPage={setPreviewTarget}
            />
          </section>
        </div>

        <aside className={styles.side} data-tab-hidden={tab !== "preview" || undefined} aria-label="Preview">
          <div className={styles.sticky}>
            <h2 className={styles.sectionTitle}>Preview</h2>
            <LivePreview draft={form} target={previewTarget} onTarget={setPreviewTarget} />
          </div>
        </aside>
      </div>

      <div className={styles.saveBar} data-shot="save-bar">
        <p className={styles.saveStatus} aria-live="polite">
          {save.state === "saving" && "Saving…"}
          {save.state === "saved" && `Saved ${formatMoment(save.at)}`}
          {save.state === "failed" && <span className={styles.failed}>{save.message}</span>}
          {save.state === "idle" && (dirty ? "Unsaved changes" : isNew ? "Not saved yet" : "No changes")}
          {save.state === "conflict" && <span className={styles.failed}>Not saved</span>}
        </p>
        <Button type="submit" variant="primary" disabled={save.state === "saving"}>
          {isNew ? "Save issue" : "Save changes"}
        </Button>
      </div>

      {blocker.state === "blocked" && (
        <ConfirmDialog
          title="Leave without saving?"
          onCancel={() => blocker.reset()}
          actions={
            <>
              <Button data-autofocus variant="primary" onClick={() => blocker.reset()}>
                Keep editing
              </Button>
              <Button onClick={() => blocker.proceed()}>Leave</Button>
            </>
          }
        >
          <p>Your changes are kept on this device, so you can restore them next time you open this issue.</p>
        </ConfirmDialog>
      )}
    </form>
  );
}

import { Reorder, useDragControls } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  deleteIssue,
  deleteIssueForever,
  listAllIssues,
  purgeExpiredIssues,
  reorderIssues,
  restoreIssue,
  setIssueStatus,
} from "../data/issues";
import { daysLeft, TRASH_DAYS } from "../data/trash";
import { langFor } from "../lib/bangla";
import type { Issue, IssueStatus } from "../types";
import { Halftone } from "../components/ui/Halftone";
import { DeleteForeverDialog, DeleteIssueDialog } from "./DeleteIssueDialog";
import { formatDate, formatEdited, formatShortDate } from "./format";
import { Button } from "./ui/Button";
import { Stamp } from "./ui/Stamp";
import styles from "./IssueList.module.css";

type Tab = "issues" | "archive" | "deleted";

const HELP: Record<Tab, string> = {
  issues:
    "Top of the list is the top of the stack. Drag the handle or use the arrows to change the order. Only published issues appear on the site.",
  archive: "Archived issues are off the site and kept here. Restore one to bring it back to the main list as hidden.",
  deleted: `Deleted issues stay here for ${TRASH_DAYS} days, off the site, then they're removed for good with their photos. Restore one to bring it back as hidden.`,
};

const EMPTY: Record<Tab, string> = {
  issues: "No issues yet. Press New issue to start one.",
  archive: "Nothing archived. Archived issues are kept here, off the public site.",
  deleted: `Nothing deleted in the last ${TRASH_DAYS} days.`,
};

export function IssueList() {
  const navigate = useNavigate();
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("issues");
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState<Issue | null>(null);
  const [destroying, setDestroying] = useState<Issue | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // Anything past its 30 days in Recently deleted goes for good first
      const purged = await purgeExpiredIssues().catch(() => 0);
      setIssues(await listAllIssues());
      setLoadError(null);
      if (purged > 0) {
        setMessage(
          `${purged === 1 ? "1 issue" : `${purged} issues`} had been in Recently deleted for ${TRASH_DAYS} days and ${purged === 1 ? "was" : "were"} removed for good.`,
        );
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load the issues. Reload the page to try again.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const live = issues?.filter((i) => !i.deletedAt) ?? [];
  const main = live.filter((i) => i.status !== "archived");
  const archived = live.filter((i) => i.status === "archived");
  // Most recently deleted first
  const deleted = (issues?.filter((i) => i.deletedAt) ?? []).sort((a, b) =>
    (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""),
  );

  // Stack order: the main list top to bottom; archived and deleted issues after it
  const latestOrder = useRef<string[]>([]);
  async function saveOrder(ids: string[]) {
    try {
      await reorderIssues([...ids, ...archived.map((i) => i.id), ...deleted.map((i) => i.id)]);
      setMessage("Stack order saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Couldn't save the new order. Try again.");
      load();
    }
  }

  function reorderLocally(ids: string[]) {
    latestOrder.current = ids;
    setIssues((all) => {
      if (!all) return all;
      const byId = new Map(all.map((i) => [i.id, i]));
      const moved = new Set(ids);
      return [...ids.map((id) => byId.get(id)!), ...all.filter((i) => !moved.has(i.id))];
    });
  }

  function move(id: string, by: -1 | 1) {
    const ids = main.map((i) => i.id);
    const from = ids.indexOf(id);
    const to = from + by;
    if (to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ...ids.splice(from, 1));
    reorderLocally(ids);
    saveOrder(ids);
  }

  function replace(updated: Issue) {
    setIssues((all) => all?.map((i) => (i.id === updated.id ? updated : i)) ?? all);
  }

  async function run(issue: Issue, action: () => Promise<void>, failure: string) {
    setBusyId(issue.id);
    try {
      await action();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : failure);
      load();
    } finally {
      setBusyId(null);
    }
  }

  const changeStatus = (issue: Issue, status: IssueStatus, done: string) =>
    run(
      issue,
      async () => {
        replace(await setIssueStatus(issue.id, status, issue.updatedAt));
        setMessage(done);
      },
      "Couldn't change the status. Try again.",
    );

  function moveToDeleted(issue: Issue) {
    setDeleting(null);
    run(
      issue,
      async () => {
        replace(await deleteIssue(issue.id, issue.updatedAt));
        setMessage(
          `Issue ${issue.issueNumber} moved to Recently deleted. It's off the site, and you can restore it for ${TRASH_DAYS} days.`,
        );
      },
      "Couldn't delete the issue. Try again.",
    );
  }

  function restore(issue: Issue) {
    run(
      issue,
      async () => {
        const restored = await restoreIssue(issue);
        replace(restored);
        setMessage(
          `Issue ${issue.issueNumber} restored to the main list as ${restored.status === "draft" ? "a draft" : "hidden"}.`,
        );
      },
      "Couldn't restore the issue. Try again.",
    );
  }

  function destroy(issue: Issue) {
    setDestroying(null);
    run(
      issue,
      async () => {
        await deleteIssueForever(issue.id);
        setIssues((all) => all?.filter((i) => i.id !== issue.id) ?? all);
        setMessage(`Issue ${issue.issueNumber} deleted for good.`);
      },
      "Couldn't delete the issue. Try again.",
    );
  }

  const rows = tab === "issues" ? main : tab === "archive" ? archived : deleted;

  return (
    <section className={styles.list} data-shot="issue-list">
      <div className={styles.head}>
        <h1 className={styles.title}>Issues</h1>
        <Button variant="primary" onClick={() => navigate("/admin/issues/new")}>
          New issue
        </Button>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Which issues">
        <TabButton active={tab === "issues"} onClick={() => setTab("issues")} controls="issue-rows">
          Issues <span className={styles.count}>{main.length}</span>
        </TabButton>
        <TabButton active={tab === "archive"} onClick={() => setTab("archive")} controls="issue-rows">
          Archive <span className={styles.count}>{archived.length}</span>
        </TabButton>
        <TabButton active={tab === "deleted"} onClick={() => setTab("deleted")} controls="issue-rows">
          Recently deleted <span className={styles.count}>{deleted.length}</span>
        </TabButton>
      </div>

      <p className={styles.help}>{HELP[tab]}</p>

      <p className="visually-hidden" aria-live="polite">
        {message}
      </p>
      {message && <p className={styles.message}>{message}</p>}

      {loadError && (
        <div className={styles.error} role="alert">
          <p>{loadError}</p>
          <Button size="sm" onClick={load}>
            Try again
          </Button>
        </div>
      )}
      {!issues && !loadError && <p className={styles.empty}>Loading issues…</p>}
      {issues && rows.length === 0 && <p className={styles.empty}>{EMPTY[tab]}</p>}

      {issues && rows.length > 0 && tab === "issues" && (
        <Reorder.Group
          id="issue-rows"
          role="tabpanel"
          axis="y"
          values={main.map((i) => i.id)}
          onReorder={reorderLocally}
          className={styles.rows}
        >
          {main.map((issue, index) => (
            <DraggableRow
              key={issue.id}
              issue={issue}
              onDrop={() => latestOrder.current.length && saveOrder(latestOrder.current)}
            >
              <RowBody
                issue={issue}
                busy={busyId === issue.id}
                first={index === 0}
                last={index === main.length - 1}
                onMove={(by) => move(issue.id, by)}
                onStatus={(status, done) => changeStatus(issue, status, done)}
                onDelete={() => setDeleting(issue)}
              />
            </DraggableRow>
          ))}
        </Reorder.Group>
      )}

      {issues && rows.length > 0 && tab === "archive" && (
        <ul id="issue-rows" role="tabpanel" className={styles.rows}>
          {archived.map((issue) => (
            <li key={issue.id} className={`${styles.row} ${styles.archivedRow}`}>
              <RowBody
                issue={issue}
                busy={busyId === issue.id}
                onStatus={(status, done) => changeStatus(issue, status, done)}
                onDelete={() => setDeleting(issue)}
              />
            </li>
          ))}
        </ul>
      )}

      {issues && rows.length > 0 && tab === "deleted" && (
        <ul id="issue-rows" role="tabpanel" className={styles.rows}>
          {deleted.map((issue) => (
            <li key={issue.id} className={`${styles.row} ${styles.archivedRow}`}>
              <DeletedRowBody
                issue={issue}
                busy={busyId === issue.id}
                onRestore={() => restore(issue)}
                onDeleteNow={() => setDestroying(issue)}
              />
            </li>
          ))}
        </ul>
      )}

      {deleting && (
        <DeleteIssueDialog
          issue={deleting}
          onDelete={() => moveToDeleted(deleting)}
          onArchive={() => {
            const issue = deleting;
            setDeleting(null);
            changeStatus(issue, "archived", `Issue ${issue.issueNumber} archived. It's off the site and in the Archive tab.`);
          }}
          onCancel={() => setDeleting(null)}
        />
      )}

      {destroying && (
        <DeleteForeverDialog issue={destroying} onDelete={() => destroy(destroying)} onCancel={() => setDestroying(null)} />
      )}
    </section>
  );
}

function TabButton({
  active,
  onClick,
  controls,
  children,
}: {
  active: boolean;
  onClick: () => void;
  controls: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      className={styles.tab}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function DraggableRow({ issue, onDrop, children }: { issue: Issue; onDrop: () => void; children: ReactNode }) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={issue.id}
      className={styles.row}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDrop}
    >
      <button
        type="button"
        className={styles.handle}
        aria-label={`Drag to move issue ${issue.issueNumber}`}
        onPointerDown={(e) => {
          e.preventDefault();
          controls.start(e);
        }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 6h12M4 10h12M4 14h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
        </svg>
      </button>
      {children}
    </Reorder.Item>
  );
}

function Thumb({ issue }: { issue: Issue }) {
  return (
    <div className={styles.thumb}>
      {issue.coverImage ? <Halftone src={issue.coverImage} alt="" className={styles.thumbImage} /> : null}
    </div>
  );
}

type RowBodyProps = {
  issue: Issue;
  busy: boolean;
  first?: boolean;
  last?: boolean;
  onMove?: (by: -1 | 1) => void;
  onStatus: (status: IssueStatus, done: string) => void;
  onDelete: () => void;
};

function RowBody({ issue, busy, first, last, onMove, onStatus, onDelete }: RowBodyProps) {
  const n = issue.issueNumber;
  return (
    <>
      <Thumb issue={issue} />
      <div className={styles.info}>
        <p className={styles.meta}>
          Issue {n}, {formatDate(issue.date)}
        </p>
        <h2 className={styles.headline} lang={langFor(issue.headline)}>
          <Link to={`/admin/issues/${issue.id}`}>{issue.headline}</Link>
        </h2>
        <div className={styles.statusLine}>
          <Stamp status={issue.status} />
          {issue.updatedBy && issue.updatedAt && (
            <span className={styles.edited}>{formatEdited(issue.updatedBy, issue.updatedAt)}</span>
          )}
        </div>
      </div>
      <div className={styles.actions}>
        <Link to={`/admin/issues/${issue.id}`} className={styles.editLink}>
          Edit
        </Link>
        {issue.status === "draft" && (
          <Button size="sm" disabled={busy} onClick={() => onStatus("published", `Issue ${n} published. It's on the stack.`)}>
            Publish
          </Button>
        )}
        {issue.status === "published" && (
          <Button size="sm" disabled={busy} onClick={() => onStatus("hidden", `Issue ${n} hidden. It's off the public site.`)}>
            Hide
          </Button>
        )}
        {issue.status === "hidden" && (
          <Button size="sm" disabled={busy} onClick={() => onStatus("published", `Issue ${n} is back on the stack.`)}>
            Show again
          </Button>
        )}
        {issue.status === "archived" ? (
          <Button size="sm" disabled={busy} onClick={() => onStatus("hidden", `Issue ${n} restored to the main list as hidden.`)}>
            Restore
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => onStatus("archived", `Issue ${n} archived. It's off the site and in the Archive tab.`)}
          >
            Archive
          </Button>
        )}
        <Button size="sm" variant="quiet" disabled={busy} onClick={onDelete}>
          Delete
        </Button>
        {onMove && (
          <span className={styles.moves}>
            <Button size="sm" disabled={first} aria-label={`Move issue ${n} up`} onClick={() => onMove(-1)}>
              <Arrow up />
            </Button>
            <Button size="sm" disabled={last} aria-label={`Move issue ${n} down`} onClick={() => onMove(1)}>
              <Arrow />
            </Button>
          </span>
        )}
      </div>
    </>
  );
}

type DeletedRowBodyProps = {
  issue: Issue;
  busy: boolean;
  onRestore: () => void;
  onDeleteNow: () => void;
};

function DeletedRowBody({ issue, busy, onRestore, onDeleteNow }: DeletedRowBodyProps) {
  const left = daysLeft(issue.deletedAt!);
  return (
    <>
      <Thumb issue={issue} />
      <div className={styles.info}>
        <p className={styles.meta}>
          Issue {issue.issueNumber}, {formatDate(issue.date)}
        </p>
        <h2 className={styles.headline} lang={langFor(issue.headline)}>
          {issue.headline}
        </h2>
        <p className={styles.deletedNote}>
          Deleted {formatShortDate(issue.deletedAt!)}
          {issue.updatedBy ? ` by ${issue.updatedBy}` : ""}.{" "}
          <strong>
            {left === 0 ? "Removed for good today." : `Removed for good in ${left} ${left === 1 ? "day" : "days"}.`}
          </strong>
        </p>
      </div>
      <div className={styles.actions}>
        <Button size="sm" disabled={busy} onClick={onRestore}>
          Restore
        </Button>
        <Button size="sm" variant="quiet" disabled={busy} onClick={onDeleteNow}>
          Delete now
        </Button>
      </div>
    </>
  );
}

function Arrow({ up = false }: { up?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ transform: up ? "rotate(180deg)" : undefined }}>
      <path d="M12 4v15M5.5 13L12 19.5L18.5 13" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="square" />
    </svg>
  );
}

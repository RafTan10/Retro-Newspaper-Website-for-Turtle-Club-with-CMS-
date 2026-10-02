import { TRASH_DAYS } from "../data/trash";
import type { Issue } from "../types";
import { Button } from "./ui/Button";
import { ConfirmDialog } from "./ui/ConfirmDialog";

type DeleteIssueDialogProps = {
  issue: Issue;
  onDelete: () => void;
  onArchive: () => void;
  onCancel: () => void;
};

/** Delete moves the issue to Recently deleted; archiving is offered as the gentler choice */
export function DeleteIssueDialog({ issue, onDelete, onArchive, onCancel }: DeleteIssueDialogProps) {
  const archived = issue.status === "archived";
  return (
    <ConfirmDialog
      title={`Delete issue ${issue.issueNumber}, ‘${issue.headline}’?`}
      onCancel={onCancel}
      actions={
        <>
          <Button variant="danger" onClick={onDelete}>
            Delete issue
          </Button>
          {!archived && <Button onClick={onArchive}>Archive instead</Button>}
          <Button data-autofocus onClick={onCancel}>
            Keep it
          </Button>
        </>
      }
    >
      <p>
        It comes off the site straight away and goes to Recently deleted, where you can restore it for {TRASH_DAYS}{" "}
        days. After that it’s deleted for good, with its pages and photos.
      </p>
      {!archived && <p>To keep it without a time limit, archive it instead.</p>}
    </ConfirmDialog>
  );
}

type DeleteForeverDialogProps = {
  issue: Issue;
  onDelete: () => void;
  onCancel: () => void;
};

/** Permanent removal from Recently deleted */
export function DeleteForeverDialog({ issue, onDelete, onCancel }: DeleteForeverDialogProps) {
  return (
    <ConfirmDialog
      title={`Delete issue ${issue.issueNumber}, ‘${issue.headline}’ for good? This can’t be undone.`}
      onCancel={onCancel}
      actions={
        <>
          <Button variant="danger" onClick={onDelete}>
            Delete for good
          </Button>
          <Button data-autofocus onClick={onCancel}>
            Keep it
          </Button>
        </>
      }
    >
      <p>Its pages and uploaded photos are deleted too.</p>
    </ConfirmDialog>
  );
}

import type { IssueStatus } from "../types";

export const STATUS_LABEL: Record<IssueStatus, string> = {
  draft: "Draft",
  published: "Published",
  hidden: "Hidden",
  archived: "Archived",
};

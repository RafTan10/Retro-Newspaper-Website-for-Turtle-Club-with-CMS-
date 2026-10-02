import type { IssueStatus } from "../../types";
import { STATUS_LABEL } from "../status";
import styles from "./Stamp.module.css";

/** Rubber-stamp status badge */
export function Stamp({ status }: { status: IssueStatus }) {
  return <span className={`${styles.stamp} ${styles[status]}`}>{STATUS_LABEL[status]}</span>;
}

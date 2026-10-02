const day = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" });
const shortDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

/** "2026-09-28" -> "September 28, 2026", read as a local date */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return day.format(new Date(y, m - 1, d));
}

/** "Edited by ines@club.example, Sep 29, 2026" */
export function formatEdited(who: string, whenIso: string): string {
  return `Edited by ${who}, ${shortDay.format(new Date(whenIso))}`;
}

/** "Sep 25, 2026" */
export function formatShortDate(whenIso: string): string {
  return shortDay.format(new Date(whenIso));
}

/** "Oct 2, 2026 at 3:14 PM" */
export function formatMoment(whenIso: string): string {
  const when = new Date(whenIso);
  return `${shortDay.format(when)} at ${time.format(when)}`;
}

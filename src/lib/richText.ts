import DOMPurify from "dompurify";

// Text page bodies are stored as HTML limited to paragraphs, line breaks,
// bold, italic, and links. Sanitized when saving and again when rendering.

const ALLOWED_TAGS = ["p", "br", "strong", "em", "a"];
const SAFE_LINK = /^(?:https?:|mailto:)/i;

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.nodeName !== "A") return;
  const href = node.getAttribute("href") ?? "";
  if (!SAFE_LINK.test(href)) {
    node.removeAttribute("href");
    return;
  }
  if (/^https?:/i.test(href)) {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

export function sanitizeRichText(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ["href"],
    ALLOWED_URI_REGEXP: SAFE_LINK,
  });
  return isEmptyRichText(clean) ? "" : clean;
}

/** True for "", "<p></p>", or paragraphs holding only whitespace */
export function isEmptyRichText(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() === ""; // trim() also strips no-break spaces
}

export function plainText(html: string): string {
  return html.replace(/<\/p>\s*<p>/g, "\n\n").replace(/<br\s*\/?>/g, "\n").replace(/<[^>]*>/g, "");
}

/**
 * Cleans HTML pasted from Word (and Google Docs) before the editor parses it:
 * drops Office comments, styles, XML islands and empty paragraphs. The editor's
 * schema then keeps only paragraphs, bold, italic, and links.
 */
export function cleanPastedHtml(html: string): string {
  const stripped = html
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(style|xml|script|meta|link|title)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/?o:p[^>]*>/gi, "");
  const doc = new DOMParser().parseFromString(stripped, "text/html");
  doc.querySelectorAll("p, div, li, h1, h2, h3, h4, h5, h6").forEach((el) => {
    const text = (el.textContent ?? "").trim(); // trim() also strips no-break spaces
    if (!text && !el.querySelector("br")) el.remove();
  });
  return doc.body.innerHTML;
}

// Characters that turn up constantly when Bangla typed with Bijoy (SutonnyMJ)
// is pasted as Unicode: they're where the ANSI font drew Bangla letters.
const BIJOY_CHARS = /[‡ˆ†‰Ô©ª¨¯Í¶¸¹¤¦®¢¡£ÕÖÚ×ÿÆØ]/g;
const BENGALI = /[ঀ-৿]/;

/** Heuristic for legacy Bijoy text that isn't Unicode and shows as Latin gibberish */
export function looksLikeBijoy(text: string): boolean {
  if (BENGALI.test(text)) return false;
  const compact = text.replace(/\s+/g, "");
  if (compact.length < 8) return false;
  const hits = compact.match(BIJOY_CHARS)?.length ?? 0;
  return hits >= 3 && hits / compact.length >= 0.03;
}

export const BIJOY_WARNING =
  "This text looks like it was typed with Bijoy. Convert it to Unicode first, then paste it again.";

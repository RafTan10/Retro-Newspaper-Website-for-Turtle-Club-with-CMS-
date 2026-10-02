const BENGALI = /[ঀ-৿]/g;
const LATIN = /[A-Za-zÀ-ɏ]/g;

/**
 * "bn" when a piece of text is mainly Bangla, so the browser picks the Bangla
 * font and line breaking and the CSS can give it more line height.
 */
export function langFor(text: string | undefined | null): "bn" | undefined {
  if (!text) return undefined;
  const plain = text.replace(/<[^>]*>/g, "");
  const bn = plain.match(BENGALI)?.length ?? 0;
  if (bn === 0) return undefined;
  const latin = plain.match(LATIN)?.length ?? 0;
  return bn >= latin ? "bn" : undefined;
}

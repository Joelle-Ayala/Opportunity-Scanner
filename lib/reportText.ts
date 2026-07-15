const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "...",
  ldquo: '"',
  lsquo: "'",
  lt: "<",
  nbsp: " ",
  ndash: "-",
  quot: '"',
  rdquo: '"',
  rsquo: "'"
};

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x")) {
      const codePoint = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    if (entity.startsWith("#")) {
      const codePoint = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

export function plainSourceText(value: unknown): string {
  if (typeof value !== "string") return "";

  const decoded = decodeHtmlEntities(decodeHtmlEntities(value));
  return decoded
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function cappedText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;

  const candidate = value.slice(0, Math.max(1, maxLength - 3)).trimEnd();
  const sentenceEnd = Math.max(candidate.lastIndexOf(". "), candidate.lastIndexOf("? "), candidate.lastIndexOf("! "));
  if (sentenceEnd >= Math.floor(maxLength * 0.55)) {
    return `${candidate.slice(0, sentenceEnd + 1).trimEnd()}...`;
  }

  const wordEnd = candidate.lastIndexOf(" ");
  return `${(wordEnd > 0 ? candidate.slice(0, wordEnd) : candidate).trimEnd()}...`;
}

export function sourceEvidenceText(value: unknown, fallback: string, maxLength = 520): string {
  const clean = plainSourceText(value) || plainSourceText(fallback) || "Source details need review.";
  return cappedText(clean, maxLength);
}

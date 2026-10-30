const MENTION_PATTERN = /@([a-zA-Z0-9_]+)/g;

export function extractMentions(content: string): string[] {
  const nicknames = [...content.matchAll(MENTION_PATTERN)].map((match) =>
    match[1].toLowerCase(),
  );
  return [...new Set(nicknames)];
}

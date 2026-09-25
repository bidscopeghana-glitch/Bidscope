/** Groq Orpheus accepts at most 200 characters per speech request. */
export function spokenExcerpt(answer: string): string {
  const plain = answer.replace(/https?:\/\/\S+/g, "the link on screen").replace(/\s+/g, " ").trim();
  if (plain.length <= 190) return plain;
  const sentence = plain.slice(0, 190).match(/^.{40,175}?[.!?](?=\s|$)/);
  if (sentence) return sentence[0];
  const prefix = plain.slice(0, 186);
  const lastSpace = prefix.lastIndexOf(" ");
  return `${prefix.slice(0, lastSpace > 80 ? lastSpace : 186).trimEnd()}…`;
}

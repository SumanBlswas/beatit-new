export function sanitizeSongTitle(title: string): string {
  if (!title) return title;
  let cleaned = title
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
  cleaned = cleaned.replace(/\s*\([^)]*\)/g, '');
  cleaned = cleaned.replace(/\s*\[[^\]]*\]/g, '');
  cleaned = cleaned.replace(/\s*\{[^}]*\}/g, '');
  cleaned = cleaned.trim();
  return cleaned;
}

export default sanitizeSongTitle; 
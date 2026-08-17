// ============================================================
// lib/email-parser.ts
// ============================================================
import { DiscoveredEmail } from './apollo';

/**
 * Scans raw Markdown text for email addresses using a robust regex.
 * Excludes image file extensions that might look like emails (e.g., image@2x.png).
 */
export function findEmailWithRegex(text: string): DiscoveredEmail[] {
  if (!text) return [];

  // Robust regex to find emails in unstructured text
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  const matches = text.match(emailRegex);

  if (!matches || matches.length === 0) {
    return [];
  }

  // Common file extensions that get falsely flagged as emails in scraped code
  const excludeExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.js', '.css'];

  // Filter out invalid matches and deduplicate
  const uniqueEmails = Array.from(new Set(matches.map(e => e.toLowerCase())));
  
  const validEmails = uniqueEmails.filter((email) => {
    // Exclude file extensions
    if (excludeExtensions.some(ext => email.endsWith(ext))) return false;
    // Exclude example/placeholder emails
    if (email.includes('example.com') || email.includes('domain.com')) return false;
    return true;
  });

  return validEmails.map(email => ({
    email,
    source: 'website_scrape',
    confidence: 'low' // Regex is naturally lower confidence than a verified API
  }));
}

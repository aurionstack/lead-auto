import type { SocialCategory } from './types';

const seller = [
  /\[for\s*hire\]/i, /\bfor\s+hire\b/i, /available\s+for\s+(work|freelance|hire|projects)/i,
  /\bhire\s+me\b/i, /my\s+portfolio/i, /offering\s+my\s+services/i,
  /i\s+(can\s+build|will\s+create)\s+your/i, /open\s+for\s+commissions/i,
  /freelancer\s+for\s+hire/i, /check\s+out\s+my\s+work/i,
];
const buyer = [
  /\[hiring\]/i, /\bhiring\b/i, /looking\s+for\s+(a|an|someone|developer|editor|freelancer|engineer|expert)/i,
  /need\s+(a|an|someone|help|developer|editor|freelancer|engineer|to\s+build|to\s+fix)/i,
  /seeking\s+(a|an|someone|developer|editor)/i, /\bbudget\s*:/i, /\bpaying\s+\$?\d+/i,
  /\$\d+\s*(\/hr|\/hour|flat|fixed)?/i, /job\s+(offer|posting|opportunity)/i,
];
const keywords: Record<SocialCategory, string[]> = {
  'Web Dev': ['next.js', 'nextjs', 'react', 'tailwind', 'fastapi', 'python developer', 'mvp', 'saas', 'landing page', 'stripe', 'web developer', 'frontend developer', 'fullstack', 'full stack', 'bug fix', 'web app', 'django', 'node'],
  'AI Automation': ['ai agent', 'workflow automation', 'make.com', 'n8n', 'whatsapp bot', 'lead automation', 'api integration', 'rag', 'langchain', 'zapier', 'automation', 'crm automation', 'scraper', 'scraping'],
  'Video Editing': ['video editor', 'shorts editor', 'faceless', 'youtube editor', 'remotion', 'motion graphics', 'reels editor', 'tiktok editor', 'video editing', 'long form editor', 'capcut', 'premiere pro'],
};

export function prefilterSocialPost(title: string, body: string): { category: SocialCategory; keyword: string } | null {
  const text = `${title} ${body}`.toLowerCase();
  if (seller.some((pattern) => pattern.test(title) || pattern.test(text.slice(0, 300)))) return null;
  if (!buyer.some((pattern) => pattern.test(text))) return null;
  for (const [category, terms] of Object.entries(keywords) as [SocialCategory, string[]][]) {
    for (const term of terms) {
      if (new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`, 'i').test(text)) {
        return { category, keyword: term };
      }
    }
  }
  return null;
}

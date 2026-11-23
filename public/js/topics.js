// Starter topic rules (docs/08 "Topic classification"). Tune with the tech-news-editor agent.
export const TOPICS = [
  { id: "all", label: "All" },
  { id: "ai", label: "AI", re: /\b(ai|llms?|gpt|claude|gemini|openai|anthropic|machine learning|ml|neural|transformers?|diffusion|agents?|nvidia)\b/i, domains: ["arxiv.org", "huggingface.co"] },
  { id: "security", label: "Security", re: /\b(security|vulnerab\w*|exploit\w*|cve|breach\w*|malware|ransomware|zero[- ]day|hack(ed|ers?)?|privacy|encryption|phishing|backdoor)\b/i, domains: ["krebsonsecurity.com"] },
  { id: "programming", label: "Programming", re: /\b(rust|go(lang)?|python|javascript|typescript|java|c\+\+|zig|haskell|compiler|database|postgres|sqlite|linux|kernel|api|open[- ]source|git)\b/i, domains: ["github.com", "gitlab.com"] },
  { id: "startups", label: "Startups", re: /\b(startup|yc|funding|raises?|series [abc]|founder|ipo|acquisition|acquires?|layoffs?|valuation|ceo)\b/i },
  { id: "hardware", label: "Hardware", re: /\b(chip|cpu|gpu|risc-?v|arm|semiconductor|tsmc|intel|amd|apple silicon|hardware|robot\w*)\b/i },
  { id: "science", label: "Science", re: /\b(science|physics|biology|space|nasa|quantum|climate|research|study)\b/i, domains: ["nature.com", "science.org"] },
];

export function matchesTopic(story, topicId, decodedTitle) {
  const t = TOPICS.find(x => x.id === topicId);
  if (!t || !t.re) return true;
  return t.re.test(decodedTitle) || (story.domain && (t.domains || []).some(d => story.domain === d || story.domain.endsWith("." + d)));
}

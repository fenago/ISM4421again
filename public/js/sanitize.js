// Minimal allow-list sanitizer for HN HTML (docs/07). DOMParser does not execute scripts.
const ALLOWED = { P: [], I: [], EM: [], B: [], STRONG: [], A: ["href"], PRE: [], CODE: [], BR: [] };
const DROP_WITH_CONTENT = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH", "TEMPLATE", "NOSCRIPT", "FORM", "INPUT", "TEXTAREA", "SELECT", "LINK", "META"]);

export function sanitizeHtml(html) {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  clean(root);
  return root.innerHTML;
}

function clean(node) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === Node.TEXT_NODE) continue;
    if (child.nodeType !== Node.ELEMENT_NODE) { child.remove(); continue; }
    const tag = child.tagName;
    if (DROP_WITH_CONTENT.has(tag)) { child.remove(); continue; }
    clean(child);
    if (!(tag in ALLOWED)) { child.replaceWith(...child.childNodes); continue; }
    for (const attr of [...child.attributes]) {
      if (!ALLOWED[tag].includes(attr.name)) child.removeAttribute(attr.name);
    }
    if (tag === "A") {
      const href = child.getAttribute("href") || "";
      if (/^https?:\/\//i.test(href)) {
        child.setAttribute("rel", "nofollow noopener noreferrer");
        child.setAttribute("target", "_blank");
      } else {
        child.removeAttribute("href");
      }
    }
  }
}

// Decode HTML entities in titles for plain-text display (never inserted as HTML).
export function decodeEntities(text) {
  if (!text) return "";
  return new DOMParser().parseFromString(text, "text/html").documentElement.textContent;
}

// Allow-list sanitizer for untrusted HN HTML (docs/07). Owner: security-engineer.
//
// Contract:
//   sanitizeHtml(html) -> string. The ONLY value that may be assigned to innerHTML.
//   decodeEntities(text) -> string. Plain text; assign via textContent / text nodes ONLY.
//   safeHttpUrl(raw) -> string | undefined. Use for any untrusted URL put in an href (e.g. story.url).
//
// Design: the input is parsed into an INERT document (DOMParser: scripts never run, images
// never load). We do not mutate or re-serialize the attacker's tree. Instead we build a NEW tree
// with createElement/createTextNode containing only allow-listed tags and attributes that we set
// ourselves, then serialize that. Because the output contains no raw-text/foreign-content
// elements (script, style, svg, math, noscript, template, ...) and every attribute value is
// produced by us, a re-parse by innerHTML cannot change its meaning (no mutation XSS).

const ALLOWED_TAGS = new Set(["P", "I", "EM", "B", "STRONG", "A", "PRE", "CODE", "BR"]);
// Elements whose content must be discarded entirely (not unwrapped).
const DROP_WITH_CONTENT = new Set([
  "SCRIPT", "STYLE", "IFRAME", "FRAME", "FRAMESET", "OBJECT", "EMBED", "APPLET", "SVG", "MATH",
  "TEMPLATE", "NOSCRIPT", "NOEMBED", "NOFRAMES", "FORM", "INPUT", "BUTTON", "TEXTAREA", "SELECT",
  "OPTION", "LINK", "META", "BASE", "TITLE", "HEAD", "XMP", "PLAINTEXT", "LISTING", "AUDIO",
  "VIDEO", "CANVAS", "DIALOG", "SLOT",
]);
const MAX_INPUT = 200_000; // chars; HN items are far smaller. Bounds CPU on hostile input.
const MAX_DEPTH = 40;      // deeper nesting is flattened to text (stack/CPU guard).

// Returns a normalized absolute http(s) URL, or undefined. Never returns javascript:/data:/etc.
export function safeHttpUrl(raw) {
  if (typeof raw !== "string") return undefined;
  // Strip C0 controls/space/DEL that browsers ignore inside schemes (e.g. "java\tscript:").
  // The URL parser also drops embedded tab/CR/LF, so "jav\nascript:" still parses as javascript:.
  const cleaned = raw.replace(/^[\u0000- ]+/, "");
  if (!cleaned || cleaned.length > 2048) return undefined;
  let u;
  try { u = new URL(cleaned); } catch { return undefined; } // relative/scheme-less URLs rejected
  if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
  return u.href; // parsed + percent-encoded by URL; serializer will attribute-escape it
}

export function sanitizeHtml(html) {
  if (typeof html !== "string" || !html) return "";
  if (html.length > MAX_INPUT) html = html.slice(0, MAX_INPUT);
  // Inert parse. Parser relocates head-only elements; we only walk <body>.
  const src = new DOMParser().parseFromString(`<!doctype html><body>${html}`, "text/html");
  const out = document.implementation.createHTMLDocument("");
  const frag = out.createDocumentFragment();
  copy(src.body, frag, out, 0, { inLink: false });
  const box = out.createElement("div");
  box.appendChild(frag);
  return box.innerHTML;
}

function copy(from, to, doc, depth, ctx) {
  for (const node of from.childNodes) {
    if (node.nodeType === 3) { // text
      to.appendChild(doc.createTextNode(node.data));
      continue;
    }
    if (node.nodeType !== 1) continue; // comments, PIs, CDATA: dropped
    const tag = node.tagName.toUpperCase();
    if (node.namespaceURI !== "http://www.w3.org/1999/xhtml" || DROP_WITH_CONTENT.has(tag)) continue;
    if (depth >= MAX_DEPTH) { // flatten: keep text only
      to.appendChild(doc.createTextNode(plainText(node)));
      continue;
    }
    if (!ALLOWED_TAGS.has(tag)) { // unknown/formatting tag: unwrap, keep (sanitized) children
      copy(node, to, doc, depth + 1, ctx);
      continue;
    }
    if (tag === "A") {
      const href = safeHttpUrl(node.getAttribute("href"));
      if (!href || ctx.inLink) { // no safe URL or nested link: unwrap
        copy(node, to, doc, depth + 1, ctx);
        continue;
      }
      const a = doc.createElement("a");
      a.setAttribute("href", href);
      a.setAttribute("rel", "nofollow noopener noreferrer");
      a.setAttribute("target", "_blank");
      copy(node, a, doc, depth + 1, { inLink: true });
      to.appendChild(a);
      continue;
    }
    const el = doc.createElement(tag.toLowerCase()); // no attributes copied, ever
    if (tag !== "BR") copy(node, el, doc, depth + 1, ctx);
    to.appendChild(el);
  }
}

// Text of a subtree WITHOUT the content of dropped elements (script/style/svg/...), used when flattening deep nesting.
function plainText(node) {
  let out = "";
  for (const n of node.childNodes) {
    if (n.nodeType === 3) out += n.data;
    else if (n.nodeType === 1 && n.namespaceURI === "http://www.w3.org/1999/xhtml" && !DROP_WITH_CONTENT.has(n.tagName.toUpperCase())) out += plainText(n);
  }
  return out;
}

// Decode HTML entities for plain-text display. Output is TEXT: never assign it to innerHTML.
// A <textarea> is an RCDATA element, so the parser decodes entities but never creates elements:
// "&lt;script&gt;" -> "<script>" (literal text), and "<b>x</b>" stays literal text.
let decodeBox;
export function decodeEntities(text) {
  if (typeof text !== "string" || !text) return "";
  if (text.length > MAX_INPUT) text = text.slice(0, MAX_INPUT);
  decodeBox ??= document.implementation.createHTMLDocument("").createElement("textarea");
  decodeBox.innerHTML = text.replace(/</g, "&lt;"); // belt and braces: no tag can ever form
  return decodeBox.textContent;
}

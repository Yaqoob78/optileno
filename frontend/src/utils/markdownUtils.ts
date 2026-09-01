import { marked } from "marked";
import hljs from "highlight.js";

/**
 * Stabilizes incomplete streaming markdown delimiters so partial responses
 * render cleanly without layout jumps, broken tags, or flickering.
 */
export function stabilizeStreamingMarkdown(text: string, isStreaming: boolean): string {
  if (!text) return "";
  if (!isStreaming) return text;

  let stabilized = text;

  // 1. Check for unclosed code fence (```)
  const codeFenceMatches = stabilized.match(/```/g);
  const codeFenceCount = codeFenceMatches ? codeFenceMatches.length : 0;
  const isCodeFenceOpen = codeFenceCount % 2 !== 0;

  if (isCodeFenceOpen) {
    stabilized += "\n```";
    return stabilized;
  }

  // 2. Check for unclosed inline code (`) on the last line
  const lines = stabilized.split("\n");
  const lastLine = lines[lines.length - 1];
  if (!lastLine.trimStart().startsWith("```")) {
    const backtickMatches = lastLine.match(/`/g);
    if (backtickMatches && backtickMatches.length % 2 !== 0) {
      stabilized += "`";
    }
  }

  // 3. Check for incomplete markdown links like [text](http... or [text]
  const openBracketIndex = stabilized.lastIndexOf("[");
  const closeBracketIndex = stabilized.lastIndexOf("]");
  if (openBracketIndex > closeBracketIndex) {
    // Incomplete bracket link: do not break layout
    const textSlice = stabilized.slice(openBracketIndex);
    if (!textSlice.includes("\n")) {
      stabilized += "]";
    }
  } else if (closeBracketIndex > openBracketIndex) {
    const openParenIndex = stabilized.lastIndexOf("(", closeBracketIndex + 1);
    const closeParenIndex = stabilized.lastIndexOf(")");
    if (openParenIndex > closeParenIndex && openParenIndex === closeBracketIndex + 1) {
      stabilized += ")";
    }
  }

  // 4. Check for unclosed bold/italic formatting (e.g. trailing ** or *)
  // Bold (**)
  const boldMatches = stabilized.match(/\*\*/g);
  if (boldMatches && boldMatches.length % 2 !== 0) {
    stabilized += "**";
  }

  // Italic (_)
  const underscoreMatches = stabilized.match(/(?<!\w)_(?!\s)/g);
  const closingUnderscores = stabilized.match(/(?<!\s)_(?!\w)/g);
  const openUnderscores = (underscoreMatches?.length || 0) - (closingUnderscores?.length || 0);
  if (openUnderscores > 0) {
    stabilized += "_";
  }

  // Strikethrough (~~)
  const strikeMatches = stabilized.match(/~~/g);
  if (strikeMatches && strikeMatches.length % 2 !== 0) {
    stabilized += "~~";
  }

  return stabilized;
}

const ALLOWED_MARKDOWN_TAGS = new Set([
  "a",
  "blockquote",
  "br",
  "button",
  "code",
  "del",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "li",
  "ol",
  "p",
  "pre",
  "span",
  "strong",
  "svg",
  "path",
  "rect",
  "polyline",
  "line",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
]);

const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel", "class"]),
  button: new Set(["type", "class", "data-code", "data-copy", "aria-label", "title"]),
  code: new Set(["class"]),
  div: new Set(["class", "data-code", "data-language", "data-streaming"]),
  pre: new Set(["class"]),
  span: new Set(["class"]),
  svg: new Set(["width", "height", "viewbox", "fill", "stroke", "stroke-width", "class", "aria-hidden"]),
  path: new Set(["d", "stroke-linecap", "stroke-linejoin"]),
  rect: new Set(["x", "y", "width", "height", "rx", "ry"]),
  polyline: new Set(["points"]),
  line: new Set(["x1", "y1", "x2", "y2"]),
  table: new Set(["class"]),
  th: new Set(["class", "align"]),
  td: new Set(["class", "align"]),
};

const isSafeHref = (href: string) => {
  if (href.startsWith("/") || href.startsWith("#")) return true;
  try {
    const url = new URL(href, window.location.origin);
    return ["http:", "https:", "mailto:"].includes(url.protocol);
  } catch {
    return false;
  }
};

/**
 * Custom marked renderer with syntax highlighting via highlight.js
 */
const customRenderer = new marked.Renderer();

customRenderer.code = function ({ text, lang }: { text: string; lang?: string }): string {
  const language = (lang && hljs.getLanguage(lang)) ? lang : "";
  let highlightedCode = "";

  try {
    if (language) {
      highlightedCode = hljs.highlight(text, { language, ignoreIllegals: true }).value;
    } else {
      highlightedCode = hljs.highlightAuto(text).value;
    }
  } catch {
    highlightedCode = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  const displayLang = language || (lang ? lang.toLowerCase() : "text");
  const encodedText = encodeURIComponent(text);

  return `
    <div class="code-block-wrapper" data-language="${displayLang}">
      <div class="code-block-header">
        <div class="code-block-info">
          <span class="code-block-lang">${displayLang}</span>
        </div>
        <button type="button" class="code-copy-btn" data-code="${encodedText}" aria-label="Copy code to clipboard" title="Copy code">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="copy-icon" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span class="copy-btn-text">Copy</span>
        </button>
      </div>
      <pre><code class="hljs language-${displayLang}">${highlightedCode}</code></pre>
    </div>
  `;
};

// Configure marked with custom renderer
marked.setOptions({
  renderer: customRenderer,
  breaks: true,
  gfm: true,
});

/**
 * Sanitizes parsed HTML and handles code block copy triggers safely
 */
export function renderSafeMarkdown(content: string, isStreaming = false): string {
  if (!content) return "";
  if (typeof DOMParser === "undefined") return content;

  const stabilized = stabilizeStreamingMarkdown(content, isStreaming);
  const parsed = marked.parse(stabilized, {
    async: false,
    breaks: true,
    gfm: true,
  }) as string;

  const document = new DOMParser().parseFromString(parsed, "text/html");

  const sanitizeNode = (node: Node) => {
    if (node.nodeType !== 1) return;

    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();

    if (!ALLOWED_MARKDOWN_TAGS.has(tag)) {
      element.replaceWith(document.createTextNode(element.textContent || ""));
      return;
    }

    const allowedAttrs = ALLOWED_ATTRIBUTES[tag] || new Set();
    Array.from(element.attributes).forEach((attribute) => {
      const attrName = attribute.name.toLowerCase();
      if (!allowedAttrs.has(attrName)) {
        element.removeAttribute(attribute.name);
      }
    });

    if (tag === "a") {
      const href = element.getAttribute("href") || "";
      if (!isSafeHref(href)) {
        element.removeAttribute("href");
      } else if (/^https?:/i.test(href)) {
        element.setAttribute("target", "_blank");
        element.setAttribute("rel", "noreferrer noopener");
      }
    }

    Array.from(element.childNodes).forEach(sanitizeNode);
  };

  Array.from(document.body.childNodes).forEach(sanitizeNode);

  // If streaming and last element is a code-block-wrapper, add streaming badge
  if (isStreaming) {
    const codeWrappers = document.body.querySelectorAll(".code-block-wrapper");
    if (codeWrappers.length > 0) {
      const lastWrapper = codeWrappers[codeWrappers.length - 1];
      const header = lastWrapper.querySelector(".code-block-header");
      const info = lastWrapper.querySelector(".code-block-info");
      if (header && info && !info.querySelector(".code-streaming-badge")) {
        const badge = document.createElement("span");
        badge.className = "code-streaming-badge";
        badge.innerHTML = '<span class="streaming-dot"></span> Generating…';
        info.appendChild(badge);
      }
    }
  }

  return document.body.innerHTML;
}

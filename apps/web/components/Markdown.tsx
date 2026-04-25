"use client";

import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Inline-tuned components: tight spacing for chat bubbles, no giant headings,
// links open in a new tab, code uses the JetBrains mono variable.
//
// We intentionally keep the surface small. Anything not listed here renders
// with react-markdown defaults (which are conservative HTML).

const components: Components = {
  p: ({ children }) => (
    <p style={{ margin: "0 0 0.6em", lineHeight: 1.55 }}>{children}</p>
  ),
  strong: ({ children }) => (
    <strong style={{ fontWeight: 600, color: "var(--ink-1)" }}>{children}</strong>
  ),
  em: ({ children }) => (
    <em style={{ fontStyle: "italic" }}>{children}</em>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: "var(--accent)", textDecoration: "underline" }}
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul style={{ margin: "0.4em 0 0.6em", paddingLeft: "1.2em" }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol style={{ margin: "0.4em 0 0.6em", paddingLeft: "1.4em" }}>{children}</ol>
  ),
  li: ({ children }) => (
    <li style={{ margin: "0.15em 0", lineHeight: 1.5 }}>{children}</li>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return (
        <pre
          style={{
            margin: "0.5em 0",
            padding: "10px 12px",
            background: "var(--bg-elev)",
            border: "1px solid var(--line)",
            borderRadius: 6,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12.5,
            overflowX: "auto",
            lineHeight: 1.45,
          }}
        >
          <code>{children}</code>
        </pre>
      );
    }
    return (
      <code
        style={{
          padding: "1px 5px",
          background: "var(--bg-elev)",
          border: "1px solid var(--line)",
          borderRadius: 4,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "0.9em",
        }}
      >
        {children}
      </code>
    );
  },
  blockquote: ({ children }) => (
    <blockquote
      style={{
        margin: "0.5em 0",
        paddingLeft: 12,
        borderLeft: "2px solid var(--ink-3)",
        color: "var(--ink-2)",
      }}
    >
      {children}
    </blockquote>
  ),
  h1: ({ children }) => (
    <div style={{ fontWeight: 600, fontSize: 15, margin: "0.4em 0 0.3em" }}>
      {children}
    </div>
  ),
  h2: ({ children }) => (
    <div style={{ fontWeight: 600, fontSize: 14.5, margin: "0.4em 0 0.3em" }}>
      {children}
    </div>
  ),
  h3: ({ children }) => (
    <div style={{ fontWeight: 600, fontSize: 14, margin: "0.4em 0 0.2em" }}>
      {children}
    </div>
  ),
  hr: () => (
    <hr
      style={{
        margin: "0.7em 0",
        border: 0,
        borderTop: "1px solid var(--line)",
      }}
    />
  ),
  table: ({ children }) => (
    <div style={{ overflowX: "auto", margin: "0.5em 0" }}>
      <table
        style={{
          borderCollapse: "collapse",
          fontSize: 12.5,
          width: "100%",
        }}
      >
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th
      style={{
        textAlign: "left",
        padding: "6px 10px",
        borderBottom: "1px solid var(--line)",
        fontWeight: 600,
        color: "var(--ink-1)",
      }}
    >
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td
      style={{
        padding: "6px 10px",
        borderBottom: "1px solid var(--line)",
        color: "var(--ink-2)",
      }}
    >
      {children}
    </td>
  ),
};

// Strip the trailing margin from the last block so bubbles don't have an
// awkward gap at the bottom.
const wrapperStyle: React.CSSProperties = {};

export const Markdown = memo(function Markdown({ children }: { children: string }) {
  return (
    <div className="md" style={wrapperStyle}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
        // Don't render raw HTML strings as HTML — keeps things safe and
        // ensures partially-streamed angle brackets don't break parsing.
        skipHtml
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});

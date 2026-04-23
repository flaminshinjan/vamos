// Best-effort partial-JSON parser — closes unterminated strings/braces so
// half-streamed tool-use input is renderable mid-flight.
//
// Not a complete JSON parser. Designed for tool_use input_json_delta shape
// which Claude emits roughly field-by-field.

export function tryParsePartial<T = unknown>(input: string): Partial<T> | null {
  if (!input) return null;

  // 1. Fast path — already complete
  try {
    return JSON.parse(input) as Partial<T>;
  } catch {
    /* fall through */
  }

  // 2. Trim trailing garbage + close open containers
  let s = input;

  // Drop trailing comma / colon / partial-key we can't resolve
  while (/[,:\s]$/.test(s)) s = s.slice(0, -1);

  // Track open containers to close them
  const stack: string[] = [];
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (inString) {
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") stack.pop();
  }

  // Close open string
  if (inString) s += '"';

  // If last char is a comma after a partial value, drop it
  s = s.replace(/,\s*$/g, "");
  // If last key is incomplete (e.g. `"headline":`), drop that key
  s = s.replace(/"[^"]*"\s*:\s*$/g, "");
  s = s.replace(/,\s*$/g, "");

  // Close containers
  while (stack.length > 0) {
    const closer = stack.pop()!;
    // Before closing, drop any dangling partial key
    s = s.replace(/,\s*"[^"]*"\s*$/g, "");
    s += closer;
  }

  try {
    return JSON.parse(s) as Partial<T>;
  } catch {
    return null;
  }
}

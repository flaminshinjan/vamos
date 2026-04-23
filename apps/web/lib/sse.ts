// Tiny SSE reader over fetch. Yields {event, data} as each frame arrives.

export type SSEFrame = { event: string; data: unknown };

export async function* readSSE(
  response: Response,
): AsyncGenerator<SSEFrame, void, unknown> {
  if (!response.body) throw new Error("No response body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const raw = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");

      let event = "message";
      const dataLines: string[] = [];
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) {
          event = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trimStart());
        }
      }
      if (dataLines.length === 0) continue;
      const dataStr = dataLines.join("\n");
      let data: unknown;
      try {
        data = JSON.parse(dataStr);
      } catch {
        data = dataStr;
      }
      yield { event, data };
    }
  }
}

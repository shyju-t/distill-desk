import { ChatError, type ChatMessage } from "./contracts";

export type ProviderTool = { type: "function"; function: { name: string; description?: string; parameters: unknown } };
export type ProviderReply = {
  content: string;
  toolCalls: { id: string; name: string; arguments: string }[];
};
export interface ChatProvider {
  complete(messages: ChatMessage[], tools: ProviderTool[]): Promise<ProviderReply>;
}

export function normalizeOpenAIResponse(value: unknown): ProviderReply {
  if (!value || typeof value !== "object" || !("choices" in value)) {
    throw new ChatError("INVALID_PROVIDER_RESPONSE", "The model returned an unexpected response format.", 502);
  }
  const choices = (value as { choices?: unknown }).choices;
  const first = Array.isArray(choices) ? choices[0] : undefined;
  const message = first?.message;
  if (!message || typeof message !== "object") {
    throw new ChatError("INVALID_PROVIDER_RESPONSE", "The model returned no assistant message.", 502);
  }
  const content = typeof message.content === "string" ? message.content : "";
  const rawCalls = message.tool_calls;
  if (rawCalls !== undefined && !Array.isArray(rawCalls)) {
    throw new ChatError("INVALID_PROVIDER_RESPONSE", "The model returned malformed tool calls.", 502);
  }
  const toolCalls = (rawCalls ?? []).map((call: unknown) => {
    if (!call || typeof call !== "object") throw new ChatError("INVALID_PROVIDER_RESPONSE", "The model returned a malformed tool call.", 502);
    const item = call as { id?: unknown; function?: { name?: unknown; arguments?: unknown } };
    if (typeof item.id !== "string" || typeof item.function?.name !== "string" || typeof item.function?.arguments !== "string") {
      throw new ChatError("INVALID_PROVIDER_RESPONSE", "The model returned a malformed tool call.", 502);
    }
    return { id: item.id, name: item.function.name, arguments: item.function.arguments };
  });
  if (!content && toolCalls.length === 0) {
    throw new ChatError("EMPTY_PROVIDER_RESPONSE", "The model returned an empty message. It may not support this tool-calling format.", 502);
  }
  return { content, toolCalls };
}

// This is the only file that assumes an OpenAI-compatible wire format.
// Replace complete() mapping when Distil Labs supplies its deployment contract.
export class OpenAICompatibleProvider implements ChatProvider {
  constructor(private url: string, private apiKey: string, private model: string, private timeoutMs = 20000) {}

  async complete(messages: ChatMessage[], tools: ProviderTool[]): Promise<ProviderReply> {
    let response: Response;
    try {
      response = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {})
        },
        body: JSON.stringify({ model: this.model, messages, tools, tool_choice: "auto" }),
        signal: AbortSignal.timeout(this.timeoutMs),
        cache: "no-store"
      });
    } catch (error) {
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
        throw new ChatError("MODEL_TIMEOUT", "The model request timed out. Please retry.", 504);
      }
      throw new ChatError("MODEL_UNREACHABLE", "Could not reach the model endpoint. Check its URL and network access.", 502);
    }
    if (response.status === 401 || response.status === 403) {
      throw new ChatError("MODEL_AUTH_FAILED", "The model rejected the configured credentials.", 502);
    }
    if (!response.ok) {
      throw new ChatError(
        response.status === 400 || response.status === 422 ? "MODEL_SCHEMA_OR_TOOLS_UNSUPPORTED" : "MODEL_REQUEST_FAILED",
        response.status === 400 || response.status === 422
          ? "The endpoint rejected the request or tool schema. Its API may need a different adapter."
          : `The model endpoint returned HTTP ${response.status}.`,
        502
      );
    }
    let body: unknown;
    try { body = await response.json(); }
    catch { throw new ChatError("INVALID_PROVIDER_RESPONSE", "The model returned invalid JSON.", 502); }
    return normalizeOpenAIResponse(body);
  }
}

export function createProvider(): ChatProvider {
  const url = process.env.DISTIL_API_URL?.trim();
  const model = process.env.DISTIL_MODEL?.trim();
  if (!url || !model) throw new ChatError("MODEL_NOT_CONNECTED", "Model not connected. Configure DISTIL_API_URL and DISTIL_MODEL on the server.", 503);
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("protocol");
  } catch {
    throw new ChatError("MODEL_CONFIG_INVALID", "DISTIL_API_URL must be an HTTP or HTTPS URL.", 503);
  }
  return new OpenAICompatibleProvider(url, process.env.DISTIL_API_KEY ?? "", model);
}

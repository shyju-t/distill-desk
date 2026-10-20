import { describe, expect, it, vi } from "vitest";
import { ChatError } from "./contracts";
import { createProvider, normalizeOpenAIResponse, OpenAICompatibleProvider } from "./provider";

describe("OpenAI response normalization", () => {
  it("keeps assistant text and tool arguments in order", () => {
    const result = normalizeOpenAIResponse({ choices: [{ message: {
      content: "Checking now.",
      tool_calls: [
        { id: "one", function: { name: "get_subscription", arguments: '{"email":"a@example.com"}' } },
        { id: "two", function: { name: "transfer_to_human", arguments: '{"reason":"requested","summary":"Help"}' } }
      ]
    } }] });
    expect(result.content).toBe("Checking now.");
    expect(result.toolCalls.map((call) => call.id)).toEqual(["one", "two"]);
  });
  it("rejects an empty provider message", () => {
    expect(() => normalizeOpenAIResponse({ choices: [{ message: { content: null } }] })).toThrow(ChatError);
  });
  it("reports missing endpoint configuration", () => {
    const priorUrl = process.env.DISTIL_API_URL;
    const priorModel = process.env.DISTIL_MODEL;
    delete process.env.DISTIL_API_URL;
    delete process.env.DISTIL_MODEL;
    try { expect(() => createProvider()).toThrow("Model not connected"); }
    finally {
      if (priorUrl === undefined) delete process.env.DISTIL_API_URL; else process.env.DISTIL_API_URL = priorUrl;
      if (priorModel === undefined) delete process.env.DISTIL_MODEL; else process.env.DISTIL_MODEL = priorModel;
    }
  });
  it("maps endpoint authentication failures to a safe error", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 401 }));
    try {
      const provider = new OpenAICompatibleProvider("https://example.test/chat", "secret", "model");
      await expect(provider.complete([{ role: "user", content: "Hi" }], [])).rejects.toMatchObject({ code: "MODEL_AUTH_FAILED" });
    } finally { globalThis.fetch = originalFetch; }
  });
});

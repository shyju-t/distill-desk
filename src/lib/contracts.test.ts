import { describe, expect, it } from "vitest";
import { chatRequestSchema } from "./contracts";

describe("chat request", () => {
  it("accepts a user message and rejects empty or oversized content", () => {
    expect(chatRequestSchema.safeParse({ messages: [{ role: "user", content: "Hi" }] }).success).toBe(true);
    expect(chatRequestSchema.safeParse({ messages: [] }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ messages: [{ role: "user", content: "  " }] }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ messages: [{ role: "user", content: "x".repeat(8001) }] }).success).toBe(false);
  });
});

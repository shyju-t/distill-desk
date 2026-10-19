import { describe, expect, it } from "vitest";
import { runChat } from "./chat";
import type { ChatProvider } from "./provider";
import type { ChatMessage } from "./contracts";

describe("chat tool workflow", () => {
  it("returns ordered assistant calls and tool results across model turns", async () => {
    const snapshots: ChatMessage[][] = [];
    let count = 0;
    const provider: ChatProvider = {
      async complete(messages) {
        snapshots.push([...messages]);
        count++;
        if (count === 1) return {
          content: "I'll check that account.",
          toolCalls: [{ id: "call-1", name: "get_subscription", arguments: '{"email":"lucas.moreau@atelier-moreau.fr"}' }]
        };
        return { content: "The subscription lookup is complete.", toolCalls: [] };
      }
    };
    const result = await runChat([{ role: "user", content: "Check lucas.moreau@atelier-moreau.fr" }], provider);
    expect(snapshots).toHaveLength(2);
    expect(snapshots[1].map((message) => message.role)).toEqual(["system", "user", "assistant", "tool"]);
    expect(result.history.map((message) => message.role)).toEqual(["user", "assistant", "tool", "assistant"]);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].result).toMatchObject({ email: "lucas.moreau@atelier-moreau.fr" });
  });
});

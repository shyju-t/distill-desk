import { z } from "zod";

export const messageSchema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("user"), content: z.string().trim().min(1).max(8000) }),
  z.object({ role: z.literal("system"), content: z.string().max(16000) }),
  z.object({ role: z.literal("assistant"), content: z.string().nullable(), tool_calls: z.array(z.object({
    id: z.string(), type: z.literal("function"), function: z.object({ name: z.string(), arguments: z.string() })
  })).optional() }),
  z.object({ role: z.literal("tool"), tool_call_id: z.string(), content: z.string() })
]);

export const chatRequestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(60)
}).refine((value) => value.messages.some((message) => message.role === "user"), "A user message is required");

export type ChatMessage = z.infer<typeof messageSchema>;
export type ToolCall = { id: string; name: string; arguments: Record<string, unknown>; result?: unknown; error?: string };
export type ChatResponse = {
  message: { role: "assistant"; content: string };
  toolCalls: ToolCall[];
  latencyMs: number;
  history: ChatMessage[];
};

export class ChatError extends Error {
  constructor(public code: string, message: string, public status = 500) {
    super(message);
  }
}

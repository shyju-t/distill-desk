import { ChatError, type ChatMessage, type ChatResponse, type ToolCall } from "./contracts";
import { createProvider, type ChatProvider } from "./provider";
import { executeSupportTool, supportPolicy, toolDefinitions } from "./tools";

const MAX_TOOL_ROUNDS = 4;
const MAX_TOTAL_CALLS = 8;

export async function runChat(input: ChatMessage[], provider: ChatProvider = createProvider()): Promise<Omit<ChatResponse, "latencyMs">> {
  const messages: ChatMessage[] = [{ role: "system", content: supportPolicy }, ...input.filter((message) => message.role !== "system")];
  const toolCalls: ToolCall[] = [];
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const reply = await provider.complete(messages, toolDefinitions);
    const assistant: ChatMessage = {
      role: "assistant",
      content: reply.content,
      ...(reply.toolCalls.length ? {
        tool_calls: reply.toolCalls.map((call) => ({
          id: call.id, type: "function" as const,
          function: { name: call.name, arguments: call.arguments }
        }))
      } : {})
    };
    messages.push(assistant);
    if (reply.toolCalls.length === 0) {
      return { message: { role: "assistant", content: reply.content }, toolCalls, history: messages.filter((message) => message.role !== "system") };
    }
    if (round === MAX_TOOL_ROUNDS || toolCalls.length + reply.toolCalls.length > MAX_TOTAL_CALLS) {
      throw new ChatError("TOOL_LIMIT_REACHED", "The model requested too many tool steps. Please start a new chat or retry.", 502);
    }
    for (const call of reply.toolCalls) {
      let args: unknown;
      try { args = JSON.parse(call.arguments); }
      catch { args = null; }
      let result: unknown;
      let error: string | undefined;
      try { result = executeSupportTool(call.name, args, messages); }
      catch (cause) { error = cause instanceof Error ? cause.message : "Tool execution failed."; result = { error }; }
      toolCalls.push({ id: call.id, name: call.name, arguments: args && typeof args === "object" && !Array.isArray(args) ? args as Record<string, unknown> : {}, result, ...(error ? { error } : {}) });
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  throw new ChatError("TOOL_LIMIT_REACHED", "The tool step limit was reached.", 502);
}

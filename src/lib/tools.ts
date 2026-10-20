import Ajv from "ajv";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import job from "../../data/job_description.json";
import { ChatError, type ChatMessage } from "./contracts";
import type { ProviderTool } from "./provider";

type Subscription = {
  email: string;
  plan: string;
  seats: number;
  billing_period: string;
  renewal_date: string;
  payment_method: string;
  invoices: { invoice_id: string; date: string; amount: number; status: string }[];
};
type DatasetRow = { messages: { role: string; content?: string; tool_call_id?: string; tool_calls?: { id: string; function: { name: string; arguments: unknown } }[] }[] };

export const supportPolicy = job.task_description;
export const toolDefinitions = job.tools as ProviderTool[];
const ajv = new Ajv({ allErrors: true });
const validators = new Map(toolDefinitions.map((tool) => [tool.function.name, ajv.compile(tool.function.parameters as object)]));

function datasetFixtures(): { subscriptions: Map<string, Subscription>; resetEmails: Set<string> } {
  const known = new Map<string, Subscription>();
  const resetEmails = new Set<string>();
  for (const file of ["train.jsonl", "test.jsonl"]) {
    const lines = readFileSync(join(process.cwd(), "data", file), "utf8").trim().split(/\r?\n/);
    for (const line of lines) {
      const row = JSON.parse(line) as DatasetRow;
      for (const message of row.messages) {
        for (const call of message.tool_calls ?? []) {
          if (call.function.name !== "send_password_reset") continue;
          try {
            const args = typeof call.function.arguments === "string" ? JSON.parse(call.function.arguments) : call.function.arguments;
            if (typeof args?.email === "string") resetEmails.add(args.email.toLowerCase());
          } catch { /* Invalid example arguments do not become fixtures. */ }
        }
        if (message.role !== "tool" || !message.content) continue;
        try {
          const result = JSON.parse(message.content) as Partial<Subscription>;
          if (typeof result.email === "string" && Array.isArray(result.invoices) && !known.has(result.email.toLowerCase())) {
            known.set(result.email.toLowerCase(), result as Subscription);
          }
        } catch { /* Some tool outputs are plain text. */ }
      }
    }
  }
  return { subscriptions: known, resetEmails };
}

let cachedFixtures: ReturnType<typeof datasetFixtures> | undefined;
function fixtures() { return cachedFixtures ??= datasetFixtures(); }

function stableId(value: string) {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `SIM-${(hash >>> 0).toString(36).toUpperCase()}`;
}

export function executeSupportTool(name: string, argumentsValue: unknown, history: ChatMessage[]): unknown {
  const validate = validators.get(name);
  if (!validate) throw new ChatError("UNKNOWN_TOOL", `Unsupported tool: ${name}`, 422);
  if (!validate(argumentsValue)) {
    throw new ChatError("INVALID_TOOL_ARGUMENTS", `Invalid ${name} arguments: ${ajv.errorsText(validate.errors)}`, 422);
  }
  const args = argumentsValue as Record<string, string | number>;
  if (name === "transfer_to_human") {
    return { status: "simulated", reason: args.reason, summary: args.summary, note: "No real support agent was contacted." };
  }
  const email = String(args.email).toLowerCase();
  const account = fixtures().subscriptions.get(email);
  if (name === "send_password_reset") {
    if (!account && !fixtures().resetEmails.has(email)) throw new ChatError("UNKNOWN_ACCOUNT", "No mock account exists for that email.", 422);
    const confirmed = history.some((message) => message.role === "user" && message.content.toLowerCase().includes(email));
    if (!confirmed) throw new ChatError("EMAIL_NOT_CONFIRMED", "The customer must confirm the account email before a reset can be simulated.", 422);
    return { status: "simulated", email, note: "No email was sent." };
  }
  if (!account) throw new ChatError("UNKNOWN_ACCOUNT", "No mock account exists for that email.", 422);
  if (name === "get_subscription") return account;
  if (name === "open_billing_case") {
    const invoice = account.invoices.find((item) => item.invoice_id === args.invoice_id);
    if (!invoice) throw new ChatError("UNKNOWN_INVOICE", "That invoice does not belong to the mock account.", 422);
    const lookedUp = history.some((message) => {
      if (message.role !== "tool") return false;
      try {
        const result = JSON.parse(message.content) as Partial<Subscription>;
        return result.email?.toLowerCase() === email && result.invoices?.some((item) => item.invoice_id === args.invoice_id);
      } catch { return false; }
    });
    if (!lookedUp) throw new ChatError("SUBSCRIPTION_LOOKUP_REQUIRED", "Look up the subscription before opening a billing case.", 422);
    return {
      case_id: stableId(`${email}:${args.invoice_id}:${args.case_type}:${args.amount}`),
      status: "simulated",
      invoice_id: invoice.invoice_id,
      note: "No real billing case or refund was created."
    };
  }
  throw new ChatError("UNKNOWN_TOOL", `Unsupported tool: ${name}`, 422);
}

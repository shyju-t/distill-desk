/** Server-side caller; never expose the key in browser code. */
import { readFileSync } from "node:fs";

const job = JSON.parse(readFileSync(new URL("./job_description.json", import.meta.url), "utf8"));
type Message = {
  role: "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: unknown[];
  tool_call_id?: string;
};

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export async function complete(messages: Message[]) {
  const response = await fetch(`${env("DISTIL_BASE_URL").replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env("DISTIL_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env("DISTIL_MODEL"),
      messages: [{ role: "system", content: job.task_description }, ...messages],
      tools: job.tools,
      temperature: 0,
      max_tokens: 1024,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`Distil request failed: HTTP ${response.status}`);
  return response.json();
}

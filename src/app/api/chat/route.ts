import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ChatError, chatRequestSchema } from "@/lib/contracts";
import { runChat } from "@/lib/chat";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ connected: Boolean(process.env.DISTIL_API_URL?.trim() && process.env.DISTIL_MODEL?.trim()) });
}

export async function POST(request: Request) {
  const started = performance.now();
  try {
    const body = await request.json();
    const { messages } = chatRequestSchema.parse(body);
    const result = await runChat(messages);
    return NextResponse.json({ ...result, latencyMs: Math.round(performance.now() - started) });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Invalid chat request.", details: error.issues } }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } }, { status: 400 });
    }
    const failure = error instanceof ChatError ? error : new ChatError("INTERNAL_ERROR", "An unexpected server error occurred.");
    return NextResponse.json({ error: { code: failure.code, message: failure.message } }, { status: failure.status });
  }
}

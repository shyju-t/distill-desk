// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Home from "./page";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("chat interface", () => {
  beforeEach(() => {
    sessionStorage.clear();
    HTMLElement.prototype.scrollIntoView = vi.fn();
    if (!globalThis.crypto.randomUUID) {
      Object.defineProperty(globalThis.crypto, "randomUUID", { value: () => Math.random().toString(36).slice(2), configurable: true });
    }
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("sends with Enter, displays the reply, and includes history on the next turn", async () => {
    const requests: { messages: { role: string; content: string }[] }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
      if (!init) return json({ connected: true });
      const request = JSON.parse(String(init.body)) as { messages: { role: string; content: string }[] };
      requests.push(request);
      const content = requests.length === 1 ? "First real model reply" : "Second real model reply";
      return json({
        message: { role: "assistant", content }, toolCalls: [], latencyMs: 24,
        history: [...request.messages, { role: "assistant", content }]
      });
    }));
    render(<Home />);
    const input = await screen.findByRole("textbox", { name: "Message Brightpath Support" });
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(requests).toHaveLength(0);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByText("First real model reply")).toBeTruthy();
    expect(screen.getAllByText("Hello")).toHaveLength(2);

    fireEvent.change(input, { target: { value: "One more question" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByText("Second real model reply")).toBeTruthy();
    expect(requests[1].messages.map((message) => message.role)).toEqual(["user", "assistant", "user"]);
    fireEvent.click(screen.getByRole("button", { name: "New conversation" }));
    await waitFor(() => expect(screen.queryByText("First real model reply")).toBeNull());
  });

  it("keeps the customer message and allows retry after an endpoint error", async () => {
    let attempts = 0;
    vi.stubGlobal("fetch", vi.fn(async (_input: string, init?: RequestInit) => {
      if (!init) return json({ connected: false });
      attempts++;
      if (attempts === 1) return json({ error: { code: "MODEL_NOT_CONNECTED", message: "Model not connected." } }, 503);
      const request = JSON.parse(String(init.body)) as { messages: { role: string; content: string }[] };
      return json({ message: { role: "assistant", content: "Connected reply" }, toolCalls: [], latencyMs: 12, history: [...request.messages, { role: "assistant", content: "Connected reply" }] });
    }));
    render(<Home />);
    const input = await screen.findByRole("textbox", { name: "Message Brightpath Support" });
    fireEvent.change(input, { target: { value: "Help me" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText("Model not connected.")).toBeTruthy();
    expect(screen.getAllByText("Help me")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Connected reply")).toBeTruthy();
    expect(screen.getAllByText("Help me")).toHaveLength(2);
    expect(attempts).toBe(2);
  });
});

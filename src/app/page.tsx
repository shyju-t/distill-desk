"use client";

import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Bot, ChevronDown, CircleHelp, Clock3, Headphones, MessageCircle, Plus, RotateCcw, Send, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import type { ChatMessage, ChatResponse, ToolCall } from "@/lib/contracts";

type Turn = { role: "user" | "assistant"; content: string; toolCalls?: ToolCall[]; latencyMs?: number };
type Thread = { id: string; title: string; turns: Turn[]; history: ChatMessage[] };
type RequestError = { threadId: string; content: string; message: string };
const storageKey = "brightpath-support-threads-v1";
const starterPrompts = [
  { icon: CircleHelp, label: "I can't sign in to my account" },
  { icon: Clock3, label: "When does my subscription renew?" },
  { icon: MessageCircle, label: "I was charged twice this month" }
];

function newThread(): Thread {
  return { id: crypto.randomUUID(), title: "New conversation", turns: [], history: [] };
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div role="alert" className="message-enter ml-11 mt-3 max-w-xl rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
    <div className="font-semibold">Couldn&apos;t get a response</div>
    <p className="mt-1 text-rose-100/75">{message}</p>
    <button onClick={onRetry} className="mt-3 inline-flex items-center gap-2 font-semibold text-rose-100 hover:text-white"><RotateCcw size={14} /> Retry</button>
  </div>;
}

export default function Home() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<RequestError | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      const parsed = saved ? JSON.parse(saved) as { threads: Thread[]; activeId: string } : null;
      if (parsed?.threads?.length) {
        setThreads(parsed.threads);
        setActiveId(parsed.activeId && parsed.threads.some((t) => t.id === parsed.activeId) ? parsed.activeId : parsed.threads[0].id);
      } else {
        const initial = newThread(); setThreads([initial]); setActiveId(initial.id);
      }
    } catch { const initial = newThread(); setThreads([initial]); setActiveId(initial.id); }
    setReady(true);
    fetch("/api/chat").then((response) => response.json()).then((data: { connected: boolean }) => setConnected(data.connected)).catch(() => setConnected(false));
  }, []);
  useEffect(() => {
    if (ready) sessionStorage.setItem(storageKey, JSON.stringify({ threads, activeId }));
  }, [threads, activeId, ready]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [threads, activeId, loading, error]);

  const active = threads.find((thread) => thread.id === activeId);

  async function submit(content: string, retry = false) {
    const text = content.trim();
    if (!text || loading || !active) return;
    const thread = active;
    if (!retry) {
      setThreads((items) => items.map((item) => item.id === thread.id ? {
        ...item,
        title: item.turns.length === 0 ? text.slice(0, 34) : item.title,
        turns: [...(error?.threadId === thread.id ? item.turns.slice(0, -1) : item.turns), { role: "user", content: text }]
      } : item));
      setDraft("");
    }
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...thread.history, { role: "user", content: text }] })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message ?? `Request failed (HTTP ${response.status}).`);
      const result = data as ChatResponse;
      setThreads((items) => items.map((item) => item.id === thread.id ? {
        ...item,
        history: result.history,
        turns: [...item.turns, { role: "assistant", content: result.message.content, toolCalls: result.toolCalls, latencyMs: result.latencyMs }]
      } : item));
    } catch (cause) {
      setError({ threadId: thread.id, content: text, message: cause instanceof Error ? cause.message : "The request failed." });
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  function startNewChat() {
    if (loading) return;
    const thread = newThread();
    setThreads((items) => [thread, ...items]);
    setActiveId(thread.id); setDraft(""); setError(null);
    textareaRef.current?.focus();
  }

  return <main className="app-shell flex h-dvh min-h-[600px] overflow-hidden">
    <aside className="hidden w-[282px] shrink-0 flex-col border-r border-white/[.07] bg-[#0e1516]/90 p-5 md:flex">
      <div className="flex items-center gap-3 px-1 py-2">
        <div className="flex size-10 items-center justify-center rounded-xl bg-[#a5f2d0] text-[#102c25] shadow-[0_0_35px_rgba(165,242,208,.18)]"><span className="text-lg font-black">b.</span></div>
        <div><div className="text-[15px] font-bold tracking-tight">brightpath</div><div className="text-[11px] tracking-[.16em] text-[#7d948d] uppercase">Support desk</div></div>
      </div>
      <button onClick={startNewChat} disabled={loading} className="mt-9 flex h-11 items-center justify-center gap-2 rounded-xl border border-[#a5f2d0]/35 bg-[#a5f2d0]/10 text-sm font-semibold text-[#b7f5d9] transition hover:bg-[#a5f2d0]/20 disabled:opacity-50"><Plus size={17} /> New conversation</button>
      <div className="mt-10 px-2 text-[10px] font-bold tracking-[.2em] text-[#647972] uppercase">Recent conversations</div>
      <nav aria-label="Conversation history" className="subtle-scroll mt-3 flex-1 space-y-1 overflow-y-auto">
        {threads.map((thread) => <button key={thread.id} disabled={loading} onClick={() => { setActiveId(thread.id); setError(null); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] transition disabled:opacity-60 ${thread.id === activeId ? "bg-[#1b2b2a] text-[#e8f4ed]" : "text-[#8ba09a] hover:bg-white/5 hover:text-white"}`}>
          <MessageCircle size={15} className={thread.id === activeId ? "text-[#a5f2d0]" : "text-[#617770]"} />
          <span className="truncate">{thread.title}</span>
        </button>)}
      </nav>
      <div className="rounded-2xl border border-white/[.07] bg-white/[.025] p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#c9dcd3]"><ShieldCheck size={15} className="text-[#a5f2d0]" /> Demo workspace</div>
        <p className="mt-2 text-xs leading-5 text-[#718780]">Tool actions use simulated account data. No real emails or billing changes.</p>
      </div>
      <div className="mt-5 px-2 text-[11px] text-[#52665f]">Powered by Distil Labs · API ready</div>
    </aside>

    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-white/[.07] px-5 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-[#a5f2d0]/20 bg-[#a5f2d0]/10 text-[#a5f2d0] md:hidden"><Headphones size={19} /></div>
          <div><h1 className="text-[15px] font-semibold tracking-tight sm:text-[16px]">Brightpath Support</h1><p className="mt-0.5 text-[11px] text-[#758e85]">Here to help with your workspace</p></div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-white/[.08] bg-white/[.03] px-3 py-1.5 text-[11px] font-medium text-[#9db0a8] sm:flex"><span className={`size-1.5 rounded-full ${connected ? "bg-[#9be8bc]" : "bg-amber-300"}`} />{connected === null ? "Checking connection" : connected ? "Model configured" : "Model not connected"}</div>
          <button onClick={startNewChat} disabled={loading} aria-label="New Chat" title="New Chat" className="flex size-9 items-center justify-center rounded-lg border border-white/[.09] text-[#c7d8cf] transition hover:bg-white/[.06] disabled:opacity-50 md:hidden"><Plus size={18} /></button>
          <div className="hidden size-9 items-center justify-center rounded-full border border-[#a5f2d0]/20 bg-[#a5f2d0]/10 text-xs font-bold text-[#b4efd2] sm:flex">BP</div>
        </div>
      </header>

      <div className="subtle-scroll flex-1 overflow-y-auto px-4 sm:px-8">
        <div className="mx-auto flex min-h-full w-full max-w-[820px] flex-col">
          {active?.turns.length === 0 ? <div className="flex flex-1 flex-col justify-center py-12">
            <div className="mb-8 flex size-14 items-center justify-center rounded-[18px] border border-[#a5f2d0]/20 bg-[#a5f2d0]/10 text-[#a5f2d0] shadow-[0_0_60px_rgba(165,242,208,.09)]"><Sparkles size={25} /></div>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold tracking-[.17em] text-[#9edfc0] uppercase"><span className="h-px w-5 bg-[#9edfc0]/70" /> Welcome to Brightpath</div>
            <h2 className="max-w-[580px] text-3xl font-semibold tracking-[-.035em] text-[#edf5ef] sm:text-[42px] sm:leading-[1.14]">How can we help you<br /><span className="text-[#a5f2d0]">move forward?</span></h2>
            <p className="mt-5 max-w-[510px] text-sm leading-7 text-[#91a59c]">Ask about your account, subscription, or billing. Our support assistant will be ready when the model endpoint is connected.</p>
            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {starterPrompts.map(({ icon: Icon, label }) => <button key={label} onClick={() => { setDraft(label); textareaRef.current?.focus(); }} className="group flex min-h-[104px] flex-col justify-between rounded-2xl border border-white/[.09] bg-[#121b1b] p-4 text-left transition hover:border-[#a5f2d0]/35 hover:bg-[#192724]">
                <Icon size={17} className="text-[#9fd8bc]" />
                <span className="flex items-end justify-between gap-2 text-[12px] font-medium leading-5 text-[#d2e0d7]">{label}<ArrowRight size={14} className="mb-0.5 shrink-0 text-[#607f70] transition group-hover:translate-x-1 group-hover:text-[#a5f2d0]" /></span>
              </button>)}
            </div>
          </div> : <div className="space-y-7 py-9">
            <div className="mb-9 border-b border-white/[.06] pb-5 text-center"><div className="text-[11px] font-semibold tracking-[.15em] text-[#82998e] uppercase">Conversation</div><div className="mt-1 text-xs text-[#60756a]">Brightpath Support</div></div>
            {active?.turns.map((turn, index) => <div key={index} className={`message-enter flex gap-3 ${turn.role === "user" ? "justify-end" : "justify-start"}`}>
              {turn.role === "assistant" && <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#a5f2d0]/20 bg-[#a5f2d0]/10 text-[#a5f2d0]"><Bot size={16} /></div>}
              <div className={`max-w-[min(100%,610px)] ${turn.role === "assistant" ? "flex-1" : ""}`}>
                <div className={`rounded-2xl px-4 py-3.5 text-[14px] leading-6 whitespace-pre-wrap ${turn.role === "user" ? "rounded-br-md bg-[#a5f2d0] text-[#102721]" : "rounded-tl-md border border-white/[.08] bg-[#172120] text-[#e1ebe4]"}`}>{turn.content || (turn.toolCalls?.length ? "The model completed a tool action." : "")}</div>
                {turn.role === "assistant" && <div className="mt-2 flex flex-wrap items-center gap-3 pl-1 text-[11px] text-[#71877d]">
                  {turn.latencyMs !== undefined && <span>{(turn.latencyMs / 1000).toFixed(1)}s response</span>}
                  {!!turn.toolCalls?.length && <details className="group"><summary className="flex cursor-pointer list-none items-center gap-1.5 text-[#a3d9bd] hover:text-[#c3f5d8]"><Wrench size={12} /> {turn.toolCalls.length} tool {turn.toolCalls.length === 1 ? "call" : "calls"} <ChevronDown size={12} className="transition group-open:rotate-180" /></summary>
                    <div className="mt-3 space-y-3">{turn.toolCalls.map((call) => <div key={call.id} className="max-w-[620px] rounded-xl border border-white/[.08] bg-[#101918] p-3 text-xs text-[#bbd0c2]"><div className="font-semibold text-[#b4efd2]">{call.name}{call.error && <span className="ml-2 text-rose-300">Error</span>}</div><div className="mt-2 text-[#779187]">Arguments</div><pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words text-[#c6d7cc]">{JSON.stringify(call.arguments, null, 2)}</pre><div className="mt-2 text-[#779187]">Simulated result</div><pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words text-[#c6d7cc]">{JSON.stringify(call.result, null, 2)}</pre></div>)}</div>
                  </details>}
                </div>}
              </div>
            </div>)}
            {loading && <div aria-label="Assistant is responding" className="message-enter flex items-start gap-3"><div className="flex size-8 items-center justify-center rounded-lg border border-[#a5f2d0]/20 bg-[#a5f2d0]/10 text-[#a5f2d0]"><Bot size={16} /></div><div className="flex h-11 items-center gap-1.5 rounded-2xl rounded-tl-md border border-white/[.08] bg-[#172120] px-4">{[0, 1, 2].map((i) => <span key={i} className="typing-dot size-1.5 rounded-full bg-[#a5f2d0]" />)}</div></div>}
            {error?.threadId === activeId && <ErrorCard message={error.message} onRetry={() => submit(error.content, true)} />}
          </div>}
          <div ref={endRef} />
        </div>
      </div>

      <div className="shrink-0 px-4 pb-4 pt-3 sm:px-8 sm:pb-6">
        <div className="mx-auto max-w-[820px]">
          <form onSubmit={(event) => { event.preventDefault(); submit(draft); }} className="rounded-2xl border border-[#a5f2d0]/20 bg-[#17211f] p-2 shadow-[0_12px_45px_rgba(0,0,0,.25)] focus-within:border-[#a5f2d0]/45">
            <label htmlFor="message" className="sr-only">Message Brightpath Support</label>
            <textarea id="message" ref={textareaRef} rows={2} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(draft); } }} placeholder="Ask us anything about Brightpath..." disabled={loading} className="max-h-40 min-h-[57px] w-full resize-none bg-transparent px-3 py-2 text-[14px] leading-6 text-[#eaf4ec] outline-none placeholder:text-[#71877c] disabled:opacity-60" />
            <div className="flex items-center justify-between border-t border-white/[.06] px-2 pt-2">
              <span className="text-[11px] text-[#647a70]">Enter to send · Shift + Enter for new line</span>
              <button type="submit" disabled={!draft.trim() || loading} className="flex size-9 items-center justify-center rounded-xl bg-[#a5f2d0] text-[#102721] transition hover:bg-[#c0f9df] disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send message"><Send size={16} /></button>
            </div>
          </form>
          <p className="mt-3 text-center text-[11px] text-[#5f746a]">Support tools are simulated. Responses require a connected model endpoint.</p>
        </div>
      </div>
    </section>
  </main>;
}

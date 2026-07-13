"use client";

// Andes AI — the Engineering Copilot (sprint-9.md scope item 4).
// Conversation list + streaming chat over /api/ai/chat. Tool calls are
// surfaced as "consulted" chips (transparency without persistence,
// domain model rec. 5). The Copilot informs; the engineer decides —
// the standing line is part of the chrome, not fine print.
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  MessageSquarePlus,
  SendHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge, Button, Card, CardContent, Input } from "@andes/ui";

import { trpc } from "@/lib/trpc";

function toolLabel(partType: string): string {
  return partType.replace(/^tool-/, "");
}

function ChatPane({
  conversationId,
  initialMessages,
  pendingFirstMessage,
  onTurnDone,
}: {
  conversationId: string;
  initialMessages: UIMessage[];
  pendingFirstMessage: string | null;
  onTurnDone: () => void;
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const sentPendingRef = useRef(false);
  const { messages, sendMessage, status, error } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/ai/chat",
      body: { conversationId },
    }),
    onFinish: onTurnDone,
  });

  useEffect(() => {
    if (pendingFirstMessage && !sentPendingRef.current) {
      sentPendingRef.current = true;
      void sendMessage({ text: pendingFirstMessage });
    }
  }, [pendingFirstMessage, sendMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.length === 0 && !busy && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Ask about your firm&apos;s projects, proposals, inspections,
            calculation records, estudios, or BIM models.
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={
              message.role === "user"
                ? "ml-auto max-w-[85%] rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                : "max-w-[85%] space-y-2"
            }
          >
            {message.role === "assistant" && (
              <div className="flex flex-wrap gap-1.5">
                {message.parts
                  .filter((part) => part.type.startsWith("tool-"))
                  .map((part, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">
                      consulted: {toolLabel(part.type)}
                    </Badge>
                  ))}
              </div>
            )}
            {message.parts.map((part, i) =>
              part.type === "text" && part.text.length > 0 ? (
                <p
                  key={i}
                  className={
                    message.role === "assistant"
                      ? "whitespace-pre-wrap rounded-xl border border-border bg-card px-4 py-2.5 text-sm"
                      : "whitespace-pre-wrap"
                  }
                >
                  {part.text}
                </p>
              ) : null,
            )}
          </div>
        ))}
        {busy && (
          <p className="text-xs text-muted-foreground">Copilot is thinking…</p>
        )}
        {error && (
          <p className="text-sm text-destructive">
            The Copilot could not answer: {error.message}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const text = input.trim();
          if (!text || busy) return;
          void sendMessage({ text });
          setInput("");
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the Copilot…"
          maxLength={4000}
          disabled={busy}
        />
        <Button type="submit" disabled={busy || input.trim().length === 0}>
          <SendHorizontal aria-hidden="true" />
        </Button>
      </form>
    </div>
  );
}

export default function AiPage() {
  const utils = trpc.useUtils();
  const conversations = trpc.ai.listConversations.useQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingFirstMessage, setPendingFirstMessage] = useState<string | null>(
    null,
  );
  const [draft, setDraft] = useState("");

  const selected = trpc.ai.getConversation.useQuery(
    { id: selectedId ?? "" },
    { enabled: selectedId !== null && pendingFirstMessage === null },
  );
  const createConversation = trpc.ai.createConversation.useMutation({
    onSuccess: (created) => {
      setSelectedId(created.id);
      void utils.ai.listConversations.invalidate();
    },
  });
  const deleteConversation = trpc.ai.deleteConversation.useMutation({
    onSuccess: (deleted) => {
      if (deleted.id === selectedId) {
        setSelectedId(null);
        setPendingFirstMessage(null);
      }
      void utils.ai.listConversations.invalidate();
    },
  });

  function startNewConversation() {
    setSelectedId(null);
    setPendingFirstMessage(null);
    setDraft("");
  }

  const initialMessages: UIMessage[] =
    pendingFirstMessage !== null
      ? []
      : (selected.data?.messages ?? []).map((m) => ({
          id: m.id,
          role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
          parts: [{ type: "text" as const, text: m.content }],
        }));

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-6xl flex-col space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Engineering Copilot</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Grounded in your firm&apos;s own records, read-only. The Copilot
          informs — the responsible engineer reviews and decides.
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr] gap-4">
        <div className="flex min-h-0 flex-col gap-2">
          <Button variant="outline" onClick={startNewConversation}>
            <MessageSquarePlus aria-hidden="true" />
            New conversation
          </Button>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {(conversations.data ?? []).map((conversation) => (
              <div
                key={conversation.id}
                className={`group flex items-center gap-1 rounded-lg border px-2 py-1.5 ${
                  conversation.id === selectedId
                    ? "border-primary/50 bg-primary/5"
                    : "border-transparent hover:border-border"
                }`}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-sm"
                  title={conversation.title}
                  onClick={() => {
                    setPendingFirstMessage(null);
                    setSelectedId(conversation.id);
                  }}
                >
                  {conversation.title}
                </button>
                <button
                  type="button"
                  aria-label="Delete conversation"
                  className="invisible text-muted-foreground hover:text-destructive group-hover:visible"
                  onClick={() => {
                    if (window.confirm("Delete this conversation?")) {
                      deleteConversation.mutate({ id: conversation.id });
                    }
                  }}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
            {conversations.data && conversations.data.length === 0 && (
              <p className="px-2 text-xs text-muted-foreground">
                No conversations yet.
              </p>
            )}
          </div>
        </div>

        <Card className="min-h-0">
          <CardContent className="flex h-full min-h-0 flex-col pt-6">
            {selectedId === null ? (
              <div className="flex h-full flex-col items-center justify-center gap-4">
                <Sparkles
                  className="size-8 text-muted-foreground"
                  aria-hidden="true"
                />
                <p className="max-w-md text-center text-sm text-muted-foreground">
                  Start a conversation — for example: &quot;which proposals are
                  still awaiting a decision?&quot; or &quot;explain the bearing
                  checks in EG-2026-001&quot;.
                </p>
                <form
                  className="flex w-full max-w-lg gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const text = draft.trim();
                    if (!text || createConversation.isPending) return;
                    setPendingFirstMessage(text);
                    createConversation.mutate({ firstMessage: text });
                  }}
                >
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Ask the Copilot…"
                    maxLength={4000}
                    autoFocus
                  />
                  <Button
                    type="submit"
                    disabled={
                      createConversation.isPending || draft.trim().length === 0
                    }
                  >
                    <SendHorizontal aria-hidden="true" />
                  </Button>
                </form>
                {createConversation.error && (
                  <p className="text-sm text-destructive">
                    {createConversation.error.message}
                  </p>
                )}
              </div>
            ) : pendingFirstMessage === null && selected.isLoading ? (
              <p className="text-sm text-muted-foreground">
                Loading conversation…
              </p>
            ) : (
              <ChatPane
                key={selectedId}
                conversationId={selectedId}
                initialMessages={initialMessages}
                pendingFirstMessage={pendingFirstMessage}
                onTurnDone={() => {
                  setPendingFirstMessage(null);
                  void utils.ai.listConversations.invalidate();
                  void utils.ai.getConversation.invalidate({
                    id: selectedId,
                  });
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client";

// Normas — Norms Reference (sprint-11.md scope item 3): search the
// firm's licensed standards with section-cited passages. Results and
// expanded ranges come from the platform DB; the client never sees a
// whole document (200-line cap, the copyright guard).
import { BookOpen, ChevronDown, ChevronUp, Search } from "lucide-react";
import { useState } from "react";

import { Badge, Button, Card, CardContent, Input, Select } from "@andes/ui";

import { trpc } from "@/lib/trpc";

function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  if (terms.length === 0) return <>{text}</>;
  const pattern = new RegExp(
    `(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "giu",
  );
  // With a single capturing group, split() interleaves: even indices are
  // plain text, odd indices are matches — no stateful regex .test().
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-primary/15 px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function ResultCard({
  result,
  terms,
}: {
  result: {
    id: string;
    docKey: string;
    startLine: number;
    endLine: number;
    section: string | null;
    content: string;
  };
  terms: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const range = trpc.norms.getRange.useQuery(
    {
      docKey: result.docKey,
      from: Math.max(1, result.startLine - 10),
      to: result.endLine + 30,
    },
    { enabled: expanded },
  );

  return (
    <Card>
      <CardContent className="space-y-2 pt-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono text-[11px]">
            {result.docKey}
          </Badge>
          {result.section && (
            <Badge variant="outline" className="font-mono text-[11px]">
              sección ≈ {result.section}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            líneas {result.startLine}–{result.endLine}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <ChevronUp aria-hidden="true" />
            ) : (
              <ChevronDown aria-hidden="true" />
            )}
            {expanded ? "Contraer" : "Ver pasaje"}
          </Button>
        </div>
        {expanded ? (
          range.data ? (
            <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-3 font-sans text-sm">
              <Highlighted text={range.data.text} terms={terms} />
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">Cargando pasaje…</p>
          )
        ) : (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            <Highlighted
              text={result.content.replace(/\s+/g, " ").slice(0, 400)}
              terms={terms}
            />
            …
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function NormasPage() {
  const [query, setQuery] = useState("");
  const [docKey, setDocKey] = useState("ALL");
  const [submitted, setSubmitted] = useState<{
    query: string;
    docKey?: string;
  } | null>(null);

  const documents = trpc.norms.listDocuments.useQuery();
  const search = trpc.norms.search.useQuery(
    submitted
      ? { query: submitted.query, docKey: submitted.docKey, limit: 10 }
      : { query: "" },
    { enabled: submitted !== null },
  );

  const terms = (submitted?.query ?? "")
    .split(/\s+/)
    .filter((t) => t.length > 2);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Normas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Busca en las normas licenciadas de la firma — resultados citados por
          sección. La norma decide; el ingeniero interpreta y aplica.
        </p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const q = query.trim();
          if (q.length < 2) return;
          setSubmitted({
            query: q,
            docKey: docKey === "ALL" ? undefined : docKey,
          });
        }}
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ej. longitud de desarrollo a tracción, deriva máxima permisible…"
          maxLength={200}
          autoFocus
        />
        <Select
          aria-label="Documento"
          className="w-44"
          value={docKey}
          onChange={(e) => setDocKey(e.target.value)}
        >
          <option value="ALL">Todas las normas</option>
          {(documents.data ?? []).map((doc) => (
            <option key={doc.key} value={doc.key}>
              {doc.key}
            </option>
          ))}
        </Select>
        <Button type="submit" disabled={query.trim().length < 2}>
          <Search aria-hidden="true" />
          Buscar
        </Button>
      </form>

      {!submitted ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          <BookOpen
            className="mx-auto mb-3 size-6 text-muted-foreground"
            aria-hidden="true"
          />
          {documents.data && documents.data.length === 0
            ? "No hay normas ingeridas aún — corre pnpm --filter @andes/db ingest-norms."
            : "Escribe una consulta — insensible a acentos y mayúsculas."}
        </div>
      ) : search.isLoading ? (
        <p className="text-sm text-muted-foreground">Buscando…</p>
      ) : search.error ? (
        <p className="text-sm text-destructive">{search.error.message}</p>
      ) : search.data && search.data.length > 0 ? (
        <div className="space-y-3">
          {search.data.map((result) => (
            <ResultCard key={result.id} result={result} terms={terms} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Sin coincidencias — prueba con menos términos o sinónimos.
        </div>
      )}
    </div>
  );
}

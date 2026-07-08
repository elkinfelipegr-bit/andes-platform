"use client";

// Client detail — sprint-3.md scope item 3: data (edit), contacts
// (add/edit/delete), and the client's projects. Archive is OWNER_ADMIN
// only (API enforces; UI mirrors), and never touches projects.
import { Archive, ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
} from "@andes/ui";

import { trpc } from "@/lib/trpc";

import { StatusBadge } from "../../projects/_components/status-badge";
import { ClientForm, type ClientFormPayload } from "../_components/client-form";
import { ContactDialog } from "../_components/contact-dialog";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const utils = trpc.useUtils();
  const client = trpc.clients.get.useQuery({ id });
  const me = trpc.core.me.useQuery();
  const update = trpc.clients.update.useMutation({
    onSuccess: () => {
      void utils.clients.get.invalidate({ id });
      void utils.clients.list.invalidate();
    },
  });
  const archive = trpc.clients.archive.useMutation({
    onSuccess: () => {
      void utils.clients.get.invalidate({ id });
      void utils.clients.list.invalidate();
    },
  });
  const deleteContact = trpc.contacts.delete.useMutation({
    onSuccess: () => void utils.clients.get.invalidate({ id }),
  });

  const isOwnerAdmin = me.data?.activeMembership?.roleKey === "OWNER_ADMIN";

  if (client.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading client…</p>;
  }
  if (!client.data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">Client not found.</p>
        <Button asChild variant="outline">
          <Link href="/crm">
            <ArrowLeft aria-hidden="true" />
            Back to clients
          </Link>
        </Button>
      </div>
    );
  }

  const c = client.data;
  const archived = c.archivedAt !== null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link
            href="/crm"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Clients
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{c.name}</h1>
            {archived ? (
              <Badge variant="outline">Archived</Badge>
            ) : (
              <Badge variant="success">Active</Badge>
            )}
          </div>
          {c.taxId && (
            <p className="font-mono text-sm text-muted-foreground">{c.taxId}</p>
          )}
        </div>
        {isOwnerAdmin && !archived && (
          <Button
            variant="destructive"
            disabled={archive.isPending}
            onClick={() => {
              if (window.confirm(`Archive client ${c.name}?`)) {
                archive.mutate({ id });
              }
            }}
          >
            <Archive aria-hidden="true" />
            {archive.isPending ? "…" : "Archive"}
          </Button>
        )}
      </div>

      {archived && (
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader>
            <CardDescription>
              This client is archived: it no longer appears in pickers, but its
              data, contacts, and projects below remain intact.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client data</CardTitle>
          {update.isSuccess && (
            <CardDescription className="text-success">Saved.</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <ClientForm
            defaultValues={{
              name: c.name,
              taxId: c.taxId ?? "",
              industry: c.industry ?? "",
              address: c.address ?? "",
              city: c.city ?? "",
              phone: c.phone ?? "",
              email: c.email ?? "",
              notes: c.notes ?? "",
            }}
            submitLabel="Save changes"
            busy={update.isPending}
            errorMessage={update.error?.message ?? null}
            onSubmit={(payload: ClientFormPayload) =>
              update.mutate({ id, ...payload })
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Contacts</CardTitle>
              <CardDescription>Your counterparts at {c.name}.</CardDescription>
            </div>
            <ContactDialog
              clientId={id}
              trigger={
                <Button variant="outline" size="sm">
                  <Plus aria-hidden="true" />
                  Add contact
                </Button>
              }
            />
          </div>
        </CardHeader>
        <CardContent>
          {c.contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contacts yet.</p>
          ) : (
            <ul className="space-y-1">
              {c.contacts.map((contact, i) => (
                <li key={contact.id}>
                  {i > 0 && <Separator className="mb-1" />}
                  <div className="flex items-center justify-between gap-4 py-1.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {contact.name}
                        {contact.title && (
                          <span className="ml-2 font-normal text-muted-foreground">
                            {contact.title}
                          </span>
                        )}
                      </p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {[contact.email, contact.phone]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <ContactDialog
                        clientId={id}
                        contact={contact}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${contact.name}`}
                          >
                            <Pencil aria-hidden="true" />
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${contact.name}`}
                        disabled={deleteContact.isPending}
                        onClick={() => {
                          if (
                            window.confirm(`Delete contact ${contact.name}?`)
                          ) {
                            deleteContact.mutate({ id: contact.id });
                          }
                        }}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Projects</CardTitle>
          <CardDescription>
            Engineering work for this client — managed in{" "}
            <Link
              href="/projects"
              className="text-primary underline-offset-2 hover:underline"
            >
              Projects
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          {c.projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No projects for this client yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {c.projects.map((project) => (
                <li
                  key={project.id}
                  className="flex items-center justify-between gap-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Link
                      href={`/projects/${project.id}`}
                      className="font-mono text-xs text-primary underline-offset-2 hover:underline"
                    >
                      {project.code}
                    </Link>
                    <span className="truncate text-sm">{project.name}</span>
                  </div>
                  <StatusBadge status={project.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/lib/api";
import { useWorkspaceStore } from "@/store/workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

const replyStatusVariant: Record<string, any> = {
  new: "default",
  interested: "active",
  not_interested: "paused",
  closed: "finished",
};

export default function InboxPage() {
  const { getToken } = useAuth();
  const { workspaceId } = useWorkspaceStore();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("new");
  const [selected, setSelected] = useState<any>(null);

  const { data } = useQuery({
    queryKey: ["inbox", workspaceId, filter],
    queryFn: async () => {
      const token = await getToken();
      const params: Record<string, string> = { limit: "100" };
      if (filter !== "all") params.status = filter;
      return api.inbox.list(params, workspaceId!, token!);
    },
    enabled: !!workspaceId,
    refetchInterval: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const token = await getToken();
      return api.inbox.update(id, { status }, workspaceId!, token!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      toast({ title: "Updated" });
    },
  });

  const messages = (data as any)?.data ?? [];

  return (
    <div className="flex h-full">
      {/* Message list */}
      <div className="w-80 border-r border-[rgba(255,255,255,0.06)] flex flex-col">
        <div className="p-4 border-b border-[rgba(255,255,255,0.06)]">
          <h1 className="text-sm font-medium text-[#EDEDED] mb-3">Inbox</h1>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All replies</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="interested">Interested</SelectItem>
              <SelectItem value="not_interested">Not interested</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="p-6 text-center text-[#444] text-xs">No messages</div>
          ) : (
            messages.map((m: any) => (
              <button
                key={m.id}
                className={`w-full text-left p-4 border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors ${
                  selected?.id === m.id ? "bg-[rgba(255,255,255,0.04)]" : ""
                }`}
                onClick={() => setSelected(m)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-[#EDEDED] truncate">{m.fromEmail}</p>
                    <p className="text-[10px] text-[#555] truncate mt-0.5">{m.subject}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant={replyStatusVariant[m.status] ?? "default"}>
                      {m.status}
                    </Badge>
                    <span className="text-[10px] text-[#444]">
                      {formatRelative(m.receivedAt)}
                    </span>
                  </div>
                </div>
                {m.lead && (
                  <p className="text-[10px] text-[#444] mt-1">
                    {[m.lead.firstName, m.lead.lastName].filter(Boolean).join(" ") ||
                      m.lead.email}
                  </p>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Message detail */}
      <div className="flex-1 flex flex-col">
        {selected ? (
          <>
            <div className="p-5 border-b border-[rgba(255,255,255,0.06)] flex items-start justify-between">
              <div>
                <p className="text-sm text-[#EDEDED]">{selected.subject}</p>
                <p className="text-xs text-[#555] mt-1">
                  from {selected.fromName ? `${selected.fromName} <${selected.fromEmail}>` : selected.fromEmail}
                </p>
                <p className="text-[10px] text-[#444] mt-0.5">{formatRelative(selected.receivedAt)}</p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateMutation.mutate({ id: selected.id, status: "interested" })}
                >
                  Interested
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    updateMutation.mutate({ id: selected.id, status: "not_interested" })
                  }
                >
                  Not interested
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => updateMutation.mutate({ id: selected.id, status: "closed" })}
                >
                  Close
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-2xl">
                <pre className="text-sm text-[#EDEDED] whitespace-pre-wrap font-sans leading-relaxed">
                  {selected.body}
                </pre>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-[#444]">Select a message</p>
          </div>
        )}
      </div>
    </div>
  );
}

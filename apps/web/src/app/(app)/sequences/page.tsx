"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useWorkspaceStore } from "@/store/workspace";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export default function SequencesPage() {
  const { getToken } = useAuth();
  const { workspaceId } = useWorkspaceStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["sequences", workspaceId],
    queryFn: async () => {
      const token = await getToken();
      return api.sequences.list(workspaceId!, token!);
    },
    enabled: !!workspaceId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      return api.sequences.delete(id, workspaceId!, token!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sequences"] });
      toast({ title: "Sequence deleted" });
    },
  });

  const sequences = (data as any)?.data ?? [];

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-lg font-medium text-[#EDEDED]">Sequences</h1>
          <p className="text-sm text-[#555] mt-0.5">{sequences.length} total</p>
        </div>
        <Link href="/sequences/new">
          <Button size="sm">
            <Plus className="h-3.5 w-3.5" />
            New sequence
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-md bg-[#141414] animate-pulse" />
          ))}
        </div>
      ) : sequences.length === 0 ? (
        <div className="text-center py-20 text-[#444]">
          <p className="text-sm mb-3">No sequences yet</p>
          <Link href="/sequences/new">
            <Button variant="outline" size="sm">
              <Plus className="h-3.5 w-3.5" />
              Build first sequence
            </Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-md border border-[rgba(255,255,255,0.06)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.05)]">
                <th className="text-left px-4 py-3 text-xs text-[#444] font-normal">Name</th>
                <th className="text-right px-4 py-3 text-xs text-[#444] font-normal">Steps</th>
                <th className="text-right px-4 py-3 text-xs text-[#444] font-normal">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sequences.map((s: any) => (
                <tr
                  key={s.id}
                  className="border-b border-[rgba(255,255,255,0.04)] last:border-0 hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/sequences/${s.id}/edit`}
                      className="text-[#EDEDED] hover:text-[#D4924A] transition-colors"
                    >
                      {s.name}
                    </Link>
                    {s.description && (
                      <p className="text-[10px] text-[#444] mt-0.5">{s.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right stat-num text-[#EDEDED]">
                    {s._count?.steps ?? 0}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-[#444]">
                    {formatRelative(s.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        if (confirm("Delete this sequence?")) deleteMutation.mutate(s.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-[#555]" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

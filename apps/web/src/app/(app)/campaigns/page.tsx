"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Plus, Play, Pause, Archive } from "lucide-react";
import { api } from "@/lib/api";
import { useWorkspaceStore } from "@/store/workspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatPercent, formatRelative } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const statusVariant: Record<string, any> = {
  active: "active",
  paused: "paused",
  draft: "draft",
  archived: "finished",
  finished: "finished",
};

export default function CampaignsPage() {
  const { getToken } = useAuth();
  const { workspaceId } = useWorkspaceStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["campaigns", workspaceId],
    queryFn: async () => {
      const token = await getToken();
      return api.campaigns.list(workspaceId!, token!);
    },
    enabled: !!workspaceId,
  });

  const pauseMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      return api.campaigns.pause(id, workspaceId!, token!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({ title: "Campaign paused" });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      return api.campaigns.resume(id, workspaceId!, token!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({ title: "Campaign resumed" });
    },
  });

  const campaigns = (data as any)?.data ?? [];

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-lg font-medium text-[#EDEDED]">Campaigns</h1>
          <p className="text-sm text-[#555] mt-0.5">{campaigns.length} total</p>
        </div>
        <Link href="/campaigns/new">
          <Button size="sm">
            <Plus className="h-3.5 w-3.5" />
            New campaign
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-md bg-[#141414] animate-pulse" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-20 text-[#444]">
          <p className="text-sm mb-3">No campaigns yet</p>
          <Link href="/campaigns/new">
            <Button variant="outline" size="sm">
              <Plus className="h-3.5 w-3.5" />
              Create first campaign
            </Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-md border border-[rgba(255,255,255,0.06)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.05)]">
                <th className="text-left px-4 py-3 text-xs text-[#444] font-normal">Name</th>
                <th className="text-left px-4 py-3 text-xs text-[#444] font-normal">Status</th>
                <th className="text-right px-4 py-3 text-xs text-[#444] font-normal">Sent</th>
                <th className="text-right px-4 py-3 text-xs text-[#444] font-normal">Opens</th>
                <th className="text-right px-4 py-3 text-xs text-[#444] font-normal">Replies</th>
                <th className="text-right px-4 py-3 text-xs text-[#444] font-normal">Leads</th>
                <th className="text-right px-4 py-3 text-xs text-[#444] font-normal">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c: any, i: number) => {
                const sent = c.stats?.sent ?? 0;
                const opens = c.stats?.opens ?? 0;
                return (
                  <tr
                    key={c.id}
                    className="border-b border-[rgba(255,255,255,0.04)] last:border-0 hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="text-[#EDEDED] hover:text-[#D4924A] transition-colors"
                      >
                        {c.name}
                      </Link>
                      <p className="text-[10px] text-[#444] mt-0.5">{c.sequence?.name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant[c.status] ?? "default"}>
                        {c.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right stat-num text-[#EDEDED]">
                      {formatNumber(sent)}
                    </td>
                    <td className="px-4 py-3 text-right stat-num text-[#EDEDED]">
                      {sent > 0 ? formatPercent(opens / sent) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right stat-num text-[#EDEDED]">
                      {c.stats?.replies ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right stat-num text-[#EDEDED]">
                      {formatNumber(c._count?.campaignLeads ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-[#444]">
                      {formatRelative(c.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {c.status === "active" ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => pauseMutation.mutate(c.id)}
                          >
                            <Pause className="h-3.5 w-3.5" />
                          </Button>
                        ) : c.status === "paused" ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => resumeMutation.mutate(c.id)}
                          >
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

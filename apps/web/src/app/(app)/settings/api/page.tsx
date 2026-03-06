"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { Plus, Copy, Trash2, Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";
import { useWorkspaceStore } from "@/store/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { formatRelative } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export default function ApiKeysPage() {
  const { getToken } = useAuth();
  const { workspaceId } = useWorkspaceStore();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["api-keys", workspaceId],
    queryFn: async () => {
      const token = await getToken();
      return api.apiKeys.list(workspaceId!, token!);
    },
    enabled: !!workspaceId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return api.apiKeys.create({ name }, workspaceId!, token!);
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      setNewKey(res.data.key);
      setName("");
      toast({ title: "API key created" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      return api.apiKeys.delete(id, workspaceId!, token!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast({ title: "Key revoked" });
    },
  });

  const keys = (data as any)?.data ?? [];

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-lg font-medium text-[#EDEDED]">API keys</h1>
        <p className="text-sm text-[#555] mt-0.5">
          Use API keys to authenticate requests to the Baliyoemails API.
        </p>
      </div>

      {/* Create key */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <p className="text-sm text-[#EDEDED] mb-4">Create new key</p>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label>Key name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5"
                placeholder="Production, Zapier, etc."
              />
            </div>
            <Button
              onClick={() => createMutation.mutate()}
              loading={createMutation.isPending}
              disabled={!name}
            >
              <Plus className="h-3.5 w-3.5" />
              Create
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Show newly created key */}
      {newKey && (
        <Card className="mb-6 border-[rgba(212,146,74,0.3)]">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs text-[#D4924A] font-medium">
                Copy this key now — it won't be shown again
              </p>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  navigator.clipboard.writeText(newKey);
                  toast({ title: "Copied to clipboard" });
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <code className="text-xs font-mono text-[#EDEDED] break-all bg-[rgba(255,255,255,0.04)] rounded p-2 block">
              {newKey}
            </code>
          </CardContent>
        </Card>
      )}

      {/* Keys list */}
      {keys.length > 0 && (
        <div className="rounded-md border border-[rgba(255,255,255,0.06)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.05)]">
                <th className="text-left px-4 py-3 text-xs text-[#444] font-normal">Name</th>
                <th className="text-left px-4 py-3 text-xs text-[#444] font-normal">Prefix</th>
                <th className="text-right px-4 py-3 text-xs text-[#444] font-normal">Last used</th>
                <th className="text-right px-4 py-3 text-xs text-[#444] font-normal">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {keys.map((k: any) => (
                <tr
                  key={k.id}
                  className="border-b border-[rgba(255,255,255,0.04)] last:border-0"
                >
                  <td className="px-4 py-3 text-[#EDEDED]">{k.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#555]">{k.keyPrefix}</td>
                  <td className="px-4 py-3 text-right text-xs text-[#444]">
                    {k.lastUsedAt ? formatRelative(k.lastUsedAt) : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-[#444]">
                    {formatRelative(k.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        if (confirm("Revoke this API key?")) deleteMutation.mutate(k.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-[#444]" />
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

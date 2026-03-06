"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { Search, Trash2, Ban, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useWorkspaceStore } from "@/store/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { formatRelative } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const statusVariant: Record<string, any> = {
  active: "active",
  paused: "paused",
  pending: "pending",
  replied: "replied",
  bounced: "bounced",
  unsubscribed: "unsubscribed",
  finished: "finished",
};

export default function LeadsPage() {
  const { getToken } = useAuth();
  const { workspaceId } = useWorkspaceStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const { register: registerAdd, handleSubmit: handleAdd, reset: resetAdd } = useForm();

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-workspace-id": workspaceId! },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add lead");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({ title: "Lead added" });
      setAddOpen(false);
      resetAdd();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["leads", workspaceId, search, status, page],
    queryFn: async () => {
      const token = await getToken();
      const params: Record<string, string> = { page: String(page), limit: "50" };
      if (search) params.search = search;
      if (status) params.status = status;
      return api.leads.list(params, workspaceId!, token!);
    },
    enabled: !!workspaceId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      return api.leads.delete(id, workspaceId!, token!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({ title: "Lead deleted" });
    },
  });

  const blacklistMutation = useMutation({
    mutationFn: async ({ value, type }: { value: string; type: "email" | "domain" }) => {
      const token = await getToken();
      return api.leads.blacklist({ value, type }, workspaceId!, token!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({ title: "Blacklisted" });
    },
  });

  const leads = (data as any)?.data ?? [];
  const meta = (data as any)?.meta;

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-medium text-[#EDEDED]">Leads</h1>
          {meta && (
            <p className="text-sm text-[#555] mt-0.5">{meta.total.toLocaleString()} total</p>
          )}
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-3.5 w-3.5" />Add lead</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add lead</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd((d) => addMutation.mutate(d))} className="space-y-4">
              <div>
                <Label>Email *</Label>
                <Input {...registerAdd("email")} className="mt-1.5" placeholder="john@example.com" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>First name</Label>
                  <Input {...registerAdd("firstName")} className="mt-1.5" placeholder="John" />
                </div>
                <div>
                  <Label>Last name</Label>
                  <Input {...registerAdd("lastName")} className="mt-1.5" placeholder="Doe" />
                </div>
              </div>
              <div>
                <Label>Company</Label>
                <Input {...registerAdd("company")} className="mt-1.5" placeholder="Acme Corp" />
              </div>
              <Button type="submit" className="w-full">Add lead</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#444]" />
          <Input
            placeholder="Search by email, name, company..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
            <SelectItem value="bounced">Bounced</SelectItem>
            <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
            <SelectItem value="finished">Finished</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 rounded-md bg-[#141414] animate-pulse" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-20 text-[#444]">
          <p className="text-sm">No leads found</p>
        </div>
      ) : (
        <>
          <div className="rounded-md border border-[rgba(255,255,255,0.06)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.05)]">
                  <th className="text-left px-4 py-3 text-xs text-[#444] font-normal">Email</th>
                  <th className="text-left px-4 py-3 text-xs text-[#444] font-normal">Name</th>
                  <th className="text-left px-4 py-3 text-xs text-[#444] font-normal">Company</th>
                  <th className="text-left px-4 py-3 text-xs text-[#444] font-normal">Status</th>
                  <th className="text-right px-4 py-3 text-xs text-[#444] font-normal">Added</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {leads.map((lead: any) => (
                  <tr
                    key={lead.id}
                    className="border-b border-[rgba(255,255,255,0.04)] last:border-0 hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-[#EDEDED]">
                      {lead.email}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#999]">
                      {[lead.firstName, lead.lastName].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#999]">
                      {lead.company || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={statusVariant[lead.campaignLeads?.[0]?.status ?? "pending"] ?? "default"}>
                        {lead.campaignLeads?.[0]?.status ?? "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-[#444]">
                      {formatRelative(lead.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Blacklist email"
                          onClick={() =>
                            blacklistMutation.mutate({ value: lead.email, type: "email" })
                          }
                        >
                          <Ban className="h-3.5 w-3.5 text-[#444]" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            if (confirm("Delete lead?")) deleteMutation.mutate(lead.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-[#444]" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && meta.total > meta.limit && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-[#444]">
                Page {page} of {Math.ceil(meta.total / meta.limit)}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= Math.ceil(meta.total / meta.limit)}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

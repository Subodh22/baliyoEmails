"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { Plus, CheckCircle, XCircle, RefreshCw, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useWorkspaceStore } from "@/store/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";

export default function DomainsPage() {
  const { getToken } = useAuth();
  const { workspaceId } = useWorkspaceStore();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  const { data, isLoading } = useQuery({
    queryKey: ["domains", workspaceId],
    queryFn: async () => {
      const token = await getToken();
      return api.domains.list(workspaceId!, token!);
    },
    enabled: !!workspaceId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = await getToken();
      return api.domains.create(data, workspaceId!, token!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domains"] });
      toast({ title: "Domain added" });
      setOpen(false);
      reset();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      return api.domains.verify(id, workspaceId!, token!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domains"] });
      toast({ title: "Verification checked" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      return api.domains.delete(id, workspaceId!, token!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domains"] });
      toast({ title: "Domain removed" });
    },
  });

  const domains = (data as any)?.data ?? [];

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-lg font-medium text-[#EDEDED]">Sending domains</h1>
          <p className="text-sm text-[#555] mt-0.5">{domains.length} domains</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-3.5 w-3.5" />
              Add domain
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add sending domain</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={handleSubmit((d) => createMutation.mutate(d))}
              className="space-y-4"
            >
              <div>
                <Label>Domain</Label>
                <Input
                  {...register("domain")}
                  className="mt-1.5"
                  placeholder="mail.yourdomain.com"
                />
              </div>
              <div className="rounded-md bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] p-4 text-xs text-[#555] space-y-1.5">
                <p className="text-[#777] font-medium mb-2">After adding, you'll need to:</p>
                <p>1. Add SPF record to DNS</p>
                <p>2. Add DKIM record to DNS</p>
                <p>3. Add DMARC record to DNS</p>
                <p>4. Click "Verify" to check status</p>
              </div>
              <Button type="submit" className="w-full" loading={createMutation.isPending}>
                Add domain
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 rounded-md bg-[#141414] animate-pulse" />
          ))}
        </div>
      ) : domains.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="text-sm text-[#555] mb-1">No domains added</p>
            <p className="text-xs text-[#444]">Add a sending domain to improve deliverability</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {domains.map((d: any) => (
            <Card key={d.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <p className="text-sm font-mono text-[#EDEDED]">{d.domain}</p>
                      <Badge variant={d.verified ? "active" : "paused"}>
                        {d.verified ? "Verified" : "Unverified"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: "SPF", ok: d.spfVerified },
                        { label: "DKIM", ok: d.dkimVerified },
                        { label: "DMARC", ok: d.dmarcVerified },
                      ].map(({ label, ok }) => (
                        <div key={label} className="flex items-center gap-1.5">
                          {ok ? (
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-[#444]" />
                          )}
                          <span className="text-xs text-[#666]">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => verifyMutation.mutate(d.id)}
                      loading={verifyMutation.isPending}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Verify
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        if (confirm("Remove this domain?")) deleteMutation.mutate(d.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-[#444]" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

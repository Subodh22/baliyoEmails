"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { Plus, Trash2, Activity } from "lucide-react";
import { api } from "@/lib/api";
import { useWorkspaceStore } from "@/store/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";

export default function AccountsPage() {
  const { getToken } = useAuth();
  const { workspaceId } = useWorkspaceStore();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, setValue, watch, reset } = useForm({
    defaultValues: { type: "ses", dailyLimit: 50 },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["accounts", workspaceId],
    queryFn: async () => {
      const token = await getToken();
      return api.accounts.list(workspaceId!, token!);
    },
    enabled: !!workspaceId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = await getToken();
      return api.accounts.create(data, workspaceId!, token!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast({ title: "Account connected" });
      setOpen(false);
      reset();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      return api.accounts.delete(id, workspaceId!, token!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast({ title: "Account removed" });
    },
  });

  const accounts = (data as any)?.data ?? [];
  const accountType = watch("type");

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-lg font-medium text-[#EDEDED]">Email accounts</h1>
          <p className="text-sm text-[#555] mt-0.5">{accounts.length} connected</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-3.5 w-3.5" />
              Connect account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect email account</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={handleSubmit((d) => createMutation.mutate(d))}
              className="space-y-4"
            >
              <div>
                <Label>Account type</Label>
                <div className="mt-1.5">
                  <Select onValueChange={(v) => setValue("type", v)} defaultValue="ses">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ses">Amazon SES</SelectItem>
                      <SelectItem value="smtp">Custom SMTP</SelectItem>
                      <SelectItem value="gmail">Gmail (OAuth)</SelectItem>
                      <SelectItem value="outlook">Outlook (OAuth)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>From name</Label>
                  <Input {...register("name")} className="mt-1.5" placeholder="Alex" />
                </div>
                <div>
                  <Label>Email address</Label>
                  <Input {...register("email")} className="mt-1.5" placeholder="alex@acme.com" />
                </div>
              </div>

              {accountType === "ses" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Access Key ID</Label>
                      <Input {...register("sesAccessKeyId")} className="mt-1.5" placeholder="Leave blank to use env vars" />
                    </div>
                    <div>
                      <Label>Secret Access Key</Label>
                      <Input {...register("sesSecretKey")} type="password" className="mt-1.5" placeholder="Leave blank to use env vars" />
                    </div>
                  </div>
                  <div>
                    <Label>Region</Label>
                    <Input {...register("sesRegion")} className="mt-1.5" placeholder="us-east-1" />
                  </div>
                </>
              )}

              {accountType === "smtp" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>SMTP host</Label>
                      <Input {...register("smtpHost")} className="mt-1.5" placeholder="smtp.gmail.com" />
                    </div>
                    <div>
                      <Label>SMTP port</Label>
                      <Input {...register("smtpPort")} type="number" className="mt-1.5" placeholder="587" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Username</Label>
                      <Input {...register("smtpUser")} className="mt-1.5" />
                    </div>
                    <div>
                      <Label>Password</Label>
                      <Input {...register("smtpPassEnc")} type="password" className="mt-1.5" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>IMAP host</Label>
                      <Input {...register("imapHost")} className="mt-1.5" placeholder="imap.gmail.com" />
                    </div>
                    <div>
                      <Label>IMAP port</Label>
                      <Input {...register("imapPort")} type="number" className="mt-1.5" placeholder="993" />
                    </div>
                  </div>
                </>
              )}

              <div>
                <Label>Daily sending limit</Label>
                <Input {...register("dailyLimit")} type="number" className="mt-1.5" defaultValue={50} />
              </div>

              <Button type="submit" className="w-full" loading={createMutation.isPending}>
                Connect account
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 rounded-md bg-[#141414] animate-pulse" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="text-sm text-[#555] mb-3">No accounts connected</p>
            <p className="text-xs text-[#444]">Connect an email account to start sending</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {accounts.map((a: any) => (
            <Card key={a.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-9 w-9 rounded-full bg-[rgba(212,146,74,0.1)] flex items-center justify-center text-[#D4924A] text-sm font-medium">
                    {a.name[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-[#EDEDED]">{a.name}</p>
                      <Badge variant={a.status === "active" ? "active" : "error"}>
                        {a.status}
                      </Badge>
                      <Badge variant="default">{a.type}</Badge>
                    </div>
                    <p className="text-xs text-[#555] font-mono mt-0.5">{a.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="stat-num text-sm text-[#EDEDED]">
                      {a.sentToday}/{a.dailyLimit}
                    </p>
                    <p className="text-[10px] text-[#444]">sent today</p>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm">
                      <Activity className="h-3.5 w-3.5 text-[#444]" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        if (confirm("Remove this account?")) deleteMutation.mutate(a.id);
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

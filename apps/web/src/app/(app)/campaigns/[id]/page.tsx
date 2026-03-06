"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { Play, Pause, BarChart2, Users, Settings, Plus, Send, SendHorizonal } from "lucide-react";
import { api } from "@/lib/api";
import { useWorkspaceStore } from "@/store/workspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNumber, formatPercent, formatRelative } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const statusVariant: Record<string, any> = {
  active: "active",
  paused: "paused",
  draft: "draft",
  finished: "finished",
};

function LeadRow({ cl, campaignId, workspaceId, getToken, onSent }: {
  cl: any; campaignId: string; workspaceId: string;
  getToken: () => Promise<string | null>; onSent: () => void;
}) {
  const [sending, setSending] = useState(false);

  async function forceSend() {
    setSending(true);
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/campaigns/${campaignId}/leads/${cl.id}/force-send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "x-workspace-id": workspaceId },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Failed");
      toast({ title: "Queued", description: `Step ${json.data.stepNumber} queued for ${cl.lead?.email}` });
      onSent();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  return (
    <tr className="border-b border-[rgba(255,255,255,0.04)] last:border-0">
      <td className="px-4 py-2.5 font-mono text-xs text-[#EDEDED]">{cl.lead?.email}</td>
      <td className="px-4 py-2.5"><Badge variant={cl.status}>{cl.status}</Badge></td>
      <td className="px-4 py-2.5 text-xs text-[#555]">{cl.currentStep}</td>
      <td className="px-4 py-2.5 text-xs text-[#555]">{cl.nextSendAt ? formatRelative(cl.nextSendAt) : "—"}</td>
      <td className="px-4 py-2.5">
        <button
          onClick={forceSend}
          disabled={sending}
          title="Force send now"
          className="text-[#444] hover:text-[#D4924A] transition-colors disabled:opacity-40"
        >
          <SendHorizonal className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

export default function CampaignDetailPage({ params }: { params: { id: string } }) {
  const { getToken } = useAuth();
  const { workspaceId } = useWorkspaceStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["campaign", params.id],
    queryFn: async () => {
      const token = await getToken();
      return api.campaigns.get(params.id, workspaceId!, token!);
    },
    enabled: !!workspaceId,
  });

  const { data: analyticsData } = useQuery({
    queryKey: ["campaign-analytics", params.id],
    queryFn: async () => {
      const token = await getToken();
      return api.analytics.campaign(params.id, workspaceId!, token!);
    },
    enabled: !!workspaceId,
  });

  const pauseMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return api.campaigns.pause(params.id, workspaceId!, token!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign", params.id] });
      toast({ title: "Campaign paused" });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return api.campaigns.resume(params.id, workspaceId!, token!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign", params.id] });
      toast({ title: "Campaign resumed" });
    },
  });

  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [leadEmail, setLeadEmail] = useState("");
  const [testOpen, setTestOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  const testMutation = useMutation({
    mutationFn: async (to: string) => {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/campaigns/${params.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-workspace-id": workspaceId! },
        body: JSON.stringify({ to }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Failed");
      return json;
    },
    onSuccess: (data) => {
      toast({ title: "Test email sent", description: `Sent from ${data.data.from} to ${data.data.to}` });
      setTestOpen(false);
      setTestEmail("");
    },
    onError: (err: Error) => toast({ title: "Failed to send", description: err.message, variant: "destructive" }),
  });

  const addLeadMutation = useMutation({
    mutationFn: async (email: string) => {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/campaigns/${params.id}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-workspace-id": workspaceId! },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign", params.id] });
      toast({ title: "Lead added to campaign" });
      setAddLeadOpen(false);
      setLeadEmail("");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const campaign = (data as any)?.data;
  const analytics = (analyticsData as any)?.data;

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="h-8 w-64 bg-[#141414] rounded animate-pulse mb-8" />
      </div>
    );
  }

  if (!campaign) return <div className="p-8 text-[#555] text-sm">Campaign not found</div>;

  const events = analytics?.events ?? {};
  const sent = events.sent ?? 0;
  const steps = analytics?.steps ?? [];

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-lg font-medium text-[#EDEDED]">{campaign.name}</h1>
            <Badge variant={statusVariant[campaign.status] ?? "default"}>
              {campaign.status}
            </Badge>
          </div>
          <p className="text-sm text-[#555]">
            {campaign.sequence?.name} · {campaign._count?.campaignLeads} leads
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Dialog open={testOpen} onOpenChange={setTestOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Send className="h-3.5 w-3.5" />
                Send test
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Send test email</DialogTitle></DialogHeader>
              <p className="text-xs text-[#555]">Sends step 1 of the sequence to the address below.</p>
              <div className="space-y-4">
                <div>
                  <Label>Recipient email</Label>
                  <Input className="mt-1.5" placeholder="you@example.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
                </div>
                <Button className="w-full" onClick={() => testMutation.mutate(testEmail)} loading={testMutation.isPending}>
                  Send test
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {campaign.status === "active" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => pauseMutation.mutate()}
              loading={pauseMutation.isPending}
            >
              <Pause className="h-3.5 w-3.5" />
              Pause
            </Button>
          ) : campaign.status === "paused" ? (
            <Button
              size="sm"
              onClick={() => resumeMutation.mutate()}
              loading={resumeMutation.isPending}
            >
              <Play className="h-3.5 w-3.5" />
              Resume
            </Button>
          ) : null}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        {[
          { label: "Sent", value: formatNumber(sent) },
          { label: "Opens", value: formatPercent(sent ? (events.opened ?? 0) / sent : 0) },
          { label: "Clicks", value: formatPercent(sent ? (events.clicked ?? 0) / sent : 0) },
          { label: "Replies", value: formatPercent(sent ? (events.replied ?? 0) / sent : 0) },
          { label: "Bounces", value: formatPercent(sent ? (events.bounced ?? 0) / sent : 0) },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-[10px] text-[#444] mb-1">{s.label}</p>
              <p className="stat-num text-lg text-[#EDEDED]">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="analytics">
        <TabsList>
          <TabsTrigger value="analytics">
            <BarChart2 className="h-3.5 w-3.5" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="leads">
            <Users className="h-3.5 w-3.5" />
            Leads
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-3.5 w-3.5" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analytics">
          {steps.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-[#555] mb-4">Performance per step</p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={steps} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                      <XAxis
                        dataKey="step"
                        tickFormatter={(v) => `Step ${v}`}
                        tick={{ fill: "#444", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          background: "#1A1A1A",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: "6px",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="sent" name="Sent" fill="#D4924A" opacity={0.8} radius={[2, 2, 0, 0]} />
                      <Bar dataKey="opens" name="Opens" fill="#6B5035" opacity={0.8} radius={[2, 2, 0, 0]} />
                      <Bar dataKey="replies" name="Replies" fill="#3D2E1F" opacity={0.8} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="leads">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-[#555]">{campaign._count?.campaignLeads ?? 0} leads</p>
            <Dialog open={addLeadOpen} onOpenChange={setAddLeadOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-3.5 w-3.5" />Add lead</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add lead to campaign</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Email address</Label>
                    <Input className="mt-1.5" placeholder="john@example.com" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} />
                  </div>
                  <Button className="w-full" onClick={() => addLeadMutation.mutate(leadEmail)} loading={addLeadMutation.isPending}>
                    Add to campaign
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="p-0">
              {(campaign.campaignLeads ?? []).length === 0 ? (
                <p className="text-sm text-[#555] text-center py-10">No leads yet</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[rgba(255,255,255,0.05)]">
                      <th className="text-left px-4 py-3 text-xs text-[#444] font-normal">Email</th>
                      <th className="text-left px-4 py-3 text-xs text-[#444] font-normal">Status</th>
                      <th className="text-left px-4 py-3 text-xs text-[#444] font-normal">Step</th>
                      <th className="text-left px-4 py-3 text-xs text-[#444] font-normal">Next send</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {(campaign.campaignLeads ?? []).map((cl: any) => (
                      <LeadRow
                        key={cl.id}
                        cl={cl}
                        campaignId={params.id}
                        workspaceId={workspaceId!}
                        getToken={getToken}
                        onSent={() => queryClient.invalidateQueries({ queryKey: ["campaign", params.id] })}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardContent className="p-5 space-y-3 text-sm">
              {[
                { label: "Timezone", value: campaign.timezone },
                { label: "Daily limit", value: `${campaign.dailySendingLimit} emails` },
                { label: "Send window", value: `${campaign.sendingStartHour}:00 – ${campaign.sendingEndHour}:00` },
                { label: "Bounce threshold", value: formatPercent(campaign.bounceThreshold) },
                { label: "Tracking", value: campaign.trackingEnabled ? "Enabled" : "Disabled" },
                { label: "Created", value: formatRelative(campaign.createdAt) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-[#555]">{label}</span>
                  <span className="text-[#EDEDED]">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

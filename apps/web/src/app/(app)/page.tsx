"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/lib/api";
import { useWorkspaceStore } from "@/store/workspace";
import { formatNumber, formatPercent } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Mail, MousePointer, MessageSquare, TrendingUp } from "lucide-react";
import Link from "next/link";

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-[#555] mb-2">{label}</p>
            <p className="text-2xl stat-num">{value}</p>
            {sub && <p className="text-xs text-[#555] mt-1">{sub}</p>}
          </div>
          <div className="text-[#333]">
            <Icon className="h-4 w-4 stroke-[1.5]" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] p-3 text-xs shadow-xl">
      <p className="text-[#666] mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="text-[#EDEDED]">{p.name}:</span>
          <span className="stat-num text-[#D4924A]">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const { getToken } = useAuth();
  const { workspaceId } = useWorkspaceStore();

  const { data: overview } = useQuery({
    queryKey: ["analytics", "overview", workspaceId],
    queryFn: async () => {
      const token = await getToken();
      return api.analytics.overview(workspaceId!, token!);
    },
    enabled: !!workspaceId,
  });

  const { data: timeseries } = useQuery({
    queryKey: ["analytics", "timeseries", workspaceId],
    queryFn: async () => {
      const token = await getToken();
      return api.analytics.timeseries(workspaceId!, token!);
    },
    enabled: !!workspaceId,
  });

  const { data: campaigns } = useQuery({
    queryKey: ["campaigns", workspaceId],
    queryFn: async () => {
      const token = await getToken();
      return api.campaigns.list(workspaceId!, token!);
    },
    enabled: !!workspaceId,
  });

  const stats = (overview as any)?.data;
  const series = (timeseries as any)?.data ?? [];
  const activeCampaigns = ((campaigns as any)?.data ?? []).filter(
    (c: any) => c.status === "active"
  );

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-lg font-medium text-[#EDEDED]">Overview</h1>
        <p className="text-sm text-[#555] mt-0.5">Last 30 days</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        <StatCard
          label="Emails sent"
          value={formatNumber(stats?.sent ?? 0)}
          sub={`${formatNumber(stats?.opens ?? 0)} opens`}
          icon={Mail}
        />
        <StatCard
          label="Open rate"
          value={formatPercent(stats?.openRate ?? 0)}
          sub="vs industry 21%"
          icon={TrendingUp}
        />
        <StatCard
          label="Reply rate"
          value={formatPercent(stats?.replyRate ?? 0)}
          sub={`${formatNumber(stats?.replies ?? 0)} replies`}
          icon={MessageSquare}
        />
        <StatCard
          label="Click rate"
          value={formatPercent(stats?.clickRate ?? 0)}
          sub={`${formatNumber(stats?.clicks ?? 0)} clicks`}
          icon={MousePointer}
        />
      </div>

      {/* Chart */}
      <Card className="mb-8">
        <CardContent className="p-5">
          <p className="text-xs text-[#555] mb-4">Send volume</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4924A" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#D4924A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#444", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="sent"
                  name="Sent"
                  stroke="#D4924A"
                  strokeWidth={1.5}
                  fill="url(#colorSent)"
                />
                <Area
                  type="monotone"
                  dataKey="opens"
                  name="Opens"
                  stroke="#8B6A3A"
                  strokeWidth={1}
                  fill="none"
                  strokeDasharray="3 3"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Active campaigns */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-[#EDEDED]">Active campaigns</p>
          <Link href="/campaigns" className="text-xs text-[#555] hover:text-[#EDEDED] transition-colors">
            View all
          </Link>
        </div>

        {activeCampaigns.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-sm text-[#555]">No active campaigns.</p>
              <Link
                href="/campaigns/new"
                className="mt-2 inline-block text-xs text-[#D4924A] hover:underline"
              >
                Launch your first campaign
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {activeCampaigns.slice(0, 5).map((c: any) => (
              <Link key={c.id} href={`/campaigns/${c.id}`}>
                <Card className="hover:border-[rgba(255,255,255,0.1)] transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[#EDEDED]">{c.name}</p>
                      <p className="text-xs text-[#555] mt-0.5">
                        {c._count?.campaignLeads ?? 0} leads
                      </p>
                    </div>
                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <p className="stat-num text-sm">{c.stats?.sent ?? 0}</p>
                        <p className="text-[10px] text-[#444]">sent</p>
                      </div>
                      <div>
                        <p className="stat-num text-sm">{c.stats?.replies ?? 0}</p>
                        <p className="text-[10px] text-[#444]">replies</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

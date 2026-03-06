"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "@/lib/api";
import { useWorkspaceStore } from "@/store/workspace";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatNumber, formatPercent } from "@/lib/utils";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] p-3 text-xs shadow-xl">
      <p className="text-[#666] mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex gap-3 items-center">
          <span className="text-[#666]">{p.name}</span>
          <span className="stat-num text-[#EDEDED]">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const PERIODS = [
  { label: "7d", value: "7" },
  { label: "30d", value: "30" },
  { label: "90d", value: "90" },
];

export default function AnalyticsPage() {
  const { getToken } = useAuth();
  const { workspaceId } = useWorkspaceStore();
  const [period, setPeriod] = useState("30");

  const { data: overview } = useQuery({
    queryKey: ["analytics", "overview", workspaceId, period],
    queryFn: async () => {
      const token = await getToken();
      return api.analytics.overview(workspaceId!, token!, period);
    },
    enabled: !!workspaceId,
  });

  const { data: timeseries } = useQuery({
    queryKey: ["analytics", "timeseries", workspaceId, period],
    queryFn: async () => {
      const token = await getToken();
      return api.analytics.timeseries(workspaceId!, token!, period);
    },
    enabled: !!workspaceId,
  });

  const stats = (overview as any)?.data;
  const series = (timeseries as any)?.data ?? [];

  const statCards = [
    { label: "Sent", value: formatNumber(stats?.sent ?? 0), key: "sent" },
    { label: "Opens", value: formatNumber(stats?.opens ?? 0), sub: formatPercent(stats?.openRate ?? 0) },
    { label: "Clicks", value: formatNumber(stats?.clicks ?? 0), sub: formatPercent(stats?.clickRate ?? 0) },
    { label: "Replies", value: formatNumber(stats?.replies ?? 0), sub: formatPercent(stats?.replyRate ?? 0) },
    { label: "Bounces", value: formatNumber(stats?.bounces ?? 0), sub: formatPercent(stats?.bounceRate ?? 0) },
  ];

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-lg font-medium text-[#EDEDED]">Analytics</h1>
        <div className="flex items-center gap-1">
          {PERIODS.map((p) => (
            <Button
              key={p.value}
              variant={period === p.value ? "muted" : "ghost"}
              size="sm"
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-[10px] text-[#444] mb-1.5">{s.label}</p>
              <p className="text-xl stat-num text-[#EDEDED]">{s.value}</p>
              {s.sub && <p className="text-xs text-[#D4924A] mt-0.5">{s.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Send volume chart */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <p className="text-xs text-[#555] mb-4">Send volume over time</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4924A" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#D4924A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="sent" name="Sent" stroke="#D4924A" strokeWidth={1.5} fill="url(#g1)" />
                <Area type="monotone" dataKey="opens" name="Opens" stroke="#8B6A3A" strokeWidth={1} fill="none" strokeDasharray="3 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Engagement breakdown */}
      <Card>
        <CardContent className="p-5">
          <p className="text-xs text-[#555] mb-4">Engagement by day</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="replies" name="Replies" fill="#D4924A" opacity={0.8} radius={[2, 2, 0, 0]} />
                <Bar dataKey="clicks" name="Clicks" fill="#6B5035" opacity={0.8} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

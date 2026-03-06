"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { CheckCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useWorkspaceStore } from "@/store/workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const PLANS = [
  {
    name: "free",
    displayName: "Free",
    price: "$0",
    features: ["1 seat", "500 leads", "1 sending domain", "Basic sequences"],
  },
  {
    name: "pro",
    displayName: "Pro",
    price: "$49/mo",
    features: ["3 seats", "10k leads", "5 sending domains", "A/B testing", "Analytics"],
    highlight: true,
  },
  {
    name: "agency",
    displayName: "Agency",
    price: "$149/mo",
    features: ["Unlimited seats", "Unlimited leads", "Unlimited domains", "API access", "White-label"],
  },
];

export default function BillingPage() {
  const { getToken } = useAuth();
  const { workspaceId } = useWorkspaceStore();

  const { data: sub } = useQuery({
    queryKey: ["subscription", workspaceId],
    queryFn: async () => {
      const token = await getToken();
      return api.billing.subscription(workspaceId!, token!);
    },
    enabled: !!workspaceId,
  });

  const checkoutMutation = useMutation({
    mutationFn: async (plan: string) => {
      const token = await getToken();
      return api.billing.checkout({ plan }, workspaceId!, token!);
    },
    onSuccess: (res: any) => {
      window.location.href = res.data.url;
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return api.billing.portal(workspaceId!, token!);
    },
    onSuccess: (res: any) => {
      window.location.href = res.data.url;
    },
  });

  const subscription = (sub as any)?.data;
  const currentPlan = subscription?.plan ?? "free";

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-lg font-medium text-[#EDEDED]">Billing</h1>
          <p className="text-sm text-[#555] mt-0.5">
            Current plan: <span className="text-[#D4924A]">{currentPlan}</span>
            {subscription?.currentPeriodEnd && (
              <span className="text-[#444] ml-2">
                · renews {formatDate(subscription.currentPeriodEnd)}
              </span>
            )}
          </p>
        </div>

        {currentPlan !== "free" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => portalMutation.mutate()}
            loading={portalMutation.isPending}
          >
            Manage billing
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.name;
          return (
            <Card
              key={plan.name}
              className={
                plan.highlight
                  ? "border-[rgba(212,146,74,0.3)]"
                  : ""
              }
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium text-[#EDEDED]">{plan.displayName}</p>
                    <p className="stat-num text-xl text-[#EDEDED] mt-1">{plan.price}</p>
                  </div>
                  {isCurrent && (
                    <Badge variant="active">Current</Badge>
                  )}
                  {plan.highlight && !isCurrent && (
                    <Badge variant="accent">Popular</Badge>
                  )}
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-[#666]">
                      <CheckCircle className="h-3.5 w-3.5 text-[#D4924A]" />
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current plan
                  </Button>
                ) : plan.name === "free" ? (
                  <Button variant="ghost" className="w-full" disabled>
                    Downgrade
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => checkoutMutation.mutate(plan.name)}
                    loading={checkoutMutation.isPending}
                  >
                    Upgrade
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

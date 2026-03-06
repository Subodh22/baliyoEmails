"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@clerk/nextjs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useWorkspaceStore } from "@/store/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Upload, ChevronRight, ChevronLeft } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Required"),
  sequenceId: z.string().min(1, "Required"),
  timezone: z.string().default("UTC"),
  sendingStartHour: z.coerce.number().min(0).max(23).default(9),
  sendingEndHour: z.coerce.number().min(0).max(23).default(17),
  dailySendingLimit: z.coerce.number().min(1).max(500).default(50),
  fromName: z.string().optional(),
  replyToEmail: z.string().email().optional().or(z.literal("")),
  trackingEnabled: z.boolean().default(true),
});

type FormData = z.infer<typeof schema>;

const STEPS = ["Details", "Sequence", "Settings", "Review"];

export default function NewCampaignPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { workspaceId } = useWorkspaceStore();
  const [step, setStep] = useState(0);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const { data: sequencesData } = useQuery({
    queryKey: ["sequences", workspaceId],
    queryFn: async () => {
      const token = await getToken();
      return api.sequences.list(workspaceId!, token!);
    },
    enabled: !!workspaceId,
  });

  const sequences = (sequencesData as any)?.data ?? [];

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const token = await getToken();
      const campaign = await api.campaigns.create(data, workspaceId!, token!);
      const campaignId = (campaign as any).data.id;

      if (csvFile) {
        const formData = new FormData();
        formData.append("file", csvFile);
        formData.append("campaignId", campaignId);
        formData.append("mapping", JSON.stringify({ email: "email" }));

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/leads/import`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "x-workspace-id": workspaceId!,
            },
            body: formData,
          }
        );
        await res.json();
      }

      await api.campaigns.launch(campaignId, workspaceId!, token!);
      return campaignId;
    },
    onSuccess: (id) => {
      toast({ title: "Campaign launched!" });
      router.push(`/campaigns/${id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const formValues = watch();

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-lg font-medium text-[#EDEDED]">New campaign</h1>

        {/* Step indicator */}
        <div className="flex items-center gap-0 mt-4">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`h-1.5 w-8 rounded-full transition-colors ${
                  i <= step ? "bg-[#D4924A]" : "bg-[rgba(255,255,255,0.08)]"
                }`}
              />
              {i < STEPS.length - 1 && (
                <div className="w-1 h-1.5 bg-[#0A0A0A]" />
              )}
            </div>
          ))}
          <span className="ml-3 text-xs text-[#555]">
            {step + 1} / {STEPS.length} — {STEPS[step]}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {step === 0 && (
          <Card>
            <CardContent className="p-6 space-y-5">
              <div>
                <Label htmlFor="name">Campaign name</Label>
                <Input
                  id="name"
                  {...register("name")}
                  className="mt-1.5"
                  placeholder="Q3 Outreach — SaaS founders"
                />
                {errors.name && (
                  <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="fromName">From name</Label>
                <Input
                  id="fromName"
                  {...register("fromName")}
                  className="mt-1.5"
                  placeholder="Alex at Acme"
                />
              </div>
              <div>
                <Label htmlFor="replyToEmail">Reply-to email</Label>
                <Input
                  id="replyToEmail"
                  {...register("replyToEmail")}
                  className="mt-1.5"
                  placeholder="alex@acme.com"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <CardContent className="p-6 space-y-5">
              <div>
                <Label>Sequence</Label>
                <div className="mt-1.5">
                  <Select
                    onValueChange={(v) => setValue("sequenceId", v)}
                    value={formValues.sequenceId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a sequence" />
                    </SelectTrigger>
                    <SelectContent>
                      {sequences.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({s._count?.steps} steps)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {errors.sequenceId && (
                  <p className="text-xs text-red-400 mt-1">{errors.sequenceId.message}</p>
                )}
              </div>

              <div>
                <Label>Upload leads (CSV)</Label>
                <div
                  className="mt-1.5 border border-dashed border-[rgba(255,255,255,0.08)] rounded-md p-8 text-center cursor-pointer hover:border-[rgba(255,255,255,0.14)] transition-colors"
                  onClick={() => document.getElementById("csv-upload")?.click()}
                >
                  <Upload className="h-5 w-5 text-[#444] mx-auto mb-2" />
                  <p className="text-sm text-[#555]">
                    {csvFile ? csvFile.name : "Click to upload CSV"}
                  </p>
                  <p className="text-xs text-[#444] mt-1">
                    Columns: email, first_name, last_name, company
                  </p>
                  <input
                    id="csv-upload"
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Send from (hour)</Label>
                  <Input
                    type="number"
                    {...register("sendingStartHour")}
                    className="mt-1.5"
                    min={0}
                    max={23}
                  />
                </div>
                <div>
                  <Label>Send until (hour)</Label>
                  <Input
                    type="number"
                    {...register("sendingEndHour")}
                    className="mt-1.5"
                    min={0}
                    max={23}
                  />
                </div>
              </div>

              <div>
                <Label>Daily sending limit</Label>
                <Input
                  type="number"
                  {...register("dailySendingLimit")}
                  className="mt-1.5"
                  min={1}
                  max={500}
                />
              </div>

              <div>
                <Label>Timezone</Label>
                <Input
                  {...register("timezone")}
                  className="mt-1.5"
                  placeholder="UTC"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardContent className="p-6 space-y-3">
              <h3 className="text-sm font-medium text-[#EDEDED] mb-4">Review & launch</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-[#666]">
                  <span>Name</span>
                  <span className="text-[#EDEDED]">{formValues.name || "—"}</span>
                </div>
                <div className="flex justify-between text-[#666]">
                  <span>Sequence</span>
                  <span className="text-[#EDEDED]">
                    {sequences.find((s: any) => s.id === formValues.sequenceId)?.name ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between text-[#666]">
                  <span>Leads CSV</span>
                  <span className="text-[#EDEDED]">{csvFile?.name ?? "None"}</span>
                </div>
                <div className="flex justify-between text-[#666]">
                  <span>Daily limit</span>
                  <span className="stat-num text-[#EDEDED]">
                    {formValues.dailySendingLimit}
                  </span>
                </div>
                <div className="flex justify-between text-[#666]">
                  <span>Send window</span>
                  <span className="stat-num text-[#EDEDED]">
                    {formValues.sendingStartHour}:00 – {formValues.sendingEndHour}:00
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between mt-5">
          <Button
            type="button"
            variant="ghost"
            onClick={() => (step > 0 ? setStep(step - 1) : router.back())}
          >
            <ChevronLeft className="h-4 w-4" />
            {step > 0 ? "Back" : "Cancel"}
          </Button>

          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={() => setStep(step + 1)}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" loading={createMutation.isPending}>
              Launch campaign
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

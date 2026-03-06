"use client";

import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/lib/api";
import { useWorkspaceStore } from "@/store/workspace";
import { SequenceBuilder, SequenceFormData } from "@/components/sequence/sequence-builder";
import { toast } from "@/hooks/use-toast";

export default function EditSequencePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { getToken } = useAuth();
  const { workspaceId } = useWorkspaceStore();

  const { data, isLoading } = useQuery({
    queryKey: ["sequence", params.id],
    queryFn: async () => {
      const token = await getToken();
      return api.sequences.get(params.id, workspaceId!, token!);
    },
    enabled: !!workspaceId,
  });

  const mutation = useMutation({
    mutationFn: async (formData: SequenceFormData) => {
      const token = await getToken();
      return api.sequences.update(params.id, formData, workspaceId!, token!);
    },
    onSuccess: () => {
      toast({ title: "Sequence saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const sequence = (data as any)?.data;

  if (isLoading) {
    return (
      <div className="p-8 max-w-2xl">
        <div className="h-6 w-48 bg-[#141414] rounded animate-pulse mb-8" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-[#141414] rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!sequence) return <div className="p-8 text-[#555] text-sm">Sequence not found</div>;

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-lg font-medium text-[#EDEDED]">{sequence.name}</h1>
        <p className="text-sm text-[#555] mt-0.5">{sequence.steps.length} steps</p>
      </div>

      <SequenceBuilder
        defaultValues={{
          name: sequence.name,
          description: sequence.description ?? "",
          steps: sequence.steps.map((s: any) => ({
            stepNumber: s.stepNumber,
            subject: s.subject,
            subjectB: s.subjectB ?? "",
            body: s.body,
            delayDays: s.delayDays,
            plainText: s.plainText,
          })),
        }}
        onSubmit={(d) => mutation.mutate(d)}
        loading={mutation.isPending}
      />
    </div>
  );
}

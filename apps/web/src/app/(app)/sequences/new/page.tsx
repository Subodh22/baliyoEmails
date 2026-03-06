"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/lib/api";
import { useWorkspaceStore } from "@/store/workspace";
import { SequenceBuilder, SequenceFormData } from "@/components/sequence/sequence-builder";
import { toast } from "@/hooks/use-toast";

export default function NewSequencePage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { workspaceId } = useWorkspaceStore();

  const mutation = useMutation({
    mutationFn: async (data: SequenceFormData) => {
      const token = await getToken();
      return api.sequences.create(data, workspaceId!, token!);
    },
    onSuccess: (res: any) => {
      toast({ title: "Sequence saved" });
      router.push(`/sequences/${res.data.id}/edit`);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-lg font-medium text-[#EDEDED]">New sequence</h1>
        <p className="text-sm text-[#555] mt-0.5">Build your email sequence</p>
      </div>

      <SequenceBuilder onSubmit={(d) => mutation.mutate(d)} loading={mutation.isPending} />
    </div>
  );
}

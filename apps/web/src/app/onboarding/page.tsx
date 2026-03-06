"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";
import { useWorkspaceStore } from "@/store/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().min(2, "Workspace name must be at least 2 characters"),
});

export default function OnboardingPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { setWorkspace } = useWorkspaceStore();

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      const token = await getToken();

      // Sync user first
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/sync`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      // Create workspace
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/workspaces`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      return res.json();
    },
    onSuccess: (res: any) => {
      const workspace = res.data;
      setWorkspace(workspace.id, workspace.name, "free");
      toast({ title: "Workspace created!" });
      router.push("/");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="h-10 w-10 rounded-xl bg-[#D4924A] flex items-center justify-center mx-auto mb-4">
            <span className="text-lg font-bold text-[#0A0A0A]">B</span>
          </div>
          <h1 className="text-lg font-medium text-[#EDEDED]">Create your workspace</h1>
          <p className="text-sm text-[#555] mt-1">This is where your team works</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
              <div>
                <Label htmlFor="name">Workspace name</Label>
                <Input
                  id="name"
                  {...register("name")}
                  className="mt-1.5"
                  placeholder="Acme Corp"
                  autoFocus
                />
                {errors.name && (
                  <p className="text-xs text-red-400 mt-1">{String(errors.name.message)}</p>
                )}
              </div>

              <Button type="submit" className="w-full" loading={mutation.isPending}>
                Create workspace
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

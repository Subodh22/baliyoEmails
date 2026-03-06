import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WorkspaceState {
  workspaceId: string | null;
  workspaceName: string | null;
  plan: "free" | "pro" | "agency";
  setWorkspace: (id: string, name: string, plan: "free" | "pro" | "agency") => void;
  clearWorkspace: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspaceId: null,
      workspaceName: null,
      plan: "free",
      setWorkspace: (id, name, plan) => set({ workspaceId: id, workspaceName: name, plan }),
      clearWorkspace: () => set({ workspaceId: null, workspaceName: null, plan: "free" }),
    }),
    { name: "baliyo-workspace" }
  )
);

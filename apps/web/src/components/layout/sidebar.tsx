"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart2,
  Inbox,
  LayoutDashboard,
  Mail,
  Settings,
  Users,
  Zap,
  Globe,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace";
import { UserButton } from "@clerk/nextjs";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/campaigns", icon: Zap, label: "Campaigns" },
  { href: "/sequences", icon: Mail, label: "Sequences" },
  { href: "/leads", icon: Users, label: "Leads" },
  { href: "/inbox", icon: Inbox, label: "Inbox" },
  { href: "/analytics", icon: BarChart2, label: "Analytics" },
  { href: "/accounts", icon: Mail, label: "Accounts" },
  { href: "/domains", icon: Globe, label: "Domains" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { workspaceName } = useWorkspaceStore();

  return (
    <aside className="flex h-screen w-14 flex-col items-center border-r border-[rgba(255,255,255,0.05)] bg-[#0D0D0D] py-3 gap-1">
      {/* Logo */}
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-[#D4924A]">
        <span className="text-xs font-bold text-[#0A0A0A]">B</span>
      </div>

      <div className="flex flex-1 flex-col items-center gap-0.5 w-full px-2">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                "group relative flex h-9 w-full items-center justify-center rounded-md text-[#555] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[#EDEDED]",
                active && "bg-[rgba(255,255,255,0.06)] text-[#EDEDED]"
              )}
            >
              <Icon className="h-4 w-4 stroke-[1.5]" />
              {/* Tooltip */}
              <span className="absolute left-full ml-2.5 z-50 hidden rounded-md bg-[#1A1A1A] border border-[rgba(255,255,255,0.08)] px-2 py-1 text-xs text-[#EDEDED] whitespace-nowrap shadow-lg group-hover:block">
                {label}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-auto">
        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-7 w-7",
              userButtonTrigger: "rounded-full",
            },
          }}
        />
      </div>
    </aside>
  );
}

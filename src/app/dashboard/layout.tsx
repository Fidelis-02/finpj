"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/contexts/auth-context";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, isLoading, router]);

  // If we are finished loading and not authenticated, we don't render the dashboard.
  // The useEffect will handle the redirect.
  if (!isLoading && !isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden">
        <div className="max-w-7xl mx-auto p-6 lg:p-8">
          {isLoading ? <DashboardSkeleton /> : children}
        </div>
      </main>
    </div>
  );
}

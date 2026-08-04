import type { ReactNode } from "react";
import Logo from "@/lib/components/Logo";

// Port of (auth)/+layout.svelte — centred card with the wordmark on top,
// shared by login / register / forgot / reset.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-panel px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo size="lg" />
        </div>
        {children}
      </div>
    </div>
  );
}

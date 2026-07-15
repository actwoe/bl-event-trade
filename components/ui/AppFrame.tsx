import type { ReactNode } from "react";

type AppFrameProps = {
  children: ReactNode;
  className?: string;
};

export function AppFrame({ children, className = "" }: AppFrameProps) {
  return (
    <main className="h-[100dvh] w-full overflow-hidden bg-neutral-100 text-neutral-950 sm:flex sm:items-center sm:justify-center sm:px-6 sm:py-6">
      <section
        className={`flex h-full min-h-0 w-full flex-col overflow-hidden bg-white sm:h-[calc(100dvh-3rem)] sm:min-h-[560px] sm:max-h-[860px] sm:max-w-[520px] sm:rounded-[28px] sm:border sm:border-neutral-200/70 sm:shadow-[0_8px_26px_rgba(15,23,42,0.04)] ${className}`}
      >
        {children}
      </section>
    </main>
  );
}

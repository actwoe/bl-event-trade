"use client";

import { useEffect, type ReactNode } from "react";

type AppFrameProps = {
  children: ReactNode;
  className?: string;
};

export function AppFrame({ children, className = "" }: AppFrameProps) {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousHtmlOverscroll = html.style.overscrollBehavior;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyOverscroll = body.style.overscrollBehavior;

    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      html.style.overscrollBehavior = previousHtmlOverscroll;
      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, []);

  return (
    <main className="fixed inset-0 h-[100dvh] w-full overflow-hidden overscroll-none bg-neutral-100 text-neutral-950 sm:flex sm:items-center sm:justify-center sm:px-6 sm:py-6">
      <section
        className={`flex h-full min-h-0 w-full flex-col overflow-hidden overscroll-none bg-white sm:h-[calc(100dvh-3rem)] sm:min-h-[560px] sm:max-h-[860px] sm:max-w-[520px] sm:rounded-[28px] sm:border sm:border-neutral-200/70 sm:shadow-[0_8px_26px_rgba(15,23,42,0.04)] ${className}`}
      >
        {children}
      </section>
    </main>
  );
}

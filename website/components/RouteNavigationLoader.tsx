"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const MIN_VISIBLE_MS = 350;
const FAILSAFE_MS = 8000;

export default function RouteNavigationLoader() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const search = useMemo(() => searchParams?.toString() ?? "", [searchParams]);

  const [isLoading, setIsLoading] = useState(false);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const rawHref = anchor.getAttribute("href");
      if (!rawHref || rawHref.startsWith("#")) return;

      let nextUrl: URL;
      try {
        nextUrl = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (nextUrl.origin !== window.location.origin) return;

      const currentUrl = new URL(window.location.href);
      const current = `${currentUrl.pathname}${currentUrl.search}`;
      const next = `${nextUrl.pathname}${nextUrl.search}`;
      if (current === next) return;

      startedAtRef.current = Date.now();
      setIsLoading(true);
    };

    document.addEventListener("click", onDocumentClick, true);
    return () => {
      document.removeEventListener("click", onDocumentClick, true);
    };
  }, []);

  useEffect(() => {
    if (!isLoading) return;

    const elapsed = Date.now() - startedAtRef.current;
    const remaining = Math.max(MIN_VISIBLE_MS - elapsed, 0);
    const timer = window.setTimeout(() => {
      setIsLoading(false);
    }, remaining);

    return () => window.clearTimeout(timer);
  }, [pathname, search, isLoading]);

  useEffect(() => {
    if (!isLoading) return;

    const failsafe = window.setTimeout(() => {
      setIsLoading(false);
    }, FAILSAFE_MS);

    return () => window.clearTimeout(failsafe);
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <div className="route-loader-backdrop" role="status" aria-live="polite" aria-label="Loading page">
      <div className="route-loader-card">
        <div className="route-loader-topline" />
        <div className="route-loader-track" aria-hidden="true">
          <div className="route-loader-bar" />
        </div>
        <p className="route-loader-copy">Loading page...</p>
      </div>
    </div>
  );
}

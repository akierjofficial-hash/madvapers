"use client";

import { RefObject, useEffect, useState } from "react";

type ScrollRevealOptions = {
  threshold?: number;
  rootMargin?: string;
};

export default function useScrollReveal<T extends Element>(
  ref: RefObject<T | null>,
  options?: ScrollRevealOptions,
): boolean {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) {
          return;
        }

        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      {
        threshold: options?.threshold ?? 0.1,
        rootMargin: options?.rootMargin ?? "0px 0px -60px 0px",
      },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [ref, options?.rootMargin, options?.threshold]);

  return isVisible;
}


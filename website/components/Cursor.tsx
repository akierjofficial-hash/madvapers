"use client";

import useCursor from "@/hooks/useCursor";
import { useEffect, useState } from "react";

const INTERACTIVE_SELECTOR = "button, a, .product-card, .flavor-card, .ls-card, .testi-card, .interactive-hover";

export default function Cursor() {
  const { x, y, fx, fy } = useCursor();
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const isInteractiveTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return Boolean(target.closest(INTERACTIVE_SELECTOR));
    };

    const onMouseOver = (event: MouseEvent): void => {
      setIsHovering(isInteractiveTarget(event.target));
    };

    const onMouseOut = (event: MouseEvent): void => {
      if (isInteractiveTarget(event.relatedTarget)) {
        return;
      }
      setIsHovering(false);
    };

    document.addEventListener("mouseover", onMouseOver);
    document.addEventListener("mouseout", onMouseOut);

    return () => {
      document.removeEventListener("mouseover", onMouseOver);
      document.removeEventListener("mouseout", onMouseOut);
    };
  }, []);

  return (
    <>
      <div
        className="cursor"
        style={{
          transform: `translate3d(${x - 8}px, ${y - 8}px, 0) scale(${isHovering ? 2 : 1})`,
          borderColor: isHovering ? "#FFD500" : "#0099FF",
        }}
      />
      <div
        className="cursor-follower"
        style={{
          transform: `translate3d(${fx - 20}px, ${fy - 20}px, 0) scale(${isHovering ? 1.45 : 1})`,
          transition: "transform 0.4s ease",
        }}
      />
    </>
  );
}


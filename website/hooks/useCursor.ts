"use client";

import { useEffect, useRef, useState } from "react";

type CursorPosition = {
  x: number;
  y: number;
  fx: number;
  fy: number;
};

const LERP = 0.12;

export default function useCursor(): CursorPosition {
  const [position, setPosition] = useState<CursorPosition>({
    x: 0,
    y: 0,
    fx: 0,
    fy: 0,
  });

  const targetRef = useRef({ x: 0, y: 0 });
  const smoothRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMouseMove = (event: MouseEvent): void => {
      targetRef.current = { x: event.clientX, y: event.clientY };
      setPosition((prev) => ({
        ...prev,
        x: event.clientX,
        y: event.clientY,
      }));
    };

    let frame = 0;

    const tick = (): void => {
      smoothRef.current.x += (targetRef.current.x - smoothRef.current.x) * LERP;
      smoothRef.current.y += (targetRef.current.y - smoothRef.current.y) * LERP;

      setPosition((prev) => ({
        ...prev,
        fx: smoothRef.current.x,
        fy: smoothRef.current.y,
      }));

      frame = window.requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    frame = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return position;
}


"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export default function Loader() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHidden(true);
    }, 2200);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[10000] flex flex-col items-center justify-center gap-6 bg-[#070708] transition-opacity duration-500",
        hidden ? "pointer-events-none opacity-0" : "opacity-100",
      )}
      aria-hidden={hidden}
    >
      <div className="[animation:logoPulse_1.5s_ease-in-out_infinite]">
        <Image src="/logo.png" alt="MDVPRS" width={120} height={120} priority className="h-20 w-auto object-contain" />
      </div>
      <div className="h-[2px] w-[220px] overflow-hidden bg-brand-blue/20">
        <div className="h-full w-0 bg-brand-blue shadow-[0_0_10px_#0099FF] [animation:loadBar_2s_ease_forwards]" />
      </div>
      <p className="font-heading text-[11px] uppercase tracking-[0.35em] text-brand-blue [animation:blink_1s_step-start_infinite]">Initializing</p>
    </div>
  );
}


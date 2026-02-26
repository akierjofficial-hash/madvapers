"use client";

import { useEffect, useState } from "react";
import StickerButton from "@/components/StickerButton";

const STORAGE_KEY = "mdvprs_age_gate_confirmed_v1";

export default function AgeGateModal() {
  const [status, setStatus] = useState<"loading" | "open" | "closed" | "blocked">("loading");

  useEffect(() => {
    try {
      const confirmed = window.localStorage.getItem(STORAGE_KEY) === "true";
      setStatus(confirmed ? "closed" : "open");
    } catch {
      setStatus("open");
    }
  }, []);

  const confirmAge = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // Ignore storage failures and still allow access for current session.
    }
    setStatus("closed");
  };

  const declineAge = () => {
    setStatus("blocked");
  };

  if (status === "loading" || status === "closed") {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/75 p-4 backdrop-blur-[2px]">
      <div className="sticker-panel corner-cut w-full max-w-lg p-6" role="dialog" aria-modal="true" aria-labelledby="age-gate-title">
        {status === "open" ? (
          <>
            <p className="jp-label">年齢確認</p>
            <h2 id="age-gate-title" className="display-h2 text-brand-ink">
              Age Verification
            </h2>
            <p className="mt-3 max-w-md font-body text-base text-brand-muted">
              This website is intended for adults of legal smoking age only. By entering, you confirm that you are 21+ in your region.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <StickerButton onClick={confirmAge}>Enter</StickerButton>
              <StickerButton onClick={declineAge} variant="secondary">
                Exit
              </StickerButton>
            </div>
            <p className="mt-4 text-sm text-brand-muted">No medical or cessation claims are made on this site.</p>
          </>
        ) : (
          <>
            <p className="jp-label">アクセス制限</p>
            <h2 className="display-h2 text-brand-ink">Access Restricted</h2>
            <p className="mt-3 max-w-md font-body text-base text-brand-muted">
              You must be of legal smoking age to access this website.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

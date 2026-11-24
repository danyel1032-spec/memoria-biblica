"use client";

import { useEffect, useState } from "react";
import { loadBible, type Bible } from "@/lib/bible/loader";

export function useBible(id = "rv1909") {
  const [bible, setBible] = useState<Bible | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    loadBible(id)
      .then((b) => alive && setBible(b))
      .catch((e: Error) => alive && setError(e.message || "No se pudo cargar la Biblia."));
    return () => {
      alive = false;
    };
  }, [id, attempt]);
  return { bible, error, retry: () => {
      setError(null);
      setAttempt((a) => a + 1);
    },
  };
}

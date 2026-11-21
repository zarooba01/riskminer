"use client";

import { useEffect } from "react";

/**
 * Przewija do zaznaczonego fragmentu źródła po wyrenderowaniu. Kotwica #fragment w adresie nie wystarcza:
 * treść strony jest strumieniowana (loading.tsx), więc przeglądarka szuka elementu, zanim się pojawi.
 */
export function ScrollToFragment({ id = "fragment" }: { id?: string }) {
  useEffect(() => {
    document.getElementById(id)?.scrollIntoView({ block: "center" });
  }, [id]);
  return null;
}

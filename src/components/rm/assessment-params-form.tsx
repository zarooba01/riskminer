"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { defaultWeights, paramLabels, provinceOptions, subsectorOptions, weightLabels, worksTypeOptions, type AssessmentParams, type ParamKey, type ParamOrigin, type Weights } from "@/lib/assess/types";
import type { ActionResult } from "@/lib/rm/format";

const NONE = "none";
const originLabel: Record<ParamOrigin, { label: string; variant: "outline" | "secondary" | "default" }> = {
  input: { label: "wpisane", variant: "outline" },
  rule: { label: "odczytane z opisu", variant: "secondary" },
  llm: { label: "model AI — potwierdź", variant: "default" },
};

export type ParamsUpdate = Partial<Record<ParamKey, string | number | null>> & { weights?: Weights; top_k?: number };

type Props = {
  params: AssessmentParams;
  origin: Partial<Record<ParamKey, ParamOrigin>>;
  save?: (input: ParamsUpdate) => Promise<ActionResult>;
  /** Wagi cech dotyczą tylko oceny deterministycznej. */
  showWeights?: boolean;
};

function OriginBadge({ origin }: { origin?: ParamOrigin }) {
  if (!origin) return <Badge variant="outline">brak</Badge>;
  const o = originLabel[origin];
  return <Badge variant={o.variant}>{o.label}</Badge>;
}

/** Edytowalne założenia oceny: parametry planu z pochodzeniem, wagi cech podobieństwa i wielkość próby. */
export function AssessmentParamsForm({ params, origin, save, showWeights = true }: Props) {
  const [pending, start] = useTransition();
  const [values, setValues] = useState({
    subsector_main: params.subsector_main ?? NONE,
    works_type: params.works_type ?? NONE,
    province: params.province ?? NONE,
    length_km: params.length_m ? String(params.length_m / 1000).replace(".", ",") : "",
    budget_pln: params.budget_pln ? String(params.budget_pln) : "",
    duration_months: params.duration_months ? String(params.duration_months) : "",
    local_conditions: params.local_conditions ?? "",
  });
  const [weights, setWeights] = useState<Weights>({ ...defaultWeights, ...params.weights });
  const [topK, setTopK] = useState(params.top_k ?? 8);
  const set = (key: keyof typeof values, value: string) => setValues((v) => ({ ...v, [key]: value }));
  const toNumber = (s: string) => (s.trim() ? Number(s.replace(/\s/g, "").replace(",", ".")) : null);

  // Do przeliczenia wysyłamy tylko pola zmienione przez użytkownika — reszta zachowuje pochodzenie (np. „odczytane z opisu”).
  const changed = (): ParamsUpdate => {
    const out: ParamsUpdate = { weights, top_k: topK };
    const sel = (v: string) => (v === NONE ? null : v);
    if (sel(values.subsector_main) !== params.subsector_main) out.subsector_main = sel(values.subsector_main) ?? "";
    if (sel(values.works_type) !== params.works_type) out.works_type = sel(values.works_type) ?? "";
    if (sel(values.province) !== params.province) out.province = sel(values.province) ?? "";
    const len = toNumber(values.length_km);
    if ((len ? Math.round(len * 1000) : null) !== params.length_m) out.length_m = len ? Math.round(len * 1000) : "";
    if (toNumber(values.budget_pln) !== params.budget_pln) out.budget_pln = toNumber(values.budget_pln) ?? "";
    if (toNumber(values.duration_months) !== params.duration_months) out.duration_months = toNumber(values.duration_months) ?? "";
    if ((values.local_conditions.trim() || null) !== params.local_conditions) out.local_conditions = values.local_conditions.trim();
    return out;
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!save) return;
    start(async () => {
      const result = await save(changed());
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  };

  const selectField = (key: "subsector_main" | "works_type" | "province", options: string[]) => (
    <Field>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel>{paramLabels[key]}</FieldLabel>
        <OriginBadge origin={origin[key]} />
      </div>
      <Select value={values[key]} onValueChange={(v) => set(key, v)}>
        <SelectTrigger aria-label={paramLabels[key]}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>nieokreślone</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );

  const inputField = (key: "length_km" | "budget_pln" | "duration_months", param: ParamKey, label: string) => (
    <Field>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor={`p-${key}`}>{label}</FieldLabel>
        <OriginBadge origin={origin[param]} />
      </div>
      <Input id={`p-${key}`} value={values[key]} onChange={(e) => set(key, e.target.value)} inputMode="decimal" />
    </Field>
  );

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold">Parametry planu</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {selectField("subsector_main", subsectorOptions)}
          {selectField("works_type", worksTypeOptions)}
          {selectField("province", provinceOptions)}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {inputField("length_km", "length_m", "Długość sieci (km)")}
          {inputField("budget_pln", "budget_pln", "Budżet brutto (zł)")}
          {inputField("duration_months", "duration_months", "Czas realizacji (mies.)")}
        </div>
        <Field>
          <div className="flex items-center justify-between gap-2">
            <FieldLabel htmlFor="p-local">{paramLabels.local_conditions}</FieldLabel>
            <OriginBadge origin={origin.local_conditions} />
          </div>
          <Textarea id="p-local" rows={2} value={values.local_conditions} onChange={(e) => set("local_conditions", e.target.value)} />
        </Field>
      </section>

      {showWeights && (
      <section className="flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold">Wagi cech podobieństwa</h3>
          <p className="text-xs text-muted-foreground">Wynik podobieństwa to ważona suma cech. Cechy, których plan nie podaje, nie wpływają na wynik (wagi są wtedy przeliczane).</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {(Object.keys(weightLabels) as (keyof Weights)[]).map((key) => (
            <Field key={key}>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel>{weightLabels[key]}</FieldLabel>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {weights[key]} ({Math.round((weights[key] / totalWeight) * 100)}%)
                </span>
              </div>
              <Slider value={[weights[key]]} min={0} max={50} step={5} onValueChange={([v]) => setWeights((w) => ({ ...w, [key]: v }))} aria-label={weightLabels[key]} />
            </Field>
          ))}
          <Field>
            <FieldLabel htmlFor="p-topk">Liczba przypadków w próbie</FieldLabel>
            <Input id="p-topk" type="number" min={3} max={15} value={topK} onChange={(e) => setTopK(Number(e.target.value))} className="w-28" />
            <FieldDescription>3–15. Większa próba to mniejsza niepewność, ale słabsze podobieństwo.</FieldDescription>
          </Field>
        </div>
      </section>
      )}

      {save && (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? (
              <>
                <Spinner /> Przeliczam…
              </>
            ) : (
              "Zapisz założenia i przelicz"
            )}
          </Button>
          {showWeights && (
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setWeights(defaultWeights)}>
              Przywróć domyślne wagi
            </Button>
          )}
        </div>
      )}
    </form>
  );
}

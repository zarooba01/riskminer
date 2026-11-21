import { pln } from "./format";
import { addMonths, daysBetween, type ParsedContractChange, type ParsedNotice } from "./notice-parse";

export type DetailRow = { label: string; value: string };
export type DetailBlock = { title: string; rows: DetailRow[] };

export type NoticeSummary = {
  /** Jedno-dwuzdaniowe podsumowanie po prawej stronie osi czasu. */
  summary: string;
  /** Ton podsumowania: ostrzeżenie przy wzroście kosztu, opóźnieniu, nienależytym wykonaniu. */
  tone: "neutral" | "warning";
  /** Szczegóły rozwijane pod spodem. */
  blocks: DetailBlock[];
};

const rows = (pairs: [string, string | number | null | undefined][]): DetailRow[] =>
  pairs.filter(([, v]) => v !== null && v !== undefined && v !== "").map(([label, value]) => ({ label, value: String(value) }));

const yesNo = (v: boolean | null | undefined) => (v == null ? null : v ? "tak" : "nie");

/** Podstawa prawna zmiany → język ekspercki (materiał MFiPR, sekcja 4.2). */
export function legalBasisMeaning(basis: string | null | undefined): string | null {
  if (!basis) return null;
  if (/455 ust\. 1 pkt 1/.test(basis)) return "zmiana przewidziana w dokumentach zamówienia";
  if (/455 ust\. 1 pkt 2/.test(basis)) return "zmiana wykonawcy";
  if (/455 ust\. 1 pkt 3/.test(basis)) return "dodatkowe roboty, dostawy lub usługi dotychczasowego wykonawcy";
  if (/455 ust\. 1 pkt 4/.test(basis)) return "okoliczności, których nie można było przewidzieć";
  if (/455 ust\. 2/.test(basis)) return "zmiana o niewielkiej wartości (limit ustawowy)";
  return null;
}

const shortBasis = (basis: string | null | undefined) => basis?.replace(/\s*ustawy\s*$/, "") ?? "podstawa nieznana";
const clip = (text: string | null | undefined, n = 140) => (!text ? "" : text.length > n ? `${text.slice(0, n).trimEnd()}…` : text);

function changeBlock(change: ParsedContractChange, title: string): DetailBlock {
  return {
    title,
    rows: rows([
      ["Data zmiany", change.changedAt],
      ["Podstawa prawna", change.legalBasis],
      ["Znaczenie podstawy", legalBasisMeaning(change.legalBasis)],
      ["Przyczyna", change.reason],
      ["Opis zmiany", change.description],
      ["Wartość zmiany", change.valueChange != null ? pln(change.valueChange) : null],
      ["Wzrost ceny", yesNo(change.priceIncrease)],
    ]),
  };
}

/** Podsumowanie i szczegóły ogłoszenia — deterministycznie z pól formularza (koszt 0, bez AI). */
export function summarizeNotice(type: string, p: ParsedNotice | undefined): NoticeSummary {
  const parsed = p ?? {};

  if (type === "ContractNotice") {
    return {
      summary: [parsed.estimatedValue != null ? `Wartość szacunkowa ${pln(parsed.estimatedValue)} (netto).` : null, "Ogłoszenie przetargu — zakres robót w szczegółach."]
        .filter(Boolean)
        .join(" "),
      tone: "neutral",
      blocks: [
        {
          title: "Przedmiot zamówienia",
          rows: rows([
            ["Tryb", parsed.procedure],
            ["Współfinansowanie UE", yesNo(parsed.euFunded)],
            ["Wartość szacunkowa (netto)", parsed.estimatedValue != null ? pln(parsed.estimatedValue) : null],
            ["Krótki opis", parsed.shortDescription],
          ]),
        },
      ],
    };
  }

  if (type === "TenderResultNotice") {
    const parts = parsed.parts?.length ? parsed.parts : [];
    const awarded = parts.filter((x) => x.contractValue != null);
    const single = awarded.length === 1 ? awarded[0] : null;
    const summary = single
      ? `Umowa z ${single.contractorName ?? "wykonawcą"} na ${pln(single.contractValue)}; ofert: ${single.offersCount ?? "?"}${single.lowestOffer != null && single.highestOffer != null ? ` (${pln(single.lowestOffer)} – ${pln(single.highestOffer)})` : ""}.`
      : awarded.length > 1
        ? `Zamówienie w ${parts.length} częściach, zawarto ${awarded.length} umów na łącznie ${pln(awarded.reduce((a, x) => a + (x.contractValue ?? 0), 0))}.`
        : `Wynik: ${parsed.resultStatus ?? "brak informacji o zawarciu umowy"}.`;
    return {
      summary,
      tone: single?.offersCount === 1 ? "warning" : "neutral",
      blocks: (parts.length ? parts : []).map((x) => ({
        title: x.partNo ? `Część ${x.partNo}${x.title ? `: ${x.title}` : ""}` : "Wynik postępowania",
        rows: rows([
          ["Zakończenie", x.resultStatus],
          ["Liczba ofert", x.offersCount],
          ["Najniższa oferta", x.lowestOffer != null ? pln(x.lowestOffer) : null],
          ["Najwyższa oferta", x.highestOffer != null ? pln(x.highestOffer) : null],
          ["Wykonawca", x.contractorName ? `${x.contractorName}${x.contractorNip ? ` (NIP/REGON ${x.contractorNip})` : ""}` : null],
          ["Data zawarcia umowy", x.signedAt],
          ["Wartość umowy (brutto)", x.contractValue != null ? pln(x.contractValue) : null],
          ["Okres realizacji", x.periodRaw],
        ]),
      })),
    };
  }

  if (type === "AgreementUpdateNotice") {
    const change = parsed.changes?.[0];
    const meaning = legalBasisMeaning(change?.legalBasis);
    const value = change?.valueChange != null ? `, wartość ${pln(change.valueChange)}` : "";
    return {
      summary: change
        ? `${shortBasis(change.legalBasis)}${meaning ? ` — ${meaning}` : ""}${value}. ${clip(change.reason)}`
        : "Zmiana umowy — brak szczegółów w formularzu.",
      tone: /pkt [34]/.test(change?.legalBasis ?? "") || (change?.valueChange ?? 0) > 0 ? "warning" : "neutral",
      blocks: [
        {
          title: "Umowa przed zmianą",
          rows: rows([
            ["Data zawarcia", parsed.signedAt],
            ["Wykonawca", parsed.contractorName],
            ["Wartość umowy (brutto)", parsed.contractValue != null ? pln(parsed.contractValue) : null],
          ]),
        },
        ...(change ? [changeBlock(change, "Zmiana")] : []),
      ],
    };
  }

  if (type === "ContractPerformingNotice") {
    const late = parsed.onTime === false;
    // Pierwotny termin: data z okresu realizacji („do RRRR-MM-DD”) albo zawarcie umowy + liczba miesięcy.
    const plannedEnd = parsed.plannedEnd ?? (parsed.signedAt && parsed.periodMonths ? addMonths(parsed.signedAt, parsed.periodMonths) : null);
    const lateDays = plannedEnd && parsed.completedAt ? daysBetween(plannedEnd, parsed.completedAt) : null;
    // Osobne ogłoszenie o zmianie umowy jest obowiązkowe tylko dla art. 455 ust. 1 pkt 3 i 4 — pozostałe zmiany
    // widać w BZP dopiero zbiorczo, w ogłoszeniu o wykonaniu umowy.
    const unpublished = (parsed.changes ?? []).filter((c) => !/455 ust\. 1 pkt [34]/.test(c.legalBasis ?? "")).length;
    const changesNote = unpublished
      ? unpublished === (parsed.changes ?? []).length
        ? " — opisane w tym ogłoszeniu (art. 455 ust. 1 pkt 1/2 i ust. 2 nie wymagają osobnych ogłoszeń o zmianie)"
        : ` — w tym ${unpublished} bez osobnego ogłoszenia o zmianie (opisane tutaj)`
      : "";
    const lateText = late ? (lateDays != null && lateDays > 0 ? `, ${lateDays} dni po pierwotnym terminie (${plannedEnd})` : ", po pierwotnym terminie") : parsed.onTime ? ", w terminie" : "";
    const overpaid = parsed.paidTotal != null && parsed.contractValue != null && parsed.paidTotal > parsed.contractValue + 1;
    const delta = overpaid ? ` (+${pln(parsed.paidTotal! - parsed.contractValue!)})` : "";
    const summary = [
      parsed.performed === false ? "Umowa NIE została wykonana." : `Wykonano ${parsed.completedAt ?? "—"}${lateText}.`,
      parsed.paidTotal != null ? `Wypłacono ${pln(parsed.paidTotal)}${delta}.` : null,
      parsed.changesCount ? `Zmian umowy: ${parsed.changesCount}${changesNote}.` : null,
      parsed.performedProperly === false ? "Nienależyte wykonanie." : null,
    ]
      .filter(Boolean)
      .join(" ");
    return {
      summary,
      tone: late || overpaid || parsed.performedProperly === false || parsed.performed === false ? "warning" : "neutral",
      blocks: [
        {
          title: "Przebieg realizacji",
          rows: rows([
            ["Data zawarcia umowy", parsed.signedAt],
            ["Okres realizacji", parsed.periodRaw],
            ["Wykonawca", parsed.contractorName],
            ["Wartość umowy (brutto)", parsed.contractValue != null ? pln(parsed.contractValue) : null],
            ["Umowa wykonana", yesNo(parsed.performed)],
            ["Termin wykonania", parsed.completedAt],
            ["Pierwotny termin (obliczony)", plannedEnd],
            ["W pierwotnym terminie", yesNo(parsed.onTime)],
            ["Opóźnienie", lateDays != null && lateDays > 0 ? `${lateDays} dni` : null],
            ["Wypłacono łącznie (brutto)", parsed.paidTotal != null ? pln(parsed.paidTotal) : null],
            ["Należyte wykonanie", yesNo(parsed.performedProperly)],
            ["Liczba zmian", parsed.changesCount],
          ]),
        },
        ...(parsed.changes ?? []).map((c, i) => changeBlock(c, `Zmiana nr ${c.changeNo ?? i + 1}`)),
      ],
    };
  }

  return { summary: "", tone: "neutral", blocks: [] };
}

/**
 * Kolumny pliku z projektami — jedno źródło prawdy dla importu (XLSX/CSV), szablonu do pobrania i opisu w interfejsie.
 * Nazwy i kolejność jak w pliku organizatora (Risk_Miner_dane_projekty.xlsx), więc pliki są wymienne.
 * `field` = pole rekordu rm_projects; kolumny bez `field` są przyjmowane, ale nie zapisywane.
 */
export type ProjectField =
  | "id"
  | "beneficiary_nip"
  | "beneficiary_name"
  | "province_code"
  | "province"
  | "city"
  | "title"
  | "record_scope"
  | "public_id_type"
  | "public_id"
  | "status"
  | "annotation";

export type ProjectColumn = {
  header: string;
  field?: ProjectField;
  required?: boolean;
  recommended?: boolean;
  description: string;
  example?: string;
};

export const projectColumns: ProjectColumn[] = [
  { header: "Lp.", description: "Numer kolejny w zestawie (opcjonalny).", example: "1" },
  { header: "Identyfikator rekordu", field: "id", required: true, description: "Unikalny identyfikator inwestycji w bazie.", example: "RM-2026-023" },
  { header: "Rodzaj identyfikatora odbiorcy", description: "Rodzaj krajowego numeru identyfikacyjnego.", example: "NIP" },
  { header: "Identyfikator odbiorcy", field: "beneficiary_nip", recommended: true, description: "NIP zamawiającego (10 cyfr, sprawdzana suma kontrolna) — klucz łączenia z BZP.", example: "9121715754" },
  { header: "Nazwa odbiorcy", field: "beneficiary_name", recommended: true, description: "Nazwa odbiorcy środków (zamawiającego).", example: "Gmina Oława" },
  { header: "Typ odbiorcy", description: "Kategoria podmiotu.", example: "Jednostka samorządu terytorialnego" },
  { header: "Kraj", description: "Kraj siedziby odbiorcy.", example: "Polska" },
  { header: "Kod województwa (TERYT)", field: "province_code", recommended: true, description: "Dwucyfrowy kod województwa wg TERYT — potrzebny do wyszukiwania w BZP, gdy brak numeru ogłoszenia.", example: "02" },
  { header: "Województwo", field: "province", description: "Województwo siedziby odbiorcy.", example: "dolnośląskie" },
  { header: "Siedziba odbiorcy", field: "city", description: "Miejscowość siedziby odbiorcy.", example: "Oława" },
  { header: "Nazwa przedsięwzięcia", field: "title", required: true, description: "Nazwa zgodna z dokumentacją zamówienia — używana do dopasowania po nazwie.", example: "Budowa sieci kanalizacji sanitarnej w miejscowości …" },
  { header: "Zakres rekordu", field: "record_scope", recommended: true, description: "Czy rekord obejmuje całe postępowanie, czy jego część.", example: "całe postępowanie | część 2" },
  { header: "Rodzaj identyfikatora publicznego", field: "public_id_type", recommended: true, description: "Projekt KPO albo ogłoszenie o zamówieniu w BZP.", example: "Ogłoszenie BZP | Projekt KPO" },
  { header: "Identyfikator publiczny", field: "public_id", recommended: true, description: "Numer ogłoszenia BZP albo numer projektu KPO — podstawowy klucz łączenia.", example: "2022/BZP 00058537/01 | KPOD.03.15-IW.13-0004/25" },
  { header: "Obszar tematyczny", description: "Obszar tematyczny zestawu.", example: "Gospodarka wodno-ściekowa" },
  { header: "Rodzaj zamówienia", description: "Rodzaj zamówienia wg ustawy Pzp.", example: "Roboty budowlane" },
  { header: "Reżim prawny", description: "Podstawa prawna udzielenia zamówienia.", example: "Ustawa Pzp – zamówienie krajowe" },
  { header: "Waluta rozliczeń", description: "Waluta rozliczeń.", example: "PLN" },
  { header: "Status przedsięwzięcia", field: "status", description: "Stan realizacji na dzień sporządzenia rekordu.", example: "Zakończone | W realizacji" },
  { header: "Źródło rekordu", description: "Pochodzenie danych rekordu.", example: "Rejestr publiczny" },
  { header: "Data sporządzenia rekordu", description: "Data sporządzenia rekordu (RRRR-MM-DD).", example: "2026-11-21" },
  { header: "Wersja rekordu", description: "Wersja rekordu.", example: "1.0" },
  {
    header: "Adnotacja instytucji",
    field: "annotation",
    description: "Adnotacja instytucji udzielającej wsparcia; „Wartość przedsięwzięcia: … zł” i „dofinansowanie: … zł” są odczytywane automatycznie.",
    example: "KPO, inwestycja B3.1.1. Wartość przedsięwzięcia: 1 000 000,00 zł; dofinansowanie: 800 000,00 zł.",
  },
];

export const normalizeHeader = (header: string) => header.replace(/^﻿/, "").trim().toLowerCase();

/** Nagłówek (znormalizowany) → pole rekordu. */
export const columnFieldByHeader = new Map(projectColumns.filter((c) => c.field).map((c) => [normalizeHeader(c.header), c.field!]));

export const requiredHeaders = projectColumns.filter((c) => c.required).map((c) => c.header);
export const recommendedHeaders = projectColumns.filter((c) => c.recommended).map((c) => c.header);

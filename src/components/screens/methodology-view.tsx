import { PageHeader } from "@/components/layout/page-header";
import { Provenance } from "@/components/rm/provenance";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MIN_SCORE } from "@/lib/assess/engine";
import { defaultWeights, weightLabels, type Weights } from "@/lib/assess/types";

type Props = {
  /** Liczba projektów w bazie porównawczej (kandydaci do porównań). */
  corpus?: number;
};

const featureHow: Record<keyof Weights, string> = {
  subsector: "ten sam podsektor główny = 100%, podsektor dodatkowy = 50%",
  works: "ten sam rodzaj robót = 100%, inny = 0%",
  scope: "podobieństwo słów opisu planu i opisu przypadku (TF-IDF)",
  scale: "budżet ↔ wartość umowy, długość ↔ długość; równe = 100%, różnica 4× = 0%",
  location: "to samo województwo = 100%, inne = 0%",
};

function Section({ n, title, description, children }: { n: number; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {n}. {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">{children}</CardContent>
    </Card>
  );
}

const Bullets = ({ items }: { items: React.ReactNode[] }) => (
  <ul className="flex list-disc flex-col gap-1.5 pl-5">
    {items.map((item, i) => (
      <li key={i}>{item}</li>
    ))}
  </ul>
);

/** „Obliczenia”: krótkie, ogólne wyjaśnienie, skąd biorą się dane i jak liczymy wyniki (bez AI, chyba że zaznaczono). */
export function MethodologyView({ corpus }: Props) {
  const total = Object.values(defaultWeights).reduce((a, b) => a + b, 0);
  return (
    <>
      <PageHeader title="Obliczenia" description="Jak Risk Miner wyciąga dane i jak liczy wyniki — w skrócie. Wszystko poza oznaczonymi krokami AI to reguły i arytmetyka: te same dane dają zawsze ten sam wynik." />

      <Card>
        <CardHeader>
          <CardTitle>Oznaczenia pochodzenia</CardTitle>
          <CardDescription>Każda wartość i każdy wniosek w aplikacji ma jedno z tych oznaczeń.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <span className="flex items-center gap-2"><Provenance kind="source" /> przepisane z dokumentu (z linkiem)</span>
          <span className="flex items-center gap-2"><Provenance kind="calc" /> wyliczone z danych źródłowych</span>
          <span className="flex items-center gap-2"><Provenance kind="rule" /> propozycja reguły — do decyzji eksperta</span>
          <span className="flex items-center gap-2"><Provenance kind="llm" /> wniosek modelu — do decyzji eksperta</span>
          <span className="flex items-center gap-2"><Provenance kind="expert" /> katalog ekspercki lub decyzja eksperta</span>
          <span className="flex items-center gap-2"><Provenance kind="input" /> podane w opisie planu</span>
        </CardContent>
      </Card>

      <Section n={1} title="Skąd są dane o zrealizowanych inwestycjach" description="Budowa bazy przypadków — bez AI.">
        <Bullets
          items={[
            "Plik XLSX organizatora → projekty (NIP sprawdzany sumą kontrolną, podsektor wg słownika eksperckiego).",
            "BZP: numer ogłoszenia z pliku → ogłoszenie o zamówieniu → identyfikator postępowania (OCID) → ogłoszenia o wyniku, zmianach i wykonaniu umowy. Bez numeru: wyszukiwanie po NIP i nazwie z oceną pewności — ekspert zatwierdza.",
            "Z formularzy ogłoszeń parser odczytuje wartość umowy, okres realizacji, daty, liczbę ofert, wypłaconą kwotę i każdą zmianę umowy (podstawa art. 455, przyczyna, kwota, nowy termin).",
            "Dokumenty PDF/DOCX czytamy lokalnie (warstwa tekstowa), stronami — każdy cytat wskazuje stronę.",
          ]}
        />
      </Section>

      <Section n={2} title="Odchylenia kosztu i terminu umowy">
        <Bullets
          items={[
            <>Zmiana kosztu = (wypłacono − wartość umowy) / wartość umowy. Obie kwoty brutto z ogłoszeń BZP.</>,
            <>Planowany termin = data zawarcia + okres realizacji. Opóźnienie = data wykonania − planowany termin (w dniach i w % pierwotnego okresu).</>,
            <>Umowa w częściach: każda część osobno; dla całego postępowania koszt sumujemy, opóźnienie bierzemy największe.</>,
          ]}
        />
      </Section>

      <Section n={3} title="Zdarzenia ryzyka w zrealizowanych inwestycjach">
        <Bullets
          items={[
            "Reguły (koszt 0): wykonanie po terminie, wypłata wyższa niż umowa, jedna oferta, każda zmiana umowy. Kategorię R01–R15 wybieramy po słowach kluczowych katalogu w przyczynie i opisie zmiany (przyczyna waży podwójnie) i po podstawie art. 455.",
            "Model AI (na żądanie): przypisuje przyczyny i skutki do katalogu; cytat jest sprawdzany dosłownie w źródle — niezgodny obniża pewność o połowę.",
            "Każde zdarzenie czeka na decyzję eksperta; odrzucone nie są używane w porównaniach.",
          ]}
        />
      </Section>

      <Section n={4} title="Ocena nowej inwestycji — odczyt opisu" description="Przeszukiwanie treści opisu i wgranych dokumentów wzorcami (bez AI).">
        <Bullets
          items={[
            "Podsektor i rodzaj robót: słowa ze słownika eksperckiego („kanalizacja sanitarna”, „wodociąg”, „oczyszczalnia”…, „budowa” / „przebudowa”).",
            "Liczby z jednostką: „3 km”, „850 mb”, „L=1200 m” → długość; „budżet 4 mln zł” → budżet (kwota musi stać przy słowie budżet / koszt / wartość albo być w mln); „12 miesięcy”, „do końca 2027” → czas.",
            "Nazwa województwa, jeśli pada w tekście (miejscowości nie rozpoznajemy — może to uzupełnić model AI).",
            "Słowa warunków lokalnych → kategoria ryzyka, np. „kolizje”, „działki” → R03; „uzgodnienia”, „włączenie”, „pozwolenie” → R04; „grunty”, „wody gruntowe” → R02.",
          ]}
        />
      </Section>

      <Section n={5} title="Dobór podobnych zakończonych inwestycji">
        <p>
          Kandydaci to wyłącznie projekty z <strong>bazy porównawczej</strong>{corpus != null ? ` (teraz ${corpus})` : ""}: zakończone, z dopasowaniem do BZP, danymi o
          wykonaniu umowy i zaakceptowanymi zdarzeniami ryzyka (kopia bazy roboczej z automatyczną akceptacją — zakładka „Baza porównawcza”). Każdy dostaje wynik 0–100 = Σ (waga × zgodność cechy) / Σ wag cech, które
          plan podaje — cecha nieznana w planie nie obniża wyniku. Wagi można zmienić w każdej ocenie (zakładka „Założenia”).
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cecha</TableHead>
              <TableHead className="text-right">Waga domyślna</TableHead>
              <TableHead>Zgodność</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(Object.keys(weightLabels) as (keyof Weights)[]).map((k) => (
              <TableRow key={k}>
                <TableCell>{weightLabels[k]}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {defaultWeights[k]} ({Math.round((defaultWeights[k] / total) * 100)}%)
                </TableCell>
                <TableCell className="whitespace-normal text-xs">{featureHow[k]}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-muted-foreground">
          Treść przypadku = tytuł + adnotacja instytucji + „Krótki opis przedmiotu zamówienia” z ogłoszenia BZP. TF-IDF: słowa sprowadzamy do rdzenia, pomijamy ogólniki
          („gmina”, „zadanie”), słowo rzadkie w bazie waży więcej niż częste. Wspólne słowa o największej wadze pokazujemy jako „wspólne pojęcia”.
        </p>
        <p>
          Do statystyki wchodzi 8 najbardziej podobnych przypadków (domyślnie; 3–15) z wynikiem co najmniej {MIN_SCORE}.
        </p>
      </Section>

      <Section n={6} title="Statystyka, prognoza i niepewność">
        <Bullets
          items={[
            "Dla próby: mediana i przedział P25–P75 (środkowa połowa umów) zmiany kosztu, opóźnienia, okresu realizacji, liczby ofert i kosztu 1 km — zawsze z liczebnością n.",
            "Niepewność wg liczebności: n < 5 duża, 5–9 średnia, ≥ 10 umiarkowana.",
            "Prognoza: budżet × (1 + P25 … P75 zmiany kosztu); termin × (1 + P25 … P75 opóźnienia w %); koszt wg długości = mediana zł/km × długość. Przy n < 3 przedziałów nie podajemy.",
          ]}
        />
      </Section>

      <Section n={7} title="Ryzyka, flagi i zalecenia w ocenie">
        <Bullets
          items={[
            "Ryzyka: zaakceptowane zdarzenia z umów w próbie zgrupowane wg kodu R01–R15 — w ilu z N umów wystąpiły, skutki, przyczyny i cytaty ze źródeł.",
            "Ryzyka „do lokalnego potwierdzenia”: kategorie wskazane przez warunki lokalne w opisie.",
            "Co sprawdzić / działania / zapisy umowne: z katalogu eksperckiego (edycja: Weryfikacja → Katalog) oraz działania zaradcze zapisane przy zdarzeniach.",
            "Flagi: progi na statystyce, np. górny kwartyl wzrostu kosztu > 10%, mediana ofert ≤ 3, planowany termin < 80% mediany okresu, budżet poza 0,5–2× mediany wartości umów.",
            "Braki w opisie: tematy z poradnika eksperckiego, o których tekst nie wspomina (punkt włączenia, prawa do terenu, decyzje, przyłącza, grunty).",
          ]}
        />
      </Section>

      <Section n={8} title="Ocena AI (gdy zaznaczono „Użyj modelu AI”)" description="Zamiast kroków 4, 5 i 7 — bez analizy deterministycznej.">
        <Bullets
          items={[
            "Jedno wywołanie modelu: dostaje opis planu, fragment wgranych dokumentów (do ok. 5 tys. znaków) i bazę porównawczą w skrócie (każdy przypadek: rodzaj, skala, liczby z umowy i do 3 zdarzeń z krótkimi aliasami E1…).",
            "Model odczytuje parametry planu (także województwo z nazwy gminy), wybiera 5–10 podobnych inwestycji z powodami i formułuje do 6 ryzyk z rzeczami do sprawdzenia, działaniami i zapisami umownymi oraz kwestie do lokalnego potwierdzenia.",
            "Walidacja: odrzucamy przypadki spoza bazy i każde ryzyko, które nie wskazuje istniejącego przypadku lub zdarzenia; parametry spoza słowników (podsektor, województwo) też. Parametry wpisane przez użytkownika model dostaje jako ustalone.",
            "Liczby nie pochodzą od modelu: mediany, przedziały P25–P75, n, prognoza i czerwone flagi liczymy z danych przypadków wybranych przez model (krok 6).",
            "Wnioski modelu czekają na decyzję eksperta (✓/✗ na karcie ryzyka). Wywołanie (model, koszt, czas) zapisuje się w rejestrze; ten sam opis i ta sama baza — wynik z pamięci podręcznej, bez kosztu.",
          ]}
        />
      </Section>
    </>
  );
}

// Serwer deweloperski Storybooka odpowiada nagłówkiem `Access-Control-Allow-Origin: *`.
// Główny Storybook (port 6006) bywa zmuszony pobierać piaskownicę z `credentials: "include"`
// (gdy przy starcie nie zdążył jej sprawdzić), a przeglądarka odrzuca wtedy odpowiedź z gwiazdką —
// w menu pojawia się „Loading of ref failed". Dlatego dla żądań z localhost odsyłamy konkretny Origin.
const localOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

function allowLocalOrigin(req, res) {
  const origin = req.headers.origin;
  if (!origin || !localOrigin.test(origin)) return;

  const setHeader = res.setHeader.bind(res);
  // Handlery Storybooka ustawiają gwiazdkę później — podmieniamy ją w locie.
  res.setHeader = (name, value) =>
    setHeader(name, String(name).toLowerCase() === "access-control-allow-origin" ? origin : value);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Vary", "Origin");
}

export default function corsForComposition(app) {
  // Trasa index.json jest rejestrowana przed tym plikiem, więc zwykłe app.use() działa za późno.
  // Podpinamy się bezpośrednio pod serwer HTTP, przed handlerem Storybooka.
  if (app.server?.prependListener) app.server.prependListener("request", allowLocalOrigin);
  else app.use((req, res, next) => (allowLocalOrigin(req, res), next()));
}

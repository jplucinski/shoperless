export function furgonetkaPanelUrl(env: string | undefined): string {
  return env === "prod" ? "https://furgonetka.pl" : "https://sandbox.furgonetka.pl";
}

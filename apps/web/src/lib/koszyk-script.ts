export function koszykCheckoutScriptSrc(env?: string): string {
  const flavor = env === "prod" ? "prod" : "sandbox";
  return `https://furgonetka.pl/js/dist/checkout/universal-checkout-${flavor}.js`;
}

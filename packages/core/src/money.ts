export type Money = number;

export function assertMoney(value: number): Money {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("money must be non-negative integer grosze");
  }
  return value;
}

export function formatPln(grosze: Money): string {
  const whole = Math.floor(grosze / 100);
  const frac = String(grosze % 100).padStart(2, "0");
  return `${whole},${frac} zł`;
}

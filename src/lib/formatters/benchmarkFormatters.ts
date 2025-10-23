/**
 * Formate un facteur d'émission avec des arrondis dynamiques
 * - 1 décimale si valeur >= 1
 * - 3 décimales si valeur < 1
 */
export function formatEmissionFactor(value: number): string {
  if (value >= 1) {
    return value.toFixed(1);
  }
  return value.toFixed(3);
}

/**
 * Formate un facteur d'émission avec son unité
 */
export function formatEmissionFactorWithUnit(value: number, unit: string): string {
  return `${formatEmissionFactor(value)} ${unit}`;
}


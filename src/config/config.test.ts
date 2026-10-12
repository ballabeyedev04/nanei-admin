import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { API_VERSION_MIN } from './apiVersion';

describe('API_VERSION_MIN', () => {
  it('est un entier strictement positif', () => {
    expect(Number.isInteger(API_VERSION_MIN)).toBe(true);
    expect(API_VERSION_MIN).toBeGreaterThan(0);
  });

  it('reste lisible par la chaîne de déploiement (entier littéral sur une ligne)', () => {
    // .github/workflows/deploy.yml lit la valeur avec ce même motif.
    const source = readFileSync(resolve(__dirname, 'apiVersion.ts'), 'utf8');
    const trouve = source.match(/^export const API_VERSION_MIN = (\d+);$/m);
    expect(trouve?.[1]).toBe(String(API_VERSION_MIN));
  });
});

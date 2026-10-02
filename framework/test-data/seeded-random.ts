import { createHash } from 'node:crypto';

/**
 * Small deterministic PRNG (sfc32) seeded from a SHA-256 digest of a string. Identical seeds
 * produce identical sequences on every platform and Node.js version.
 */
export class SeededRandom {
  #a: number;
  #b: number;
  #c: number;
  #d: number;

  constructor(seed: string) {
    const digest = createHash('sha256').update(seed).digest();
    this.#a = digest.readUInt32LE(0);
    this.#b = digest.readUInt32LE(4);
    this.#c = digest.readUInt32LE(8);
    this.#d = digest.readUInt32LE(12);
    for (let i = 0; i < 12; i++) {
      this.nextUint32();
    }
  }

  nextUint32(): number {
    const t = (((this.#a + this.#b) | 0) + this.#d) | 0;
    this.#d = (this.#d + 1) | 0;
    this.#a = this.#b ^ (this.#b >>> 9);
    this.#b = (this.#c + (this.#c << 3)) | 0;
    this.#c = (this.#c << 21) | (this.#c >>> 11);
    this.#c = (this.#c + t) | 0;
    return t >>> 0;
  }

  /** Integer in the inclusive range `[min, max]`. */
  int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError(`invalid integer range [${min}, ${max}]`);
    }
    return min + (this.nextUint32() % (max - min + 1));
  }

  boolean(): boolean {
    return (this.nextUint32() & 1) === 1;
  }

  pick<T>(items: readonly T[]): T {
    const item = items[this.int(0, items.length - 1)];
    if (item === undefined) {
      throw new RangeError('cannot pick from an empty list');
    }
    return item;
  }

  hex(length: number): string {
    let result = '';
    while (result.length < length) {
      result += this.nextUint32().toString(16).padStart(8, '0');
    }
    return result.slice(0, length);
  }
}

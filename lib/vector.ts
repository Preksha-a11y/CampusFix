import crypto from 'crypto';

const STOP_WORDS = new Set([
  'in', 'the', 'on', 'at', 'to', 'for', 'of', 'and', 'a', 'an', 'is', 'it', 'this',
  'that', 'with', 'from', 'by', 'floor', 'hall', 'area', 'building'
]);

const TOPIC_KEYWORDS: Record<string, number> = {
  water: 12.0, leak: 12.0, leaking: 12.0, leakage: 12.0, pipe: 10.0, tap: 12.0,
  washroom: 8.0, bathroom: 8.0, toilet: 8.0, flush: 10.0, drain: 10.0, basin: 8.0,
  dripping: 10.0, plumber: 8.0, overflow: 10.0,
  power: 10.0, electricity: 10.0, switch: 8.0, socket: 8.0, light: 8.0, tube: 8.0,
  fan: 12.0, screeching: 8.0, regulator: 8.0, ac: 10.0, cooling: 8.0, mcb: 10.0, trip: 8.0,
  wifi: 15.0, internet: 15.0, network: 10.0, router: 10.0, connection: 8.0, signal: 8.0,
  packet: 8.0, ethernet: 10.0, ssid: 10.0, lan: 8.0,
  projector: 15.0, screen: 8.0, audio: 8.0, mic: 8.0, speaker: 8.0, display: 8.0,
  tint: 8.0, flicker: 10.0, flickering: 10.0,
  clean: 8.0, cleaning: 8.0, dustbin: 8.0, garbage: 8.0, trash: 8.0, waste: 8.0,
  sanitization: 8.0, smell: 8.0, odor: 8.0, algae: 12.0
};

const KEYWORD_LIST = Object.keys(TOPIC_KEYWORDS);

export function normalizeText(text: string): string {
  let t = text.toLowerCase();
  t = t.replace(/wi[- ]?fi/g, 'wifi');
  t = t.replace(/a[- /]?c\b|air[- ]?condition\w*/g, 'ac');
  t = t.replace(/wash[- ]?room/g, 'washroom');
  t = t.replace(/bath[- ]?room/g, 'bathroom');
  return t;
}

export function generateEmbedding(text: string): number[] {
  const normT = normalizeText(text);
  const words = (normT.match(/[a-zA-Z0-9]+/g) || []).filter(w => !STOP_WORDS.has(w));
  const dim = 384;
  const vec = new Array(dim).fill(0.0);

  for (const w of words) {
    if (TOPIC_KEYWORDS[w] !== undefined) {
      const idx = KEYWORD_LIST.indexOf(w);
      vec[idx] += TOPIC_KEYWORDS[w];
    } else {
      // Deterministic hash to remainder
      let hash = 0;
      for (let i = 0; i < w.length; i++) {
        hash = ((hash << 5) - hash + w.charCodeAt(i)) & 0x7fffffff;
      }
      const h = (hash % (dim - KEYWORD_LIST.length)) + KEYWORD_LIST.length;
      vec[h] += 1.0;
    }
  }

  const norm = Math.sqrt(vec.reduce((acc, val) => acc + val * val, 0));
  if (norm > 0) {
    return vec.map(val => Number((val / norm).toFixed(5)));
  }
  return vec;
}

export function toVectorString(vec: number[]): string {
  return `[${vec.join(',')}]`;
}

import crypto from 'node:crypto';

export function id(prefix='id') {
  return `${prefix}_${crypto.randomUUID()}`;
}
export function now() { return new Date().toISOString(); }
export function sha256(input) { return crypto.createHash('sha256').update(input).digest('hex'); }
export function normalizeText(s='') {
  return String(s).normalize('NFC').replace(/[\u200B\u200C\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
}
export function decodeXml(s='') {
  return s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
}
export function safeJson(value) { return JSON.stringify(value ?? {}); }

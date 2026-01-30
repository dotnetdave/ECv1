#!/usr/bin/env node
/**
 * EC v1 validator/decoder.
 * Usage:
 *   cat ec_block.txt | node tools/ecv1-validate.js
 *   node tools/ecv1-validate.js path/to/ec_block.txt
 */
const fs = require('fs');
const zlib = require('zlib');

function readAll(path) {
  if (!path || path === '-') return fs.readFileSync(0, 'utf8');
  return fs.readFileSync(path, 'utf8');
}

function parseBlock(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(Boolean);
  if (lines.length < 3) throw new Error(`Expected 3 lines, got ${lines.length}`);
  if (lines[0].trim() !== 'EC v1') throw new Error('Invalid header');
  const meta = lines[1].trim();
  const payload = lines.slice(2).join('\n').trim();
  let t = null, ct = 'json';
  meta.split(';').forEach(p => {
    if (p.startsWith('t=')) t = p.slice(2);
    if (p.startsWith('ct=')) ct = p.slice(3);
  });
  if (!t) throw new Error('Missing t=');
  return { t, ct, payload };
}

function decode(t, payload) {
  let data = Buffer.from(payload, 'utf8');
  const steps = t.split('>').reverse();
  for (const step of steps) {
    if (step === 'b64') {
      data = Buffer.from(data.toString('utf8'), 'base64');
    } else if (step === 'gz') {
      data = zlib.gunzipSync(data);
    } else if (step === 'none' || step === '') {
      continue;
    } else {
      throw new Error(`Unsupported transform: ${step}`);
    }
  }
  return data.toString('utf8');
}

function main() {
  try {
    const inputPath = process.argv[2];
    const text = readAll(inputPath);
    const { t, ct, payload } = parseBlock(text);
    const decoded = decode(t, payload);
    if (ct === 'json') {
      JSON.parse(decoded); // validate JSON
    }
    console.log(`Valid EC v1 · t=${t}; ct=${ct}`);
    if (ct === 'json') {
      console.log(JSON.stringify(JSON.parse(decoded), null, 2));
    } else {
      console.log(decoded);
    }
  } catch (err) {
    console.error('Invalid EC v1:', err.message);
    process.exit(1);
  }
}

main();

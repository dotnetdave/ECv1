#!/usr/bin/env node
/**
 * Simple EC v1 CLI encoder/decoder.
 * Usage:
 *   node tools/ecv1-cli.js encode input.json [output.txt]
 *   node tools/ecv1-cli.js decode ecv1.txt [output.json]
 *   (use "-" for stdin/stdout)
 */

const fs = require('fs');
const zlib = require('zlib');

function read(path) {
  if (!path || path === '-') return fs.readFileSync(0, 'utf8');
  return fs.readFileSync(path, 'utf8');
}

function write(text, path) {
  if (!path || path === '-') {
    process.stdout.write(text);
    if (!text.endsWith('\n')) process.stdout.write('\n');
    return;
  }
  fs.writeFileSync(path, text);
}

function parseMeta(line) {
  let t, ct = 'json';
  for (const part of line.split(';')) {
    if (part.startsWith('t=')) t = part.slice(2);
    if (part.startsWith('ct=')) ct = part.slice(3);
  }
  if (!t) throw new Error('Transform chain (t=) missing');
  return { t, ct };
}

function encode(inputPath, outputPath, transformChain = 'gz>b64', contentType = 'json') {
  const obj = JSON.parse(read(inputPath));
  let data = Buffer.from(JSON.stringify(obj));

  for (const step of transformChain.split('>')) {
    if (step === 'gz') data = zlib.gzipSync(data);
    else if (step === 'b64') data = Buffer.from(data.toString('base64'), 'utf8');
    else if (step === 'none' || step === '') continue;
    else throw new Error(`Unknown transform: ${step}`);
  }

  const out = `EC v1\nt=${transformChain};ct=${contentType}\n${data.toString('utf8')}`;
  write(out, outputPath);
}

function decode(inputPath, outputPath) {
  const raw = read(inputPath).replace(/\r\n/g, '\n').split('\n').filter(Boolean);
  if (raw.length < 3) throw new Error(`Invalid EC v1 message: expected 3 lines, got ${raw.length}`);
  if (raw[0] !== 'EC v1') throw new Error('Invalid EC v1 header');
  const { t: transformChain, ct } = parseMeta(raw[1]);

  let data = Buffer.from(raw[2], 'utf8');
  for (const step of transformChain.split('>').reverse()) {
    if (step === 'b64') data = Buffer.from(data.toString('utf8'), 'base64');
    else if (step === 'gz') data = zlib.gunzipSync(data);
    else if (step === 'none' || step === '') continue;
    else throw new Error(`Unknown transform: ${step}`);
  }

  const text = data.toString('utf8');
  if (ct === 'json') {
    write(JSON.stringify(JSON.parse(text), null, 2), outputPath);
  } else {
    write(text, outputPath);
  }
}

function main() {
  const [mode, input, output] = process.argv.slice(2);
  if (!mode || !input) {
    console.log('Usage: node tools/ecv1-cli.js <encode|decode> <file|-> [output|->]');
    process.exit(1);
  }
  try {
    if (mode === 'encode') encode(input, output);
    else if (mode === 'decode') decode(input, output);
    else {
      console.log('Mode must be encode or decode.');
      process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();

const fs = require('fs');
const zlib = require('zlib');

function readText(path) {
  if (path === '-' || path === undefined) {
    return fs.readFileSync(0, 'utf-8'); // stdin
  }
  return fs.readFileSync(path, 'utf-8');
}

function writeText(text, path) {
  if (!path || path === '-') {
    process.stdout.write(text);
    if (!text.endsWith('\n')) process.stdout.write('\n');
    return;
  }
  fs.writeFileSync(path, text);
}

function encodeMessage(inputFile, outputFile, transformChain = 'gz>b64', contentType = 'json') {
  const message = JSON.parse(readText(inputFile));
  const jsonBuffer = Buffer.from(JSON.stringify(message));

  let data = jsonBuffer;
  for (const transform of transformChain.split('>')) {
    if (transform === 'gz') {
      data = zlib.gzipSync(data);
    } else if (transform === 'b64') {
      data = Buffer.from(data.toString('base64'), 'utf8');
    } else if (transform === 'none' || transform === '') {
      continue;
    } else {
      throw new Error(`Unknown transform: ${transform}`);
    }
  }

  const ecv1Message = `EC v1\nt=${transformChain};ct=${contentType}\n${data.toString('utf8')}`;
  writeText(ecv1Message, outputFile);
}

function decodeMessage(encodedFile, outputFile) {
  const raw = readText(encodedFile);
  const lines = raw.replace(/\r\n/g, '\n').split('\n').filter(Boolean);
  if (lines.length < 3) throw new Error(`Invalid EC v1 message: expected 3 lines, got ${lines.length}`);
  if (lines[0] !== 'EC v1') throw new Error('Invalid EC v1 header');

  const { transformChain, contentType } = parseMeta(lines[1]);
  let data = Buffer.from(lines[2], 'utf8');

  // Apply transforms in reverse order to unwind encoding.
  for (const transform of transformChain.split('>').reverse()) {
    if (transform === 'b64') {
      data = Buffer.from(data.toString('utf8'), 'base64');
    } else if (transform === 'gz') {
      data = zlib.gunzipSync(data);
    } else if (transform === 'none' || transform === '') {
      continue;
    } else {
      throw new Error(`Unknown transform: ${transform}`);
    }
  }

  const text = data.toString('utf8');
  let parsed = text;
  if (contentType === 'json') {
    parsed = JSON.parse(text);
    writeText(JSON.stringify(parsed, null, 2), outputFile);
  } else {
    writeText(text, outputFile);
  }
}

function parseMeta(line) {
  const parts = line.split(';');
  let t = null, ct = 'json';
  for (const part of parts) {
    if (part.startsWith('t=')) t = part.slice(2);
    if (part.startsWith('ct=')) ct = part.slice(3);
  }
  if (!t) throw new Error('Transform chain (t=) not found');
  return { transformChain: t, contentType: ct || 'json' };
}

// Command-line interface
function usage() {
  console.log('Usage: node ECv1Protocol.js <encode|decode> <file|-> [outputFile|-]');
}

const args = process.argv.slice(2);
if (args.length < 2) {
  usage();
  process.exit(1);
}

const [mode, file, outputFile] = args;
try {
  if (mode === 'encode') {
    encodeMessage(file, outputFile);
  } else if (mode === 'decode') {
    decodeMessage(file, outputFile);
  } else {
    usage();
    process.exit(1);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}

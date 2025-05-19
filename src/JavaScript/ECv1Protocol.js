const fs = require('fs');
const zlib = require('zlib');

function encodeMessage(inputFile, outputFile) {
  const message = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
  const jsonBuffer = Buffer.from(JSON.stringify(message));
  const compressed = zlib.gzipSync(jsonBuffer);
  const base64 = compressed.toString('base64');

  const ecv1Message = `EC v1\nt=gz>b64;ct=json\n${base64}`;

  if (outputFile) {
    fs.writeFileSync(outputFile, ecv1Message);
  } else {
    console.log(ecv1Message);
  }
}

function decodeMessage(encodedFile, outputFile) {
  const lines = fs.readFileSync(encodedFile, 'utf-8').split('\n');
  if (lines[0] !== 'EC v1') {
    throw new Error('Invalid EC v1 header');
  }
  const payload = lines[2];
  const compressed = Buffer.from(payload, 'base64');
  const decompressed = zlib.gunzipSync(compressed);
  const json = JSON.parse(decompressed.toString());

  if (outputFile) {
    fs.writeFileSync(outputFile, JSON.stringify(json, null, 2));
  } else {
    console.log(JSON.stringify(json, null, 2));
  }
}

// Command-line interface
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node ecv1_encoder.js <encode|decode> <file> [outputFile]');
  process.exit(1);
}

const [mode, file, outputFile] = args;
if (mode === 'encode') {
  encodeMessage(file, outputFile);
} else if (mode === 'decode') {
  decodeMessage(file, outputFile);
} else {
  console.log('Invalid mode. Use "encode" or "decode".');
}
import json
import gzip
import base64
import argparse
from datetime import datetime

def encode_message(input_file):
    with open(input_file, 'r', encoding='utf-8') as f:
        message = json.load(f)
    json_bytes = json.dumps(message, separators=(',', ':')).encode('utf-8')
    compressed = gzip.compress(json_bytes)
    b64_encoded = base64.b64encode(compressed).decode('utf-8')
    return f"EC v1\nt=gz>b64;ct=json\n{b64_encoded}"

def decode_message(encoded_file):
    with open(encoded_file, 'r', encoding='utf-8') as f:
        lines = f.read().splitlines()
    if lines[0] != "EC v1":
        raise ValueError("Invalid EC v1 header.")
    transform_line = lines[1]
    payload = lines[2]
    decoded = base64.b64decode(payload)
    decompressed = gzip.decompress(decoded)
    return json.loads(decompressed.decode('utf-8'))

def main():
    parser = argparse.ArgumentParser(description="EC v1 Encoder/Decoder")
    parser.add_argument('mode', choices=['encode', 'decode'], help="Operation mode.")
    parser.add_argument('file', help="Input file path.")
    parser.add_argument('-o', '--output', help="Output file path.")

    args = parser.parse_args()

    if args.mode == 'encode':
        result = encode_message(args.file)
    else:
        result = json.dumps(decode_message(args.file), indent=2)

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as out_file:
            out_file.write(result)
    else:
        print(result)

if __name__ == "__main__":
    main()

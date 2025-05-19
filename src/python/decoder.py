import base64
import gzip

def chain_decode(transform_chain, payload):
    steps = transform_chain.split('>')
    data = payload

    for step in steps:
        if step == 'b64':
            data = base64.b64decode(data)
        elif step == 'gz':
            data = gzip.decompress(data)
        elif step == 'none':
            continue
        else:
            raise ValueError(f"Unknown transform step: {step}")

    return data.decode('utf-8')

if __name__ == "__main__":
    import sys

    if len(sys.argv) != 2:
        print("Usage: python ec_v1_chain_decoder.py <encoded_file>")
        sys.exit(1)

    with open(sys.argv[1], 'r', encoding='utf-8') as f:
        lines = f.read().splitlines()

    if lines[0] != "EC v1":
        print("Invalid EC v1 header.")
        sys.exit(1)

    transform_line = lines[1]
    payload = lines[2]

    transform_chain = transform_line.split(';')[0].split('=')[1]

    result = chain_decode(transform_chain, payload)
    print(result)

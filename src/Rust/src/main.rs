use base64::{engine::general_purpose, Engine as _};
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use std::env;
use std::fs;
use std::io::{self, Read, Write};

fn encode_file(input: &str, output: Option<&str>) -> io::Result<()> {
    let data = fs::read_to_string(input)?;

    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(data.as_bytes())?;
    let compressed = encoder.finish()?;

    let b64 = general_purpose::STANDARD.encode(compressed);
    let out = format!("EC v1\nt=gz>b64;ct=json\n{}", b64);
    write_output(out.as_bytes(), output)
}

fn decode_file(input: &str, output: Option<&str>) -> io::Result<()> {
    let raw = fs::read_to_string(input)?;
    let lines: Vec<&str> = raw.replace("\r\n", "\n").split('\n').collect();
    if lines.len() < 3 {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "expected 3 lines"));
    }
    if lines[0] != "EC v1" {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "invalid EC v1 header"));
    }

    let payload = lines[2];
    let compressed = general_purpose::STANDARD
        .decode(payload)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

    let mut decoder = GzDecoder::new(&compressed[..]);
    let mut out = String::new();
    decoder.read_to_string(&mut out)?;

    write_output(out.as_bytes(), output)
}

fn write_output(data: &[u8], output: Option<&str>) -> io::Result<()> {
    if let Some(path) = output {
        fs::write(path, data)?;
    } else {
        io::stdout().write_all(data)?;
        if !data.ends_with(&[b'\n']) {
            io::stdout().write_all(b"\n")?;
        }
    }
    Ok(())
}

fn usage() {
    eprintln!("Usage: cargo run -- <encode|decode> <file> [output]");
}

fn main() -> io::Result<()> {
    let args: Vec<String> = env::args().collect();
    if args.len() < 3 {
        usage();
        std::process::exit(1);
    }

    let mode = &args[1];
    let input = &args[2];
    let output = args.get(3).map(String::as_str);

    match mode.as_str() {
        "encode" => encode_file(input, output),
        "decode" => decode_file(input, output),
        _ => {
            usage();
            std::process::exit(1);
        }
    }
}

package main

import (
	"bytes"
	"compress/gzip"
	"encoding/base64"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
)

func encodeFile(inputPath, outputPath string) error {
	data, err := os.ReadFile(inputPath)
	if err != nil {
		return err
	}

	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	if _, err := gz.Write(data); err != nil {
		return err
	}
	if err := gz.Close(); err != nil {
		return err
	}

	b64 := base64.StdEncoding.EncodeToString(buf.Bytes())
	out := fmt.Sprintf("EC v1\nt=gz>b64;ct=json\n%s", b64)
	return writeOutput(out, outputPath)
}

func decodeFile(inputPath, outputPath string) error {
	raw, err := os.ReadFile(inputPath)
	if err != nil {
		return err
	}

	lines := strings.Split(strings.ReplaceAll(string(raw), "\r\n", "\n"), "\n")
	if len(lines) < 3 {
		return errors.New("invalid EC v1 message: expected 3 lines")
	}
	if lines[0] != "EC v1" {
		return errors.New("invalid EC v1 header")
	}

	payload := lines[2]
	compressed, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		return err
	}

	gzReader, err := gzip.NewReader(bytes.NewReader(compressed))
	if err != nil {
		return err
	}
	defer gzReader.Close()

	var outBuf bytes.Buffer
	if _, err := io.Copy(&outBuf, gzReader); err != nil {
		return err
	}

	return writeOutput(outBuf.String(), outputPath)
}

func writeOutput(content, outputPath string) error {
	if outputPath == "" {
		fmt.Println(content)
		return nil
	}
	return os.WriteFile(outputPath, []byte(content), 0644)
}

func main() {
	mode := flag.String("mode", "", "encode or decode")
	input := flag.String("input", "", "input file path")
	output := flag.String("output", "", "optional output file path")
	flag.Parse()

	if *mode == "" || *input == "" {
		fmt.Println("Usage: go run ecv1.go -mode encode|decode -input <file> [-output <file>]")
		os.Exit(1)
	}

	var err error
	switch *mode {
	case "encode":
		err = encodeFile(*input, *output)
	case "decode":
		err = decodeFile(*input, *output)
	default:
		err = errors.New("mode must be encode or decode")
	}

	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}

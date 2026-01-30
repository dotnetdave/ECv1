import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Base64;
import java.util.List;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

public class ECv1Protocol {
    public static void main(String[] args) throws IOException {
        if (args.length < 2) {
            System.out.println("Usage: java ECv1Protocol <encode|decode> <file> [outputFile]");
            System.exit(1);
        }

        String mode = args[0];
        String input = args[1];
        String output = args.length > 2 ? args[2] : null;

        switch (mode) {
            case "encode":
                encodeFile(input, output);
                break;
            case "decode":
                decodeFile(input, output);
                break;
            default:
                System.out.println("Mode must be encode or decode.");
                System.exit(1);
        }
    }

    public static void encodeFile(String inputPath, String outputPath) throws IOException {
        byte[] data = Files.readAllBytes(Paths.get(inputPath));

        ByteArrayOutputStream byteStream = new ByteArrayOutputStream();
        try (GZIPOutputStream gzip = new GZIPOutputStream(byteStream)) {
            gzip.write(data);
        }

        String b64 = Base64.getEncoder().encodeToString(byteStream.toByteArray());
        String message = "EC v1\nt=gz>b64;ct=json\n" + b64;
        writeOutput(message.getBytes(), outputPath);
    }

    public static void decodeFile(String inputPath, String outputPath) throws IOException {
        List<String> lines = Files.readAllLines(Paths.get(inputPath));
        if (lines.size() < 3) {
            throw new IOException("Invalid EC v1 message: expected 3 lines");
        }
        if (!"EC v1".equals(lines.get(0))) {
            throw new IOException("Invalid EC v1 header");
        }

        String payload = lines.get(2);
        byte[] compressed = Base64.getDecoder().decode(payload);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (GZIPInputStream gzip = new GZIPInputStream(new ByteArrayInputStream(compressed))) {
            gzip.transferTo(out);
        }

        writeOutput(out.toByteArray(), outputPath);
    }

    private static void writeOutput(byte[] content, String outputPath) throws IOException {
        if (outputPath == null) {
            System.out.write(content);
            if (content.length == 0 || content[content.length - 1] != '\n') {
                System.out.write('\n');
            }
        } else {
            try (FileOutputStream fos = new FileOutputStream(outputPath)) {
                fos.write(content);
            }
        }
    }
}

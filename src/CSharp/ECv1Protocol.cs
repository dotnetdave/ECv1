using System;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;
using System.Text.Json;

public static class ECv1Protocol
{
    // Encode a strongly typed message into EC v1 text.
    public static string Encode<T>(T message, string transformChain = "gz>b64", string contentType = "json")
    {
        var json = JsonSerializer.Serialize(message);
        var data = Encoding.UTF8.GetBytes(json);

        foreach (var transform in transformChain.Split('>'))
        {
            switch (transform)
            {
                case "gz":
                    using (var compressedStream = new MemoryStream())
                    {
                        using (var gzip = new GZipStream(compressedStream, CompressionLevel.Optimal))
                        {
                            gzip.Write(data, 0, data.Length);
                        }
                        data = compressedStream.ToArray();
                    }
                    break;
                case "b64":
                    data = Encoding.UTF8.GetBytes(Convert.ToBase64String(data));
                    break;
                case "none":
                    continue;
                default:
                    throw new InvalidOperationException($"Unknown transform: {transform}");
            }
        }

        var finalPayload = Encoding.UTF8.GetString(data);
        return $"EC v1\nt={transformChain};ct={contentType}\n{finalPayload}";
    }

    // Decode EC v1 text into a strongly typed object.
    public static T Decode<T>(string ecv1Text)
    {
        var lines = ecv1Text.Replace("\r\n", "\n").Split('\n').Where(l => !string.IsNullOrWhiteSpace(l)).ToArray();
        if (lines.Length < 3)
            throw new InvalidOperationException($"Invalid EC v1 message: expected 3 lines, got {lines.Length}.");
        if (lines[0] != "EC v1")
            throw new InvalidOperationException("Invalid EC v1 header.");

        var (transformChain, contentType) = ParseMetaLine(lines[1]);
        var payload = lines[2];

        var data = Encoding.UTF8.GetBytes(payload);
        data = ApplyTransformsInReverse(transformChain, data);

        var json = Encoding.UTF8.GetString(data);
        // contentType currently informational; future versions could branch on ct.
        return JsonSerializer.Deserialize<T>(json);
    }

    private static (string transformChain, string contentType) ParseMetaLine(string meta)
    {
        string t = null, ct = null;
        foreach (var part in meta.Split(';'))
        {
            if (part.StartsWith("t=")) t = part.Substring(2);
            if (part.StartsWith("ct=")) ct = part.Substring(3);
        }
        if (string.IsNullOrWhiteSpace(t))
            throw new InvalidOperationException("Transform chain (t=) not found.");
        if (string.IsNullOrWhiteSpace(ct))
            ct = "json";
        return (t, ct);
    }

    private static byte[] ApplyTransformsInReverse(string transformChain, byte[] data)
    {
        var chain = transformChain.Split('>', StringSplitOptions.RemoveEmptyEntries).Reverse();
        foreach (var transform in chain)
        {
            switch (transform)
            {
                case "b64":
                    data = Convert.FromBase64String(Encoding.UTF8.GetString(data));
                    break;
                case "gz":
                    using (var compressedStream = new MemoryStream(data))
                    using (var gzip = new GZipStream(compressedStream, CompressionMode.Decompress))
                    using (var resultStream = new MemoryStream())
                    {
                        gzip.CopyTo(resultStream);
                        data = resultStream.ToArray();
                    }
                    break;
                case "none":
                    continue;
                default:
                    throw new InvalidOperationException($"Unknown transform: {transform}");
            }
        }
        return data;
    }
}

// Minimal CLI for quick adoption: dotnet run -- encode input.json output.txt
public static class Program
{
    public static void Main(string[] args)
    {
        if (args.Length < 2)
        {
            Console.WriteLine("Usage: dotnet run -- encode|decode <inputFile> [outputFile]");
            Environment.Exit(1);
        }

        var mode = args[0];
        var input = args[1];
        var output = args.Length > 2 ? args[2] : null;

        try
        {
            switch (mode)
            {
                case "encode":
                    var json = File.ReadAllText(input);
                    var obj = JsonSerializer.Deserialize<object>(json);
                    var encoded = ECv1Protocol.Encode(obj);
                    WriteOutput(encoded, output);
                    break;
                case "decode":
                    var text = File.ReadAllText(input);
                    var decoded = ECv1Protocol.Decode<object>(text);
                    var pretty = JsonSerializer.Serialize(decoded, new JsonSerializerOptions { WriteIndented = true });
                    WriteOutput(pretty, output);
                    break;
                default:
                    Console.WriteLine("Mode must be encode or decode.");
                    Environment.Exit(1);
                    break;
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Error: {ex.Message}");
            Environment.Exit(1);
        }
    }

    private static void WriteOutput(string content, string path)
    {
        if (string.IsNullOrEmpty(path))
        {
            Console.WriteLine(content);
        }
        else
        {
            File.WriteAllText(path, content);
        }
    }
}

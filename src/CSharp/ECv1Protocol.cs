using System;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Text.Json;

public static class ECv1Protocol
{
    public static string Encode<T>(T message, string transformChain = "gz>b64", string contentType = "json")
    {
        string json = JsonSerializer.Serialize(message);
        byte[] data = Encoding.UTF8.GetBytes(json);

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

        string finalPayload = Encoding.UTF8.GetString(data);
        return $"EC v1\nt={transformChain};ct={contentType}\n{finalPayload}";
    }

    public static T Decode<T>(string[] lines)
    {
        if (lines[0] != "EC v1")
            throw new InvalidOperationException("Invalid EC v1 Header");

        string transformLine = lines[1];
        string payload = lines[2];

        string transformChain = GetTransformChain(transformLine);

        byte[] data = Convert.FromBase64String(payload);
        data = ApplyTransformChain(transformChain, data);

        string json = Encoding.UTF8.GetString(data);
        return JsonSerializer.Deserialize<T>(json);
    }

    private static string GetTransformChain(string transformLine)
    {
        var parts = transformLine.Split(';');
        foreach (var part in parts)
        {
            if (part.StartsWith("t="))
                return part.Substring(2);
        }
        throw new InvalidOperationException("Transform chain not found.");
    }

    private static byte[] ApplyTransformChain(string transformChain, byte[] data)
    {
        foreach (var transform in transformChain.Split('>'))
        {
            switch (transform)
            {
                case "gz":
                    using (var compressedStream = new MemoryStream(data))
                    using (var gzip = new GZipStream(compressedStream, CompressionMode.Decompress))
                    using (var resultStream = new MemoryStream())
                    {
                        gzip.CopyTo(resultStream);
                        data = resultStream.ToArray();
                    }
                    break;
                case "b64":
                    // Already handled before loop
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

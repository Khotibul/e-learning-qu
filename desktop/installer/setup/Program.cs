using System.Diagnostics;
using System.IO.Compression;
using System.Reflection;

namespace E_LearningQu.Setup;

/// <summary>
/// Setup.exe self-extracting: mengekstrak payload.zip (hasil publish aplikasi) ke folder temp,
/// lalu menjalankan Install.cmd yang sama dengan paket zip — sehingga perilaku instalasi identik.
/// Argumen --verify hanya mengekstrak &amp; memeriksa isi paket (dipakai untuk smoke test build).
/// </summary>
internal static class Program
{
    private const string AppExe = "E-LearningQu.Desktop.exe";

    private static int Main(string[] args)
    {
        var verifyOnly = args.Any(a => a.Equals("--verify", StringComparison.OrdinalIgnoreCase));
        var workDir = Path.Combine(Path.GetTempPath(), "E-LearningQuSetup-" + Guid.NewGuid().ToString("N"));

        try
        {
            Console.WriteLine("E-LearningQu Desktop — Setup");
            Console.WriteLine("Mengekstrak paket aplikasi...");
            Directory.CreateDirectory(workDir);

            var extracted = ExtractPayload(workDir);
            Console.WriteLine($"  {extracted} file siap.");

            if (!File.Exists(Path.Combine(workDir, AppExe)))
                throw new InvalidOperationException($"{AppExe} tidak ada di dalam paket.");

            if (verifyOnly)
            {
                Console.WriteLine("VERIFY OK");
                return 0;
            }

            Console.WriteLine("Menjalankan instalasi...");
            var psi = new ProcessStartInfo("cmd.exe", "/c Install.cmd /nopause")
            {
                WorkingDirectory = workDir,
                UseShellExecute = true
            };

            using var process = Process.Start(psi)
                ?? throw new InvalidOperationException("Tidak dapat menjalankan Install.cmd.");
            process.WaitForExit();

            if (process.ExitCode != 0)
            {
                Console.Error.WriteLine($"Instalasi gagal (kode {process.ExitCode}).");
                return process.ExitCode;
            }

            Console.WriteLine("Instalasi selesai.");
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("Setup gagal: " + ex.Message);
            return 1;
        }
        finally
        {
            if (!verifyOnly)
                TryDelete(workDir);
        }
    }

    private static int ExtractPayload(string targetDir)
    {
        var assembly = Assembly.GetExecutingAssembly();
        var resource = assembly.GetManifestResourceNames()
            .FirstOrDefault(n => n.EndsWith("payload.zip", StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException("Payload installer tidak ditemukan di dalam Setup.exe.");

        using var stream = assembly.GetManifestResourceStream(resource)
            ?? throw new InvalidOperationException("Payload installer tidak dapat dibaca.");
        using var zip = new ZipArchive(stream, ZipArchiveMode.Read);

        var count = 0;
        foreach (var entry in zip.Entries)
        {
            if (string.IsNullOrEmpty(entry.Name)) continue; // folder

            var destination = Path.GetFullPath(Path.Combine(targetDir, entry.FullName));
            if (!destination.StartsWith(targetDir, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Entri paket tidak valid: " + entry.FullName);

            Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
            entry.ExtractToFile(destination, overwrite: true);
            count++;
        }
        return count;
    }

    private static void TryDelete(string dir)
    {
        try { if (Directory.Exists(dir)) Directory.Delete(dir, recursive: true); }
        catch { /* file mungkin masih dipakai antivirus — abaikan */ }
    }
}

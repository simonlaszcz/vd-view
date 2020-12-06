using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Html;
using System;
using System.Collections.Generic;
using System.IO;
using System.Net;

namespace ViewDataViewer.Core
{
    public static class ContentExtensionMethods
    {
        public static IHtmlContent FileHash(this IWebHostEnvironment host, string path, bool includeParam = true)
        {
            if (string.IsNullOrWhiteSpace(path))
            {
                return null;
            }

            if (includeParam)
            {
                return new HtmlString($"v={WebUtility.UrlEncode(GetFileHash(host, path))}");
            }
            else
            {
                return new HtmlString(WebUtility.UrlEncode(GetFileHash(host, path)));
            }
        }

        /// <summary>
        /// Returns the hash of the given file from 'Build\hashes'. If no hash is found,
        /// the current ticks is returned to bust the browser cache
        /// </summary>
        private static string GetFileHash(IWebHostEnvironment host, string url)
        {
            var hashes = GetFileHashes(host);
            var key = Path.GetFileName(url);

            if (hashes.ContainsKey(key))
            {
                return hashes[key];
            }

            return DateTime.UtcNow.Ticks.ToString();
        }

        /// <summary>
        /// 'hashes' is generated post-build by Build\GetHashes.ps1
        /// The file is a list of: filename{whitespace}hash
        /// </summary>
        private static Dictionary<string, string> GetFileHashes(IWebHostEnvironment host)
        {
            var hashes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            try
            {
                var hashFilePath = Path.Combine(host.ContentRootPath, "Build", "hashes.txt");

                using (var sin = new StreamReader(hashFilePath))
                {
                    while (sin.Peek() > 0)
                    {
                        var line = sin.ReadLine();

                        if (string.IsNullOrWhiteSpace(line))
                        {
                            continue;
                        }

                        var tokens = line.Split(new char[0], StringSplitOptions.RemoveEmptyEntries);

                        if (tokens.Length > 1)
                        {
                            hashes[tokens[0]] = tokens[1];
                        }
                    }
                }
            }
            catch
            {
                //  Do nothing
            }

            return hashes;
        }
    }
}
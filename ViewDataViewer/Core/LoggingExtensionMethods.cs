using Microsoft.Extensions.Logging;
using System;
using System.Runtime.CompilerServices;

namespace ViewDataViewer.Core
{
    public static class LoggingExtensionMethods
    {
        public static void Error(this ILogger logger, Exception ex, [CallerMemberName] string caller = null)
        {
            logger.LogError(ex, $"{nameof(Error)}: {caller}:");
        }

        public static void Error(this ILogger logger, string msg, [CallerMemberName] string caller = null)
        {
            logger.LogError($"{nameof(Error)}: {caller}: {msg}");
        }

        public static void Trace(this ILogger logger, Exception ex, [CallerMemberName] string caller = null)
        {
            logger.LogTrace(ex, $"{nameof(Trace)}: {caller}:");
        }

        public static void Trace(this ILogger logger, string msg, [CallerMemberName] string caller = null)
        {
            logger.LogTrace($"{nameof(Trace)}: {caller}: {msg}");
        }

        public static void Info(this ILogger logger, string msg, [CallerMemberName] string caller = null)
        {
            logger.LogInformation($"{nameof(Info)}: {caller}: {msg}");
        }
    }
}

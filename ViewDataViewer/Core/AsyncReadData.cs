using System;

namespace ViewDataViewer.Core
{
    public class AsyncReadData
    {
        public AsyncReadData(byte[] buffer, Action<string> callback, DateTime timestamp)
        {
            this.Buffer = buffer;
            this.Callback = callback;
            this.Timestamp = timestamp;
        }

        public byte[] Buffer { get; private set; }
        public Action<string> Callback { get; private set; }
        public DateTime Timestamp { get; set; }
    }
}
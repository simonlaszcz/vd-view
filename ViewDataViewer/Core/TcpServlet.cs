using Microsoft.Extensions.Logging;
using System;
using System.IO;
using System.Linq;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace ViewDataViewer.Core
{
    public sealed class TcpServlet : IDisposable
    {
        private readonly ILogger log;
        private readonly IEventHub events;
        private TcpClient client;
        private NetworkStream stream;
        private bool disposed;

        public TcpServlet(ILogger log, IEventHub events, string name, Endpoint endpoint)
        {
            this.log = log;
            this.events = events;
            this.Endpoint = endpoint;
            this.Name = name;
        }

        public int ReadTimeoutMs { get; set; } = 10000;      
        public Endpoint Endpoint { get; private set; }
        public string Name { get; private set; }
        public string UserId { get; private set; }
        public DateTime OpenedUtc { get; private set; }
        public DateTime LastActiveUtc { get; private set; }
        public bool Connected => this.client?.Connected ?? false;
        public double MinutesInactive => (DateTime.UtcNow - this.LastActiveUtc).TotalMinutes;
        public double MinutesOpen => (DateTime.UtcNow - this.OpenedUtc).TotalMinutes;
        public long BytesSent { get; private set; }
        public long BytesReceived { get; private set; }

        public async Task Open(string userId)
        {
            if (string.IsNullOrWhiteSpace(userId))
            {
                throw new ArgumentException(Constants.Messages.NullParameter, nameof(userId));
            }

            this.log.Info($"open: [{userId}] start [{this.Endpoint}]");

            if (this.Connected)
            {
                throw new Exception(Constants.Messages.AlreadyOpen);
            }

            if (this.Endpoint.AvailableConnections == 0)
            {
                throw new Exception(Constants.Messages.CannotConnectEndpointConnectionsExhausted);
            }

            this.client = new TcpClient
            {
                NoDelay = true
            };

            await this.client.ConnectAsync(this.Endpoint.Address, this.Endpoint.Port);
            this.stream = this.client.GetStream();
            this.stream.WriteByte(22);

            if (this.Endpoint.Preamble != null && this.Endpoint.Preamble.Length > 0)
            {
                this.TraceBuffer(true, this.Endpoint.Preamble);
                this.Write(this.Endpoint.Preamble);
            }
    
            SetLastActive();
            this.OpenedUtc = DateTime.UtcNow;
            this.Endpoint.ActiveConnections++;
            this.UserId = userId;
            this.log.Trace($"open: [{this.UserId}] end");
        }

        public void Close()
        {
            this.log.Trace($"close: [{this.UserId}] start [{this.Endpoint}]");

            if (this.Connected)
            {
                try
                {
                    if (this.Endpoint.HardPostamble != null && this.Endpoint.HardPostamble.Length > 0)
                    {
                        this.TraceBuffer(true, this.Endpoint.HardPostamble);
                        this.Write(this.Endpoint.HardPostamble);
                    }
                }
                catch (Exception ex)
                {
                    this.log.Error(ex, $"close: [{this.UserId}] failed to write postamble");
                }

                this.stream.Dispose();
                this.client.Close();
                this.stream = null;
                this.client = null;
                this.Endpoint.ActiveConnections--;
                this.log.Info($"close: [{this.UserId}] disconnected");
            }

            this.UserId = null;
        }

        public async Task<string> Read()
        {
            if (!this.Connected)
            {
                throw new Exception(Constants.Messages.ClosedCannotRead);
            }

            SetLastActive();

            this.log.Trace($"read: [{this.UserId}] waiting");
            if (!SpinWait.SpinUntil(() => this.stream.DataAvailable, this.ReadTimeoutMs))
            {
                this.log.Error($"read: [{this.UserId}] no data");
                return string.Empty;
            }

            this.log.Trace($"read: [{this.UserId}] starting read");
            using (MemoryStream ms = new MemoryStream())
            {
                byte[] buffer = new byte[this.client.ReceiveBufferSize];
                
                while (this.stream.DataAvailable)
                {
                    while (this.stream.DataAvailable)
                    {
                        int read = await this.stream.ReadAsync(buffer, 0, this.client.ReceiveBufferSize);

                        if (read > 0)
                        {
                            this.log.Trace($"read: [{this.UserId}] read {read} bytes");
                            this.BytesReceived += read;
                            ms.Write(buffer, 0, read);
                        }
                    }

                    var start = DateTime.UtcNow;
                    if (!SpinWait.SpinUntil(() => this.stream.DataAvailable, this.Endpoint.DataWaitMs))
                    {
                        this.log.Trace($"read: [{this.UserId}] timed out while waiting for more data");
                    }
                    else 
                    {
                        this.log.Trace($"read: [{this.UserId}] waited {(DateTime.UtcNow - start).TotalMilliseconds:0.00}ms for more data");
                    }
                }

                this.log.Trace($"read: [{this.UserId}] {ms.Length} total bytes read");
                var msb = ms.ToArray();
                this.TraceBuffer(false, msb);

                return Convert.ToBase64String(msb);
            }
        }

        /// <summary>
        /// Start an async read. The received callback is invoked with each data packet. When no more data is available the callback is invoked with string.Empty
        /// </summary>
        public void AsyncRead(Action<string> received)
        {
            if (received == null)
            {
                throw new ArgumentNullException(nameof(received));
            }

            if (!this.Connected)
            {
                throw new Exception(Constants.Messages.ClosedCannotRead);
            }

            SetLastActive();

            try
            {
                AsyncReadData data = new AsyncReadData(new byte[this.client.ReceiveBufferSize], received, DateTime.UtcNow);
                this.log.Trace($"asyncRead: [{this.UserId}] starting read");
                this.stream.BeginRead(data.Buffer, 0, this.client.ReceiveBufferSize, AsyncReadHandler, data);
            }
            catch (System.IO.IOException ex)
            {
                this.log.Error(ex, $"asyncRead: [{this.UserId}] stream probably closed");

                if (this.Connected)
                {
                    this.events.RaiseException(this.UserId, Constants.Messages.RemoteHostError);
                }
            }
        }

        public void Write(byte[] b)
        {
            if (!this.Connected)
            {
                throw new Exception(Constants.Messages.ClosedCannotWrite);
            }

            if (b == null || b.Length == 0)
            {
                throw new Exception(Constants.Messages.CannotWriteNoData);
            }

            this.log.Trace($"write: [{this.UserId}]");
            SetLastActive();
            this.BytesSent += b.Length;
            this.TraceBuffer(true, b);
            this.stream.Write(b, 0, b.Length);
        }

        public void Write(string b64)
        {
            if (!this.Connected)
            {
                throw new Exception(Constants.Messages.ClosedCannotWrite);
            }

            if (string.IsNullOrWhiteSpace(b64))
            {
                throw new Exception(Constants.Messages.CannotWriteNoData);
            }

            this.log.Trace($"write: [{this.UserId}] {b64}");
            SetLastActive();
            var bytes = Convert.FromBase64String(b64);

            if (bytes.Length > 0)
            {
                this.BytesSent += bytes.Length;
                this.TraceBuffer(true, bytes);
                this.stream.Write(bytes, 0, bytes.Length);
            }
        }

        public void AsyncWrite(string b64)
        {
            if (!this.Connected)
            {
                throw new Exception(Constants.Messages.ClosedCannotWrite);
            }

            if (string.IsNullOrWhiteSpace(b64))
            {
                throw new Exception(Constants.Messages.CannotWriteNoData);
            }

            this.log.Trace($"asyncWrite: [{this.UserId}] {b64}");
            SetLastActive();

            try
            {
                var bytes = Convert.FromBase64String(b64);

                if (bytes.Length > 0)
                {
                    this.BytesSent += bytes.Length;
                    this.TraceBuffer(true, bytes);
                    this.stream.BeginWrite(bytes, 0, bytes.Length, AsyncWriteHandler, null);
                }
            }
            catch (Exception ex)
            {                
                this.log.Error(ex, $"asyncWrite: [{this.UserId}] stream probably closed");

                if (this.Connected)
                {
                    this.events.RaiseException(this.UserId, Constants.Messages.RemoteHostError);
                }
            }
        }

        public void Ping()
        {
            this.log.Trace($"ping: [{this.UserId}]");
            SetLastActive();
        }

        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }

        private void Dispose(bool disposing)
        {
            if (!this.disposed)
            {
                if (disposing)
                {
                    if (this.stream != null)
                    {
                        this.stream.Dispose();
                    }

                    if (this.client != null)
                    {
                        this.client.Close();
                    }
                }

                this.disposed = true;
            }
        }

        ~TcpServlet()
        {
            Dispose(false);
        }

        private void SetLastActive()
        {
            this.LastActiveUtc = DateTime.UtcNow;
        }

        private void AsyncReadHandler(IAsyncResult result)
        {
            try
            {                
                AsyncReadData data = (AsyncReadData)result.AsyncState;
                int read = this.stream.EndRead(result);
                this.log.Trace($"asyncRead: [{this.UserId}] read {read} bytes after {(DateTime.UtcNow - data.Timestamp).TotalMilliseconds:0.00}ms");

                if (read > 0)
                {
                    this.BytesReceived += read;
                    SetLastActive();
                    this.TraceBuffer(false, data.Buffer, read);
                    data.Callback(Convert.ToBase64String(data.Buffer, 0, read));
                }

                data.Timestamp = DateTime.UtcNow;
                this.stream.BeginRead(data.Buffer, 0, this.client.ReceiveBufferSize, AsyncReadHandler, data);
            }
            catch (Exception ex)
            {
                this.log.Error(ex, $"asyncRead: [{this.UserId}] stream probably closed");

                if (this.Connected)
                {
                    this.events.RaiseException(this.UserId, Constants.Messages.RemoteHostError);
                }
            }
        }

        private void AsyncWriteHandler(IAsyncResult result)
        {
            try
            {
                SetLastActive();
                this.stream.EndWrite(result);                
            }
            catch (Exception ex)
            {
                this.log.Error(ex, $"asyncWrite: [{this.UserId}] stream probably closed");

                if (this.Connected)
                {
                    this.events.RaiseException(this.UserId, Constants.Messages.RemoteHostError);
                }
            }
        }

        private void TraceBuffer(bool isWriting, byte[] buffer)
        {
            this.TraceBuffer(isWriting, buffer, buffer?.Length ?? 0);
        }

        private void TraceBuffer(bool isWriting, byte[] buffer, int length)
        {
            var tag = isWriting ? "SEND: " : "GOT: ";
            var sb = new StringBuilder(tag);
            
            if (buffer == null)
            {
                sb.Append("NULL");
            }
            else
            {
                sb.Append(string.Join(", ", buffer.Take(length).Select(x => x.ToString())));
            }

            this.log.Trace(sb.ToString());
        }
    }
}
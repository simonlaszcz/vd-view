using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Timers;

namespace ViewDataViewer.Core
{
    public class TcpServletProvider : ITcpServletProvider, IDisposable
    {
        public static readonly double CloseInactiveIntervalMins = 1;
        public static readonly double MaxInactiveMins = 20;
        public static readonly double MaxOpenMins = 60 * 24;
        public static int MaxServlets = 25;

        private static readonly byte[] ViewdataHardLogoff = Encoding.UTF8.GetBytes("*90__");
        private static readonly byte[] ViewdataSoftLogoff = Encoding.UTF8.GetBytes("*90_");
        private static readonly Dictionary<string, List<Endpoint>> Endpoints = new Dictionary<string, List<Endpoint>>
        {
            { "NXTel", new List<Endpoint> { 
                new Endpoint("nx.nxtel.org", 23280, 200)
            }},
            //{ "NXTel (test)", new List<Endpoint> { 
            //    new Endpoint("nx.nxtel.org", 23281, 200)
            //}},
            { "TeeFax", new List<Endpoint> { 
                new Endpoint("pegasus.matrixnetwork.co.uk", 6502, 1200) { HardPostamble = Encoding.UTF8.GetBytes("FFF"), SoftPostamble = Encoding.UTF8.GetBytes("FFF"), Mode = EndpointMode.Teletext } 
            }},
            { "Telstar (fast)", new List<Endpoint> { 
                new Endpoint("glasstty.com", 6502, 1000) {Preamble = new byte[] {255, 253, 3}, HardPostamble = ViewdataHardLogoff, SoftPostamble = ViewdataSoftLogoff }, 
                new Endpoint("glasstty.com", 6503, 1000) {Preamble = new byte[] {255, 253, 3}, HardPostamble = ViewdataHardLogoff, SoftPostamble = ViewdataSoftLogoff } 
            }},
            { "Telstar (slow)", new List<Endpoint> { 
                new Endpoint("glasstty.com", 6502, 1000) { HardPostamble = ViewdataHardLogoff, SoftPostamble = ViewdataSoftLogoff }, 
                new Endpoint("glasstty.com", 6503, 1000) { HardPostamble = ViewdataHardLogoff, SoftPostamble = ViewdataSoftLogoff } 
            }},
            { "Telstar (test)", new List<Endpoint> { 
                new Endpoint("glasstty.com", 6504, 1000) { HardPostamble = ViewdataHardLogoff, SoftPostamble = ViewdataSoftLogoff } 
            }},
            { "Tetrachloromethane (CCl4)", new List<Endpoint> { 
                new Endpoint("fish.ccl4.org", 23, 2000) { HardPostamble = Encoding.UTF8.GetBytes("*QQ"), SoftPostamble = ViewdataSoftLogoff } 
            }},
            //{ "Ringworld", new List<Endpoint> { new Endpoint("rw1.m63.co.uk", 23, 2000), new Endpoint("rw2.m63.co.uk", 23, 2000) }}
        };

        private bool disposed;
        private readonly ILogger<TcpServletProvider> log;
        private readonly IEventHub events;
        private readonly Timer timer;
        private volatile List<TcpServlet> servlets;

        public TcpServletProvider(ILogger<TcpServletProvider> log, IEventHub events)
        {
            this.log = log;
            this.events = events;
            
            this.servlets = new List<TcpServlet>();
            this.timer = new Timer(CloseInactiveIntervalMins * 60000);
            this.timer.AutoReset = true;
            this.timer.Enabled = true;
            this.timer.Elapsed += (sender, e) => {
                CloseInactiveClients();
            };            
        }

        public IEnumerable<string> Services => Endpoints.Keys;
        
        /// <summary>
        /// Return a new tcp connection. 
        /// </summary>
        public async Task<TcpServlet> Open(string userId, string service)
        {
            if (string.IsNullOrWhiteSpace(userId))
            {
                throw new ArgumentException(Constants.Messages.NullParameter, nameof(userId));
            }

            if (string.IsNullOrWhiteSpace(service))
            {
                throw new ArgumentException(Constants.Messages.NullParameter, nameof(service));
            }

            if (!Endpoints.ContainsKey(service))
            {
                throw new ArgumentException(Constants.Messages.InvalidService, nameof(service));
            }

            if (IsOpen(userId))
            {
                throw new Exception(Constants.Messages.AlreadyOpen);
            }

            if (servlets.Count == MaxServlets)
            {
                throw new Exception(Constants.Messages.CannotConnectTooManyUsers);
            }

            var endpoints = Endpoints[service].Where(x => x.AvailableConnections > 0).OrderBy(x => Guid.NewGuid()).ToList();

            if (endpoints.Count == 0)
            {
                throw new Exception(Constants.Messages.CannotConnectEndpointConnectionsExhausted);
            }

            TcpServlet servlet = null;
            var idx = 0;

            while (idx < endpoints.Count && servlet == null)
            {
                try
                {
                    var endpoint = endpoints[idx];
                    this.log.Trace($"open: [{userId}] Trying {endpoint.Address}:{endpoint.Port}");
                    var pending = new TcpServlet(this.log, this.events, service, endpoint);
                    await pending.Open(userId);

                    if (pending.Connected)
                    {
                        servlet = pending;
                    }
                }
                catch (Exception ex)
                {
                    this.log.Error(ex, $"open: [{userId}]");
                }

                ++idx;
            }

            if (servlet == null)
            {
                throw new Exception(Constants.Messages.CannotConnectRemoteError);
            }

            servlets.Add(servlet);
            this.log.Info($"open: [{userId}] connected. {servlets.Count} active servlets");
            this.BroadcastStats();

            return servlet;
        }

        /// <summary>
        /// Return the open client affiliated with the current user, or null
        /// </summary>
        public TcpServlet Get(string userId)
        {
            if (string.IsNullOrWhiteSpace(userId))
            {
                throw new ArgumentException(Constants.Messages.NullParameter, nameof(userId));
            }

            var servlet = this.servlets.FirstOrDefault(x => x.Connected && string.Equals(x.UserId, userId, StringComparison.InvariantCultureIgnoreCase));

            if (servlet == null)
            {
                throw new Exception(Constants.Messages.NotConnected);
            }

            return servlet;
        }

        public bool IsOpen(string userId)
        {
            if (string.IsNullOrWhiteSpace(userId))
            {
                throw new ArgumentException(Constants.Messages.NullParameter, nameof(userId));
            }

            return this.servlets.Any(x => x.Connected && string.Equals(x.UserId, userId, StringComparison.InvariantCultureIgnoreCase));
        }

        /// <summary>
        /// Close the user's connection
        /// </summary>
        public void Close(string userId)
        {
            if (string.IsNullOrWhiteSpace(userId))
            {
                throw new ArgumentException(Constants.Messages.NullParameter, nameof(userId));
            }

            TcpServlet servlet = this.servlets.FirstOrDefault(x => string.Equals(x.UserId, userId, StringComparison.InvariantCultureIgnoreCase));

            if (servlet != null)
            {
                try
                {
                    servlet.Close();
                    this.servlets = servlets.Where(x => x.Connected).ToList();
                    this.log.Info($"close: {servlets.Count} active servlets remaining");
                    this.BroadcastStats();
                }
                catch (Exception ex)
                {
                    this.log.Error(ex, $"close: [{userId}]");
                }
            }
        }

        public void ForceCloseAllClients()
        {            
            this.log.Info("force_close: starting");
            this.events.RaiseException(Constants.Messages.ServerShutdown);

            foreach (var servlet in this.servlets.Where(x => x.Connected))
            {
                this.log.Info($"force_close: [{servlet.UserId}] closing [{servlet.Endpoint}]");

                try
                {
                    servlet.Close();
                }
                catch (Exception ex2)
                {
                    this.log.Error(ex2, $"force_close: [{servlet.UserId}]");
                }
            }

            this.servlets = servlets.Where(x => x.Connected).ToList();
            this.log.Info($"force_close: {servlets.Count} active servlets remaining");
            this.BroadcastStats();
        }

        public void BroadcastStats()
        {
            this.events.RaiseStatsUpdate(MaxServlets, servlets.Count);            
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
                    foreach (var servlet in this.servlets)
                    {
                        try
                        {
                            servlet.Dispose();
                        }
                        catch
                        {
                            //  Do nothing
                        }
                    }
                }

                this.disposed = true;
            }
        }

        ~TcpServletProvider()
        {
            Dispose(false);
        }

        private void CloseInactiveClients()
        {
            this.LogServlets();
            this.log.Info("close_inactive: starting");
            var previousCount = this.servlets.Count;
            var inactive = this.servlets.Where(x => x.Connected && (x.MinutesInactive > MaxInactiveMins || x.MinutesOpen > MaxOpenMins));

            foreach (var servlet in inactive)
            {
                this.log.Info($"close_inactive: [{servlet.UserId}] closing. minutesInactive={servlet.MinutesInactive:0.00}, minutesOpen={servlet.MinutesOpen:0.00} [{servlet.Endpoint}]");

                try
                {
                    this.events.RaiseException(servlet.UserId, Constants.Messages.ClosedInactive);
                    servlet.Close();
                }
                catch (Exception ex)
                {
                    this.log.Error(ex, $"close_inactive: [{servlet.UserId}]");
                }
            }

            this.servlets = servlets.Where(x => x.Connected).ToList();
            var closed = previousCount - this.servlets.Count;
            this.log.Info($"close_inactive: {servlets.Count} active servlets remaining, {closed} closed");
            this.BroadcastStats();
        }

        private void LogServlets()
        {
            for (int idx = 0; idx < this.servlets.Count; ++idx)
            {
                var servlet = this.servlets[idx];
                this.log.Info($"servlet: n={idx}, userId={servlet.UserId}, endpoint={servlet.Endpoint}, connected={servlet.Connected}, openedUtc={servlet.OpenedUtc:yyyy-MM-ddThh:mm:ss}, minutesOpen={servlet.MinutesOpen:0.00}, minutesInactive={servlet.MinutesInactive:0.00}, sent={servlet.BytesSent}, received={servlet.BytesReceived}");
            }
        }
    }
}
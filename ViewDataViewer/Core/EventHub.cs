using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using System;
using System.Threading.Tasks;
using ViewDataViewer.Hubs;

namespace ViewDataViewer.Core
{
    public class EventHub : IEventHub
    {
        private readonly ILogger<EventHub> log;
        private readonly IHubContext<ViewDataHub> hub;

        public EventHub(ILogger<EventHub> log, IHubContext<ViewDataHub> hub)
        {
            this.log = log;
            this.hub = hub;
        }

        public void RaiseStatsUpdate(int max, int active)
        {
            try
            {
                this.hub.Clients.All.SendAsync("Stats", new StatsUpdateEventArgs(max, active));
            }
            catch (Exception ex)
            {
                this.log.Error(ex);
                throw;
            }
        }

        public async Task RaiseException(string message)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(message))
                {
                    throw new ArgumentException($"'{nameof(message)}' cannot be null or whitespace", nameof(message));
                }

                await this.hub.Clients.All.SendAsync("Exception", message);
            }
            catch (Exception ex)
            {
                this.log.Error(ex);
                throw;
            }
        }

        public async Task RaiseException(string userId, string message)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(userId))
                {
                    throw new ArgumentException($"'{nameof(userId)}' cannot be null or whitespace", nameof(userId));
                }

                if (string.IsNullOrWhiteSpace(message))
                {
                    throw new ArgumentException($"'{nameof(message)}' cannot be null or whitespace", nameof(message));
                }

                await this.hub.Clients.Group(userId).SendAsync("Exception", message);
            }
            catch (Exception ex)
            {
                this.log.Error(ex);
                throw;
            }
        }
    }
}
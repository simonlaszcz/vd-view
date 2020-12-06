using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Text;
using System.Threading.Tasks;
using ViewDataViewer.Core;

namespace ViewDataViewer.Hubs
{
    public class ViewDataHub : Hub
    {
        private const string DefaultHubExceptionMessage = "SignalR error occurred";
        private readonly ITcpServletProvider servlets;
        private readonly ILogger<ViewDataHub> log;

        public ViewDataHub(
            ITcpServletProvider servlets,
            ILogger<ViewDataHub> log)
        {            
            this.servlets = servlets;
            this.log = log;
        }

        public IEnumerable<string> Services()
        {
            try
            {
                return this.servlets.Services;       
            }
            catch (Exception ex)
            {
                this.log.Error(ex);
                throw new HubException(DefaultHubExceptionMessage, ex);
            }
        }

        public async Task<object> Open(string service)
        {
            try
            {
                var servlet = await this.servlets.Open(this.UserId, service);

                return ServletDetails(servlet);
            }
            catch (Exception ex)
            {
                this.log.Error(ex);
                throw new HubException(DefaultHubExceptionMessage, ex);
            }
        }

        public void Close()
        {
            try
            {
                this.servlets.Close(this.UserId);
            }
            catch (Exception ex)
            {
                this.log.Error(ex);
                throw new HubException(DefaultHubExceptionMessage, ex);
            }
        }

        public Task<string> Read()
        {
            try
            {
                return this.servlets.Get(this.UserId).Read();
            }
            catch (Exception ex)
            {
                this.log.Error(ex);
                throw new HubException(DefaultHubExceptionMessage, ex);
            }
        }

        public void AsyncRead()
        {
            try
            {
                var userId = this.UserId;
                var group = this.Clients.Group(userId);

                this.servlets.Get(userId).AsyncRead(async (b64) => {
                    await group.SendAsync("Received", b64);
                });
            }
            catch (Exception ex)
            {
                this.log.Error(ex);
                throw new HubException(DefaultHubExceptionMessage, ex);
            }
        }

        public void Write(string b64)
        {
            try
            {
                this.servlets.Get(this.UserId).Write(b64);
            }
            catch (System.IO.IOException ex)
            {
                //  Connection probably closed by third party
                this.log.Trace(ex);
            }
            catch (Exception ex)
            {
                this.log.Error(ex);
                throw new HubException(DefaultHubExceptionMessage, ex);
            }
        }

        public void AsyncWrite(string b64)
        {
            try
            {
                this.servlets.Get(this.UserId).AsyncWrite(b64);
            }
            catch (Exception ex)
            {
                this.log.Error(ex);
                throw new HubException(DefaultHubExceptionMessage, ex);
            }
        }

        public void Ping()
        {
            try
            {
                this.servlets.Get(this.UserId).Ping();
            }
            catch (Exception ex)
            {
                this.log.Error(ex);
                throw new HubException(DefaultHubExceptionMessage, ex);
            }
        }

        public object IsOpen()
        {
            try
            {
                TcpServlet servlet = null;

                if (this.servlets.IsOpen(this.UserId))
                {
                    servlet = this.servlets.Get(this.UserId);
                }

                return ServletDetails(servlet);
            }
            catch (Exception ex)
            {
                this.log.Error(ex);
                throw new HubException(DefaultHubExceptionMessage, ex);
            }
        }

        public override Task OnConnectedAsync()
        {
            try
            {
                Groups.AddToGroupAsync(Context.ConnectionId, this.UserId);  
                this.servlets.BroadcastStats();

                return base.OnConnectedAsync();
            }
            catch (Exception ex)
            {
                this.log.Error(ex);
                throw new HubException(DefaultHubExceptionMessage, ex);
            }
        }

        public override Task OnDisconnectedAsync(Exception exception)
        {
            try
            {
                Groups.RemoveFromGroupAsync(Context.ConnectionId, this.UserId);

                return base.OnDisconnectedAsync(exception);
            }
            catch (Exception ex)
            {
                this.log.Error(ex);
                throw new HubException(DefaultHubExceptionMessage, ex);
            }
        }

        private string UserId => Context?.UserIdentifier;

        private object ServletDetails(TcpServlet servlet)
        {
            if (servlet == null)
            {
                return new 
                {
                    IsOpen = false
                };
            }

            string postamble = null;

            if (servlet.Endpoint.SoftPostamble != null && servlet.Endpoint.SoftPostamble.Length > 0)
            {
                postamble = Encoding.UTF8.GetString(servlet.Endpoint.SoftPostamble);
            }

            return new 
            {
                IsOpen = true,
                Host = servlet.Endpoint.Address,
                Port = servlet.Endpoint.Port,
                Service = servlet.Name,
                Postamble = postamble,
                Mode = servlet.Endpoint.Mode.ToString()
            };
        }
    }
}
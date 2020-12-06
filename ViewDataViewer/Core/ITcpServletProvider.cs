using System.Collections.Generic;
using System.Threading.Tasks;

namespace ViewDataViewer.Core
{
    public interface ITcpServletProvider
    {
        IEnumerable<string> Services { get; }

        Task<TcpServlet> Open(string userId, string service);
        TcpServlet Get(string userId);
        void Close(string userId);
        bool IsOpen(string userId);
        void ForceCloseAllClients();
        void BroadcastStats();
    }
}
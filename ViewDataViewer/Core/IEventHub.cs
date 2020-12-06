using System.Threading.Tasks;

namespace ViewDataViewer.Core
{
    public interface IEventHub
    {
        void RaiseStatsUpdate(int max, int active);
        Task RaiseException(string message);
        Task RaiseException(string userId, string message);
    }
}
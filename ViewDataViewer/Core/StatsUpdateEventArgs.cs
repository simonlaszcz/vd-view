using System;

namespace ViewDataViewer.Core
{
    public class StatsUpdateEventArgs : EventArgs
    {
        public StatsUpdateEventArgs(int max, int active)
        {
            this.Max = max;
            this.Active = active;
        }

        public int Max { get; private set; }
        public int Active { get; private set; }
    }
}
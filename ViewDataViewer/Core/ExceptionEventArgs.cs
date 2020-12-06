using System;

namespace ViewDataViewer.Core
{
    public class ExceptionEventArgs : EventArgs
    {
        public ExceptionEventArgs(string userId, string message)
        {
            this.UserId = userId;
            this.Message = message;
        }

        public string UserId { get; private set; }
        public string Message { get; private set; }
    }
}
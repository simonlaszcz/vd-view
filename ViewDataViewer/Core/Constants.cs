namespace ViewDataViewer.Core
{
    public static class Constants
    {
        public static class Messages
        {
            public static readonly string ClosedCannotRead = "Cannot read from a closed connection";
            public static readonly string ClosedCannotWrite = "Cannot write to a closed connected";
            public static readonly string ClosedInactive = "Inactive session closed";
            public static readonly string NullParameter = "Parameter not specified";
            public static readonly string CannotWriteNoData = "No data was given to write";
            public static readonly string AlreadyOpen = "The connection is already open";
            public static readonly string CannotConnectTooManyUsers = "Unable to connect as all connections are in use. Try again later";
            public static readonly string CannotConnectEndpointConnectionsExhausted = "Unable to connect as all connections are in use. Try again later";
            public static readonly string CannotConnectRemoteError = "Unable to connect. A tcp connection could not be established. Try again later";
            public static readonly string NotConnected = "Open a connection first";
            public static readonly string InvalidService = "Service does not exist";
            public static readonly string GenericError = "A server-side error occurred. Please refresh your page or try again later";
            public static readonly string RemoteHostError = "Remote host error";
            public static readonly string ServerShutdown = "Server stopping for maintenance";
        }
    }
}
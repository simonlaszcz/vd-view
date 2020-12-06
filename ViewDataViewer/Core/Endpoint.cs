namespace ViewDataViewer.Core
{
    public enum EndpointMode
    {
        Viewdata = 0,
        Teletext
    }

    public class Endpoint
    {
        public Endpoint(string address, int port, int dataWaitMs)
        {
            if (string.IsNullOrWhiteSpace(address))
            {
                throw new System.ArgumentException("empty", nameof(address));
            }

            this.Address = address;
            this.Port = port;
            this.DataWaitMs = dataWaitMs;
            this.MaxConnections = int.MaxValue;
        }

        public string Address { get; private set; }
        public int Port { get; private set; }
        public int DataWaitMs { get; private set; }
        /// <summary>
        /// Data sent immediately after connection
        /// </summary>
        public byte[] Preamble { get; set; }
        /// <summary>
        /// Data sent before the connection is hard closed
        /// </summary>
        public byte[] HardPostamble { get; set; }
        /// <summary>
        /// Data that can be sent by the client to initiate a log off. 
        /// This may lead to a mailbox for example and further actions
        /// </summary>
        public byte[] SoftPostamble { get; set; }
        public int MaxConnections { get; set; }
        public int ActiveConnections { get; set; }
        public int AvailableConnections => this.MaxConnections - this.ActiveConnections;
        public EndpointMode Mode { get; set; }

        public override string ToString()
        {
            return $"{this.Address}:{this.Port}";
        }
    }
}
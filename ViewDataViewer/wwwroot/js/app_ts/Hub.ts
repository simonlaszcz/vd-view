import * as Logger from './Logger.js';
import * as SignalR from '@microsoft/signalr';

export type EndpointMode = 'Viewdata' | 'Teletext';

export interface IConnectionInfo {
    readonly isOpen: boolean,
    readonly host: string | null,
    readonly port: number | null,
    readonly service: string | null,
    readonly postamble: string | null,
    readonly mode: EndpointMode | null
}

export interface IViewDataHubServer {
    services(): Promise<Array<string>>,
    isOpen(): Promise<IConnectionInfo>,
    open(service: string): Promise<IConnectionInfo>,
    asyncWrite(b64: string): Promise<void>,
    write(b64: string): Promise<void>,
    asyncRead(): Promise<void>,
    read(): Promise<string>,
    close(): Promise<void>
}

export interface IStats {
    max: number,
    active: number
}

export interface IViewDataHubClient {
    received(b64: string): void,
    stats(stats: IStats): void,
    exception(message: string): void
}

export class Hub {
    private readonly connection: SignalR.HubConnection;
    private readonly log = new Logger.Log();
    readonly Server: IViewDataHubServer;

    constructor(callbacks: IViewDataHubClient) {
        this.connection = new SignalR.HubConnectionBuilder()
            .withUrl('/viewDataHub')
            .configureLogging(SignalR.LogLevel.Error)
            .build();

        this.connection.on('Received', (b64: string) => {
            callbacks.received(b64);
        });
        this.connection.on('stats', (stats: IStats) => {
            callbacks.stats(stats);
        });
        this.connection.on('exception', (message: string) => {
            callbacks.exception(message);
        });

        this.Server = {
            services: () => this.connection.invoke('Services'),
            isOpen: () => this.connection.invoke('IsOpen'),
            open: (service: string) => this.connection.invoke('Open', service),
            asyncWrite: (b64: string) => this.connection.invoke('AsyncWrite', b64),
            write: (b64: string) => this.connection.invoke('Write', b64),
            asyncRead: () => this.connection.invoke('AsyncRead'),
            read: () => this.connection.invoke('Read'),
            close: () => this.connection.invoke('Close')
        };
    }

    Connect(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.connection.state == SignalR.HubConnectionState.Disconnected) {
                this.connection.start()
                    .then(() => {
                        this.log.Success('SignalR: started');
                        resolve();
                    })
                    .catch((error: string) => {
                        this.log.Success(`SignalR: ${error}`);
                        reject(error);
                    });
            }
            else {
                resolve();
            }
        });
    }
}
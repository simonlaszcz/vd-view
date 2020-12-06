import * as Terminal from './Terminal.js';
import * as Views from './Views.js';

export interface IThumbnail {
    mime: string,
    b64: string
}

interface IStoredFrame {
    b64: string,
    thumbnail: IThumbnail
}

export class Frame {
    public readonly b64: string;
    public readonly thumbnail: IThumbnail;
    public readonly uri: string;

    constructor(data: IStoredFrame) {
        this.b64 = data.b64;
        this.thumbnail = data.thumbnail;
        this.uri = `data:${data.thumbnail.mime};base64,${data.thumbnail.b64}`;
    }
}

interface IStoredDownload {
    filename: string,
    size: number,
    b64: string,
    mime: string
}

export class Download {
    public readonly filename: string;
    public readonly size: number;
    public readonly b64: string;
    public readonly mime: string;
    public readonly uri: string;

    constructor(data: IStoredDownload) {
        this.filename = data.filename;
        this.size = data.size;
        this.b64 = data.b64;
        this.mime = data.mime;        
        this.uri = `data:${data.mime};base64,${data.b64}`;
    }
}

export class Storage {
    public readonly MimeTypes = {
        Binary: 'application/octet-stream',
        ImagePng: 'image/png'
    };

    private readonly frameKeyPrefix = /^SF_([0-9]+)$/;
    private readonly downloadKeyPrefix = /^DL_(.+)$/;
    private readonly storage = window.localStorage;
    private frameKeys: Array<string>;
    private downloadKeys: Array<string>;

    constructor() {
        this.frameKeys = [...this.getKeys(this.frameKeyPrefix)];
        this.downloadKeys = [...this.getKeys(this.downloadKeyPrefix)];
        this.frameKeys.sort();
        this.downloadKeys.sort();
    }

    get EnableFlashing(): boolean {
        return this.storage.getItem('EnableFlashing') == 'true';
    }
    set EnableFlashing(b: boolean) {
        this.storage.setItem('EnableFlashing', String(b === true));
    }
    get MessageSequenceNumber(): number {
        return Number(this.storage.getItem('MessageSequenceNumber')) || 0;
    }
    set MessageSequenceNumber(sn: number) {
        this.storage.setItem('MessageSequenceNumber', String(sn));
    }
    get Version(): number {
        return Number(this.storage.getItem('Version')) || 0;
    }
    set Version(n: number) {
        this.storage.setItem('Version', String(n));
    }

    Frames(): Array<Frame> {
        return this.frameKeys
            .map((key) => {
                try {
                    return new Frame(JSON.parse(this.storage.getItem(key) as string));
                }
                catch(ex) {
                    this.storage.removeItem(key);
                }

                return null;
            })
            .filter(x => x != null) as Array<Frame>;
    }
    GetFrameAt(idx: number): Frame {
        return new Frame(JSON.parse(this.storage.getItem(this.frameKeys[idx]) as string));
    };
    RemoveFrameAt(idx: number) {
        this.storage.removeItem(this.frameKeys[idx]);
        this.frameKeys.splice(idx, 1);
    };
    AddFrame(b64: string, thumbnail: IThumbnail): Frame {
        const key = `SF_${this.getSeqNo()}`;
        const data: IStoredFrame = { b64, thumbnail };
        this.storage.setItem(key, JSON.stringify(data));
        this.frameKeys.push(key);

        return new Frame(data);
    }

    Downloads(): Array<Download> {
        return this.downloadKeys.map((key) => {
            try {
                return new Download(JSON.parse(this.storage.getItem(key) as string));
            }
            catch(ex) {
                this.storage.removeItem(key);
            }

            return null;
        }).filter(x => x != null) as Array<Download>;
    }
    RemoveDownloadAt(idx: number) {
        this.storage.removeItem(this.downloadKeys[idx]);
        this.downloadKeys.splice(idx, 1);
    }
    AddDownload(filename: string, size: number, b64: string, mime = this.MimeTypes.Binary): Download {
        const key = `DL_${filename}_${this.getSeqNo()}`;
        const data: IStoredDownload = { filename, size, b64, mime };
        this.storage.setItem(key, JSON.stringify(data));
        this.downloadKeys.push(key);

        return new Download(data);
    };

    Migrate() {
        if (this.Version == 0) {
            if (this.storage.getItem('HelpDismissed') == 'true') {
                this.MessageSequenceNumber = 1;
            }

            this.storage.removeItem('HelpDismissed');
            this.Version = 1;
        }

        if (this.Version == 1) {
            this.downloadKeys.forEach((key) => {
                let data = JSON.parse(this.storage.getItem(key) as string);

                if (!data.hasOwnProperty('mime')) {
                    data.mime = this.MimeTypes.Binary;
                }

                this.storage.setItem(key, JSON.stringify(data));
            });

            this.Version = 2;
        }

        if (this.Version == 2) {
            const canvas = document.getElementById('Canvas') as HTMLCanvasElement;
            const view = new Views.ViewDataView();

            this.frameKeys.forEach((key) => {
                const b64 = this.storage.getItem(key) as string;
                view.Decoder.Load(b64);
                const thumbnail = Terminal.SaveAsImage(view.Buffer, canvas, 160, 125);
                this.storage.setItem(key, JSON.stringify({b64, thumbnail}));
            });

            this.Version = 3;
        }

        if (this.Version == 3) {
            this.storage.removeItem('MessageSequenceNumber');
            this.Version = 4;
        }
    }
    
    private *getKeys(pattern: RegExp) {
        for (let idx = 0; idx < this.storage.length; ++idx) {
            const key = this.storage.key(idx) as string;

            if (pattern.test(key)) {
                yield key;
            }
        }
    }

    private getSeqNo(): number {
        return Date.now() + Math.floor(Math.random() * 10);
    }
}
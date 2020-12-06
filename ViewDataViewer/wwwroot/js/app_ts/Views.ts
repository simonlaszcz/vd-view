import * as Mullard from './Mullard.js';
import * as Terminal from './Terminal.js';
import * as Storage from './Storage.js';
import * as Telesoft from './Telesoft.js';
import * as Mode7 from './Mode7.js';
import * as ViewDataHub from './Hub.js';
import * as Logger from './Logger.js';
import * as SVG from './SvgRenderer.js';

export class ViewDataView {
    readonly Buffer = new Terminal.Buffer();
    readonly IsRevealed = ko.observable<boolean>(false);
    readonly ShowGrid = ko.observable<boolean>(false);
    readonly EnableFlash = ko.observable<boolean>(false);
    readonly Decoder = new Mullard.SAA5050(this.Buffer);
    readonly Constants = Terminal.Constants;
    readonly SVG = new SVG.SvgBufferTransform(this.Buffer, this.ShowGrid);
}

export class Main {
    private readonly defaultHeader = `Click 'Connect'`;
    private readonly mainViewElement = document.getElementById('mainView') as HTMLElement;
    private readonly downloadsElement = document.getElementById('downloads') as HTMLElement;
    private readonly teletextCommands = {
        HOLD: 'H',
        ADVANCE: '.'
    };
    private readonly viewdataCommands = {
        NEXT: '#',
        PREVIOUS: '*#'
    };
    
    readonly Header = ko.observable<string>(this.defaultHeader);
    readonly UserStats = ko.observable<string | null>(null);
    readonly Services = ko.observableArray<string>();
    readonly SelectedService = ko.observable<string>();
    readonly IsViewFocused = ko.observable<boolean>(true);
    readonly IsConnected = ko.observable<boolean>(false);
    readonly IsViewdata = ko.observable<boolean>(true);
    readonly IsTeletext = ko.observable<boolean>(false);
    readonly Postamble = ko.observable<string | null>(null);
    readonly Downloading = ko.observable<boolean>(false);
    readonly Input = ko.observable<string>();
    readonly FrameSlider: JQueryLightSlider;
    readonly Downloads = ko.observableArray<Storage.Download>();
    readonly SavedFrames = ko.observableArray<Storage.Frame>();
    readonly EnableLogoff = ko.computed<boolean>(() => {
        return this.IsConnected() && this.Postamble() != null;
    });
    readonly EnableCommands = ko.computed<boolean>(() => {
        return this.IsConnected() && !this.Downloading();
    });
    readonly EnableDownload = ko.observable<boolean>(false);
    readonly Log = new Logger.Log();
    readonly View = new ViewDataView();
    readonly Storage = new Storage.Storage();

    readonly Keyboard = new Terminal.Input(
        (code) => {
            switch (code) {
                case Terminal.ControlKeys.Hold:
                    this.Command(this.teletextCommands.HOLD);
                    break;
                case Terminal.ControlKeys.Advance:
                    this.Command(this.teletextCommands.ADVANCE);
                    break;
                case Terminal.ControlKeys.Reveal:
                    this.ToggleReveal();
                    break;
                case Terminal.ControlKeys.Download:
                    this.Download();
                    break;
            }
        },
        (text) => {
            this.Command(text);
        }
    );

    readonly Downloader = new Telesoft.Downloads(
        (error: string) => {
            this.Status.unexpected();
            this.Log.Error(error);
        },
        (frame: string) => {
            this.send(frame == 'z' ? '0' : '#');
        },
        (filename: string, size: number) => {
            this.Downloading(false);
            this.EnableDownload(false);
            const b64 = this.Downloader.GetBase64();
            this.Downloads.push(this.Storage.AddDownload(filename, size, b64, this.Storage.MimeTypes.Binary));
            this.Log.Info(`'${filename}' downloaded`);
            this.send('#');
            this.scrollToDownloads();
        }
    );

    readonly Hub = new ViewDataHub.Hub({
        received: (b64: string) => {
            if (b64 == null) {
                return;
            }

            this.View.Decoder.DecodeBase64(b64);

            if (this.Downloading()) {
                try {
                    this.Downloader.Decode(b64);
                }
                catch (ex) {
                    this.Log.Error(ex);
                    this.Status.unexpected();
                }
            }
            else {
                try {
                    this.EnableDownload(this.Downloader.TryDecodeHeaderFrame(b64));
                }
                catch (ex) {
                    //  Do nothing
                }
            }
        },
        stats: (stats: ViewDataHub.IStats) => {
            if (!stats.active) {
                this.UserStats('0 users online');
            }
            else if (stats.active == 1) {
                this.UserStats('1 user online');
            }
            else {
                this.UserStats(`${stats.active} users online`);
            }
        },
        exception: (message: string) => {
            this.Status.error(message);
            this.Log.Error(message);
        }
    });

    private readonly Status = {
        success: (text: string) => {
            this.View.Buffer.SetStatusRow(text, 2, 0);
        },
        info: (text: string) => {
            this.View.Buffer.SetStatusRow(text, 7, 0);
        },
        error: (text: string) => {
            this.View.Buffer.SetStatusRow(text, 1, 0);
        },
        unexpected: () => {
            this.View.Buffer.SetStatusRow('An error occurred', 1, 0);
        },
        warning: (text: string) => {
            this.View.Buffer.SetStatusRow(text, 3, 0);
        },
        clear: () => {
            this.View.Buffer.SetStatusRow(null, 0, 0);
        }
    };

    constructor() {
        this.Storage.Migrate();
        this.Downloads(this.Storage.Downloads());
        this.View.EnableFlash(this.Storage.EnableFlashing);
        this.View.EnableFlash.subscribe((newv) => {
            this.Storage.EnableFlashing = newv;

            if (newv) {
                Terminal.Clock.Start();
            }
            else {
                Terminal.Clock.Stop();
            }
        });
        this.initGestures();

        if (this.View.EnableFlash()) {
            Terminal.Clock.Start();
        }

        this.FrameSlider = $("#saved-frames").lightSlider({
            item: 6,
            autoWidth: true
        });
        this.SavedFrames(this.Storage.Frames());
        setTimeout(() => {
            this.FrameSlider.refresh();
        }, 0);

        this.Hub.Connect()
            .then(() => {
                return this.Hub.Server.services();
            })
            .then((services) => {
                this.Services(services);
                return this.checkConnection(true);
            })
            .catch(() => {
                this.Log.Info('No existing connection');
            });

        [this.View.IsRevealed, this.View.ShowGrid, this.View.EnableFlash].forEach((x) => x.subscribe(() => {
            this.IsViewFocused(true);
        }));
    }

    OnKeyDown = (el: any, event: { originalEvent: { key: string } }) => {
        var oe = event.originalEvent;

        if (oe.key == 'Enter') {
            this.Send();
            return false;
        }

        return true;
    };

    ToggleConnect = _.throttle(() => {
        this.IsViewFocused(true);
        this.Status.clear();
        this.Hub.Connect()
            .then(() => {
                return this.IsConnected() ? this.disconnect() : this.connect();
            })
            .catch((err) => {
                this.Log.Error(err);
            });
    }, 1000);

    ToggleReveal = _.throttle(() => {
        this.IsViewFocused(true);
        this.View.IsRevealed(!this.View.IsRevealed());
    }, 1000);

    Send = _.throttle(() => {
        if (!this.IsConnected()) {
            return;
        }

        this.IsViewFocused(true);
        var text = this.Input() || '';

        if (!text.endsWith('#')) {
            text += '#';
        }

        this.Command(text);
    }, 1000);

    Command = (text: string) => {
        if (text == null || !this.IsConnected()) {
            return;
        }

        this.IsViewFocused(true);
        this.Downloader.Reset();
        this.Status.clear();
        this.Hub.Connect()
            .then(() => {
                this.send(text);
            })
            .catch((err) => {
                this.Log.Error(err);
            });
    };

    Logoff = () => {
        if (!this.IsConnected()) {
            return;
        }

        this.IsViewFocused(true);
        this.Downloader.Reset();
        this.Status.clear();
        this.Hub.Connect()
            .then(() => {
                if (this.Postamble() != null) {
                    this.send(this.Postamble() as string);
                }
            })
            .catch((err) => {
                this.Log.Error(err);
            });
    };

    Download = () => {
        if (!(this.EnableDownload() && this.IsConnected())) {
            return;
        }

        this.IsViewFocused(true);
        this.Status.clear();
        this.Hub.Connect()
            .then(() => {
                this.Downloading(true);
                this.send('#');
            })
            .catch((err) => {
                this.Log.Error(err);
            });
    };

    RemoveDownload = _.throttle((idx: number) => {
        this.IsViewFocused(true);
        this.Storage.RemoveDownloadAt(idx);
        var downloads = this.Downloads();
        downloads.splice(idx, 1);
        this.Downloads(downloads);
    }, 1000);

    SaveFrame = _.throttle(() => {
        this.IsViewFocused(true);
        var b64 = this.View.Decoder.GetFrameAsBase64();

        if (b64 == null) {
            return;
        }

        const canvas = document.getElementById('Canvas') as HTMLCanvasElement;
        const thumbnail = Terminal.SaveAsImage(this.View.Buffer, canvas, 160, 125);
        const data = this.Storage.AddFrame(b64, thumbnail);
        this.SavedFrames.push(data);
        this.FrameSlider.refresh();
    }, 1000);

    LoadSavedFrame = _.throttle((idx: number) => {
        this.IsViewFocused(true);
        const data = this.Storage.GetFrameAt(idx);
        this.View.Decoder.Load(data.b64);
    }, 1000);

    Clipboard = ko.observable<string>();
    CopySavedFrame = _.throttle((idx: number) => {
        this.IsViewFocused(true);
        const data = this.Storage.GetFrameAt(idx);
        this.Clipboard(data.b64);
        (document.getElementById('Clipboard') as HTMLInputElement).select();
        document.execCommand('copy');
    }, 1000);

    RemoveSavedFrame = _.throttle((idx: number) => {
        this.IsViewFocused(true);
        this.Storage.RemoveFrameAt(idx);
        var views = this.SavedFrames();
        views.splice(idx, 1);
        this.SavedFrames(views);
        this.FrameSlider.refresh();
    }, 1000);

    SaveAsImage = _.throttle(() => {
        this.IsViewFocused(true);
        const canvas = document.getElementById('Canvas') as HTMLCanvasElement;
        const data = Terminal.SaveAsImage(this.View.Buffer, canvas);
        const filename = `${this.View.Decoder.FrameNumber()}${data.extension}`;
        const image = this.Storage.AddDownload(filename, data.size, data.b64, data.mime);
        this.Downloads.push(image);
        this.scrollToDownloads();
    }, 1000);

    FullScreen = _.throttle(async () => {
        if (this.mainViewElement.requestFullscreen) {
            this.View.ShowGrid(false);
            await this.mainViewElement.requestFullscreen();
            this.IsViewFocused(true);
        }
    }, 1000);

    private checkConnection(reload: boolean): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.Hub.Server.isOpen()
                .then((result: ViewDataHub.IConnectionInfo) => {
                    if (result.isOpen) {
                        this.SelectedService(result.service as string);
                        this.onConnected(result);
                        this.Log.Info(`Already connected`);

                        if (reload) {
                            this.Log.Info(`Reloading frame. Sending '*00#'`);
                            this.send('*00#');
                        }

                        resolve();
                    }
                    else {
                        if (this.IsConnected()) {
                            this.Log.Warning(`The session was closed due to inactivity or an error on the remote host. Please re-connect`);
                            this.Status.warning(`Session closed: inactive/remote error`);
                        }

                        this.onDisconnected();
                        reject();
                    }
                })
                .catch((error) => {
                    this.Log.Error(error);
                    this.Status.unexpected();
                    this.onDisconnected();
                    reject(error);
                });
        });
    }

    private send(text: string): void {
        const raw = Mode7.FromKeyboardString(text);
        this.Log.Info(`Sending '${text}' encoded as '${raw}'`);
        const b64 = btoa(raw);
        this.Hub.Server.asyncWrite(b64)
            .catch(() => {
                this.Log.Error(`Send failed. Checking connection`);
                return this.checkConnection(false);
            })
            .catch(() => {
                this.Log.Info('No existing connection');
            });
    }

    private connect(this: Main): Promise<any> {
        var service = this.SelectedService() as string;
        this.Log.Info(`Connecting to ${service}`);

        return this.checkConnection(true).catch(() => {
                return this.Hub.Server.open(service)
                    .then((result: ViewDataHub.IConnectionInfo) => {
                        this.Log.Success(`Connected to ${result.host} on port ${result.port}`);
                        this.onConnected(result);
                    })
                    .catch((error) => {
                        this.Log.Error(error);
                        this.Status.unexpected();
                    });
            });
    }

    private disconnect(this: Main): Promise<void> {
        this.Log.Info(`Disconnecting...`);

        return this.Hub.Server.close()
            .then(() => {
                this.Log.Success('Disconnected');
                this.onDisconnected();
            })
            .catch((error) => {
                this.Log.Error(error);
                this.onDisconnected();
            });
    }

    private initGestures(): void {
        let mc = new Hammer.Manager(this.mainViewElement);
        mc.add(new Hammer.Tap({ event: 'singletap', taps: 1 }));
        mc.add(new Hammer.Pan({ event: 'panleft', direction: Hammer.DIRECTION_LEFT }));
        mc.add(new Hammer.Pan({ event: 'panright', direction: Hammer.DIRECTION_RIGHT }));
        mc.add(new Hammer.Pan({ event: 'pandown', direction: Hammer.DIRECTION_DOWN }));

        mc.on('panleft', _.debounce(() => {
            if (!this.IsConnected()) {
                return;
            }

            if (this.IsTeletext()) {
                this.Command(this.teletextCommands.ADVANCE);
            }
            else {
                this.Command(this.viewdataCommands.NEXT);
            }
        }, 500));

        mc.on('panright', _.debounce(() => {
            if (!this.IsConnected()) {
                return;
            }

            if (!this.IsTeletext()) {
                this.Command(this.viewdataCommands.PREVIOUS);
            }
        }, 500));

        mc.on('pandown', _.debounce(() => {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
        }, 500));

        mc.on('singletap', (e) => {
            if (this.IsConnected()) {
                if (this.IsTeletext()) {
                    this.Command(this.teletextCommands.HOLD);
                }
            }
        });
    }

    private onConnected(result: ViewDataHub.IConnectionInfo): void {
        this.Header(`${result.host}:${result.port}`);
        this.IsConnected(true);
        this.Postamble(result.postamble);
        this.IsViewdata(result.mode == 'Viewdata');
        this.IsTeletext(result.mode == 'Teletext');
        this.Hub.Server.asyncRead();
    }

    private onDisconnected(): void {
        this.Header(this.defaultHeader);
        this.IsConnected(false);
        this.EnableDownload(false);
        this.Postamble(null);
    }

    private scrollToDownloads(): void {
        const y = this.downloadsElement.getBoundingClientRect().top + window.scrollY;
        window.scroll({ top: y, behavior: 'smooth' });
    }
}
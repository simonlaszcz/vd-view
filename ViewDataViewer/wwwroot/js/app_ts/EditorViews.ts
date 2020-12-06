import * as Mullard from './Mullard.js';
import * as Terminal from './Terminal.js';
import * as Storage from './Storage.js';
import * as Mode7 from './Mode7.js';
import * as Logger from './Logger.js';
import * as SVG from './SvgRenderer.js';

export class ExoticCharacters {
    readonly Column2: Array<KnockoutComputed<Mode7.ICharacterCode>>;
    readonly Column3: Array<KnockoutComputed<Mode7.ICharacterCode>>;
    readonly Column4: Array<KnockoutComputed<Mode7.ICharacterCode>>;
    readonly Column5: Array<KnockoutComputed<Mode7.ICharacterCode>>;
    readonly Column6: Array<KnockoutComputed<Mode7.ICharacterCode>>;
    readonly Column7: Array<KnockoutComputed<Mode7.ICharacterCode>>;

    constructor(
        private readonly isContiguous: KnockoutObservable<boolean>,
        private readonly isAlpha: KnockoutObservable<boolean>,
        private readonly isGraphics: KnockoutObservable<boolean>)
    {
        const rows = Array.from(Array(16).keys());
        this.Column2 = rows.map(n => ko.computed<Mode7.ICharacterCode>(() => {
            return Mode7.ToDisplay(n, 2, this.isAlpha(), this.isGraphics(), this.isContiguous());
        }));
        this.Column3 = rows.map(n => ko.computed<Mode7.ICharacterCode>(() => {
            return Mode7.ToDisplay(n, 3, this.isAlpha(), this.isGraphics(), this.isContiguous());
        }));
        this.Column4 = rows.map(n => ko.computed<Mode7.ICharacterCode>(() => {
            return Mode7.ToDisplay(n, 4, this.isAlpha(), this.isGraphics(), this.isContiguous());
        }));
        this.Column5 = rows.map(n => ko.computed<Mode7.ICharacterCode>(() => {
            return Mode7.ToDisplay(n, 5, this.isAlpha(), this.isGraphics(), this.isContiguous());
        }));
        this.Column6 = rows.map(n => ko.computed<Mode7.ICharacterCode>(() => {
            return Mode7.ToDisplay(n, 6, this.isAlpha(), this.isGraphics(), this.isContiguous());
        }));
        this.Column7 = rows.map(n => ko.computed<Mode7.ICharacterCode>(() => {
            return Mode7.ToDisplay(n, 7, this.isAlpha(), this.isGraphics(), this.isContiguous());
        }));
    }
}

export class ViewDataView {
    readonly Buffer = new Terminal.Buffer();
    readonly IsRevealed = ko.observable<boolean>(false);
    readonly ShowGrid = ko.observable<boolean>(false);
    readonly EnableFlash = ko.observable<boolean>(false);
    readonly Decoder = new Mullard.SAA5050(this.Buffer);
    readonly Constants = Terminal.Constants;
    readonly SVG = new SVG.SvgBufferTransform(this.Buffer, this.ShowGrid);
    readonly Flags = this.Decoder.Flags;
    readonly ExoticCharacters = new ExoticCharacters(this.Flags.IsContiguous, this.Flags.IsAlpha, this.Flags.IsGraphics);
    readonly BgCss = ko.computed(() => {
        return `bg-${Terminal.Colours[this.Flags.BgColour()]}`;
    });
}

enum UndoStackItemType {
    Base64 = 0,
    Bytes = 1
}

export class Main {
    private readonly defaultHeader = `Viewdata Editor`;
    private readonly downloadsElement = document.getElementById('downloads') as HTMLElement;
    private readonly maxUndos = 10;

    readonly Header = ko.observable<string>(this.defaultHeader);
    readonly IsViewFocused = ko.observable<boolean>(true);
    readonly FrameSlider: JQueryLightSlider;
    readonly Input = ko.observable<string>();
    readonly Downloads = ko.observableArray<Storage.Download>();
    readonly SavedFrames = ko.observableArray<Storage.Frame>();
    readonly Log = new Logger.Log();
    readonly View = new ViewDataView();
    readonly Storage = new Storage.Storage();
    readonly AutoEscape = ko.observable<boolean>(false);
    readonly UndoStack = new Array<string>();
    readonly UndoStackSize = ko.observable(0);

    readonly Keyboard = new Terminal.Input(
        (code) => {
            switch (code) {
                case Terminal.ControlKeys.Reveal:
                    this.ToggleReveal();
                    break;
            }
        },
        (text) => {
            this.SendText(text);
        }
    );

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

        [this.View.IsRevealed, this.View.ShowGrid, this.View.EnableFlash].forEach((x) => x.subscribe(() => {
            this.IsViewFocused(true);
        }));
    }

    OnKeyDown = (el: any, event: { originalEvent: { key: string } }) => {
        return true;
    };

    ToggleReveal = _.throttle(() => {
        this.IsViewFocused(true);
        this.View.IsRevealed(!this.View.IsRevealed());
    }, 1000);

    SendCode = (code: number, escapable: boolean) => {
        if (code < 128) {
            code += 128;
        }

        this.IsViewFocused(true);
        this.Status.clear();

        const codes = new Array<number>();

        if (this.AutoEscape() && escapable) {
            codes.push(155);
        }

        codes.push(code);

        this.pushUndo();
        this.View.Decoder.DecodeBytes(new Uint8Array(codes));
    };

    SendControl = (code: number) => {
        this.IsViewFocused(true);
        this.Status.clear();
        this.pushUndo();
        this.View.Decoder.DecodeBytes(new Uint8Array([code]));
    };

    SendText = (text: string) => {
        this.IsViewFocused(true);
        this.Status.clear();
        this.pushUndo();
        this.View.Decoder.DecodeBase64(btoa(text));
    };

    SendBase64 = (b64: string) => {
        this.IsViewFocused(true);
        this.Status.clear();
        this.View.Decoder.Load(b64);
        this.UndoStack.length = 0;
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
        this.UndoStack.length = 0;
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

    CopyCurrent = _.throttle(() => {
        this.IsViewFocused(true);
        const b64 = this.View.Decoder.GetFrameAsBase64();
        this.Clipboard(b64);
        (document.getElementById('Clipboard') as HTMLInputElement).select();
        document.execCommand('copy');
    }, 1000);

    Undo = () => {
        this.IsViewFocused(true);
        this.Status.clear();

        if (this.UndoStack.length == 0) {
            this.UndoStackSize(0);
            return;
        }

        const b64 = this.UndoStack.pop();
        this.View.Decoder.Load(b64 as string);
        this.UndoStackSize(this.UndoStack.length);        
    };

    private scrollToDownloads(): void {
        const y = this.downloadsElement.getBoundingClientRect().top + window.scrollY;
        window.scroll({ top: y, behavior: 'smooth' });
    }

    private pushUndo(): void {
        const b64 = this.View.Decoder.GetFrameAsBase64();
        this.UndoStack.push(b64);

        if (this.UndoStack.length > this.maxUndos) {
            this.UndoStack.shift();
        }

        this.UndoStackSize(this.UndoStack.length);
    }
}
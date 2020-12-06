import * as Mode7 from './Mode7.js';

/**
* Colours range 1..7
* n.b. black cannot be explicitly selected but can be used for initialisation
*/
export enum Colours {
    black = 0,
    red,
    green,
    yellow,
    blue,
    magenta,
    cyan,
    white
}

export enum ControlKeys {
    Reveal = 'REVEAL',
    Advance = 'ADVANCE',
    Hold = 'HOLD',
    Download = 'DOWNLOAD'
}

export class Constants {
    public static readonly MaxCols = 40;
    public static readonly MaxRows = 24;
}

export class Buffer {
    Rows = new Array<Row>(Constants.MaxRows);
    StatusRow = new Row();
    Cursor = new Position({ row: 0, col: 0 });

    constructor() {
        for (let ridx = 0; ridx < Constants.MaxRows; ++ridx) {
            this.Rows[ridx] = new Row();
        }

        this.CursorOff();
    }

    Reset(): void {
        this.Rows.forEach(x => x.Reset());
        this.CursorOff();
    }

    Row(rowIdx: number): Row {
        return this.Rows[rowIdx];
    };

    Cell(rowIdx: number, colIdx: number): Cell {
        return this.Rows[rowIdx].Cells[colIdx];
    };

    CellAtPosition(position: Position): Cell {
        return this.Rows[position.Row()].Cells[position.Column()];
    };

    CursorOff(): void {
        this.CellAtPosition(this.Cursor).IsCursor(false);
    };

    CursorOn(row: number, col: number): void {
        this.Cursor.Row(row);
        this.Cursor.Column(col);
        this.CellAtPosition(this.Cursor).IsCursor(true);
    };

    ResetCursor(): void {
        this.CursorOff();
        this.Cursor.Row(0);
        this.Cursor.Column(0);
    }

    SetStatusRow(text: string | null, fg: Colours = Colours.white, bg: Colours = Colours.black): void {
        let idx: number = 0;

        if (text !== null) {
            if (text.length > Constants.MaxCols) {
                text = text.substring(0, Constants.MaxCols);
            }

            for (; idx < text.length; ++idx) {
                const cell = this.StatusRow.Cells[idx];
                const ch = Mode7.FromKeyboard(text[idx]).char;
                cell.Fg = fg;
                cell.Bg(bg);
                cell.Character(ch);
            }
        }

        while (idx < Constants.MaxCols) {
            const cell = this.StatusRow.Cells[idx];
            cell.Fg = fg;
            cell.Bg(bg);
            cell.Character(Mode7.Space);
            ++idx;
        }
    }
}

export class Row {
    Cells = new Array<Cell>(Constants.MaxRows);
    //  True if this row should not be rendered (i.e. double height row 2)
    IsHidden = ko.observable<boolean>(false);

    constructor() {
        for (let cidx = 0; cidx < Constants.MaxCols; ++cidx) {
            this.Cells[cidx] = new Cell();
        }
    }

    Reset(): void {
        this.Cells.forEach(x => x.Reset());
        this.IsHidden(false);
    }

    SetIsDoubleHeightLowerRow(): void {
        this.IsHidden(true);
    }
}

export class Cell {
    //  Colour index
    private _fg = ko.observable<Colours>(Colours.white);
    private _cachedFg = Colours.white;

    //  Unicode character
    Character = ko.observable<string>(Mode7.Space);
    //  Colour index
    Bg = ko.observable<Colours>(Colours.black);

    get Fg() : Colours {
        return this._fg();
    };

    set Fg(fg: Colours) {
        this._fg(fg);
        this._cachedFg = fg;
    }

    //  True if flashing
    IsFlashing = ko.observable<boolean>(false);
    //  When true, the text is only visible when 'reveal' is selected
    IsConcealed = ko.observable<boolean>(false);
    //  When true, this is row 1 of double height text
    IsDoubleHeight = ko.observable<boolean>(false);
    //  True when the cell has the cursor
    IsCursor = ko.observable<boolean>(false);
    //  True when Character is a contiguous mosaic
    IsContiguousMosaic = ko.observable<boolean>(false);

    constructor() {
        Clock.Enlist((show: boolean) => {
            if (!this.IsFlashing()) {
                return;
            }

            if (show) {
                this._fg(this._cachedFg);
            }
            else {
                this._fg(this.Bg());
            }
        });
    }

    Css = ko.computed<string>(() => {
        const bg = Colours[this.Bg()];
        const fg = Colours[this._fg()];

        return `bg-${bg} fg-${fg} ${this.IsFlashing() ? 'blink' : ''} ${this.IsDoubleHeight() ? 'double-height' : ''} ${this.IsConcealed() ? 'concealed' : ''} ${this.IsCursor() ? 'cursor' : ''} ${this.IsContiguousMosaic() ? 'mosaic' : ''}`;
    });

    Reset() : void {
        this.Character(Mode7.Space);
        this.Bg(0);
        this.Fg = Colours.white;
        this.IsFlashing(false);
        this.IsConcealed(false);
        this.IsDoubleHeight(false);
        this.IsCursor(false);
        this.IsContiguousMosaic(false);
    }

    SetCharacter(ch: string, isContiguousMosaic: boolean = false): void {
        this.Character(ch);
        this.IsContiguousMosaic(isContiguousMosaic);
    }
}

export interface IClockCallback {
    (show: boolean): void
}

export class Clock {
    private static callbacks = new Array<IClockCallback>()
    private static show = false;
    private static clock: number = 0;

    static Enlist(callback: IClockCallback) {
        Clock.callbacks.push(callback);
    }

    static Start() {
        Clock.show = false;
        Clock.clock = window.setInterval(() => {
            Clock.callbacks.forEach((cb) => {
                cb(Clock.show);
            });

            Clock.show = !Clock.show;
        }, 1000);
    }

    static Stop() {
        if (Clock.clock != 0) {
            window.clearInterval(Clock.clock);
            Clock.clock = 0;
        }

        Clock.callbacks.forEach((cb) => {
            cb(true);
        });
    }
}

export type OnAltHandler = (k: ControlKeys) => void;
export type OnCharHandler = (k: string) => void;

export class Input {
    constructor(private onAlt: OnAltHandler, private onChar: OnCharHandler) {
    }
    
    OnKeyDown = (el: HTMLElement, event: { originalEvent: KeyboardEvent }) => {
        const oe = event.originalEvent;

        if (oe.altKey) {
            switch (oe.key) {
                case 'R':
                case 'r':
                    this.onAlt(ControlKeys.Reveal);
                    break;
                case 'A':
                case 'a':
                    this.onAlt(ControlKeys.Advance);
                    break;
                case 'H':
                case 'h':
                    this.onAlt(ControlKeys.Hold);
                    break;
                case 'D':
                case 'd':
                    this.onAlt(ControlKeys.Download);
                    break;
            }

            return;
        }

        switch (oe.key) {
            case 'ArrowLeft':
            case 'Left':
            case 'Backspace':
                this.onChar('\b');
                break;
            case 'ArrowRight':
            case 'Right':
                this.onChar('\t');
                break;
            case 'ArrowUp':
            case 'Up':
                this.onChar('\v');
                break;
            case 'ArrowDown':
            case 'Down':
                this.onChar('\n');
                break;
            case 'Delete':
                this.onChar(String.fromCharCode(127));
                break;
            case 'Enter':
                this.onChar('_');
                break;
            case 'Escape':
                this.onChar(String.fromCharCode(27));
                break;
            default:
                if (oe.key.length == 1) {
                    if (oe.key == '#') {
                        this.onChar('_');
                    }
                    else {
                        this.onChar(oe.key);
                    }
                }
                break;
        }
    };
}

export interface IPositionData {
    row: number,
    col: number
}

export class Position {
    Row: KnockoutObservable<number>;
    Column: KnockoutObservable<number>;

    constructor(data: IPositionData) {
        this.Row = ko.observable(data.row);
        this.Column = ko.observable(data.col);
    }
}

export function SaveAsImage(buffer: Buffer, canvas: HTMLCanvasElement, imgSzX = 600, imgSzY = 480): { mime: string, b64: string, size: number, extension: string } {
    const colours = ['black', 'rgb(255, 0, 0)', 'rgb(0, 255, 0)', 'rgb(255, 255, 0)', 'rgb(0, 0, 255)', 'rgb(255, 0, 255)', 'rgb(0, 255, 255)', 'white'];
    const szX = Math.floor(imgSzX / Constants.MaxCols);
    const szY = Math.floor(imgSzY / Constants.MaxRows);
    const szY2 = szY * 2;
    canvas.height = imgSzY;
    canvas.width = imgSzX;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.textBaseline = 'bottom';
    let rectY = 0;
    let textY = 0;

    for (let row = 0; row < Constants.MaxRows; ++row) {
        if (buffer.Row(row).IsHidden()) {
            continue;
        }

        const isDoubleHeight = buffer.Row(row).Cells.some(x => x.IsDoubleHeight());

        if (isDoubleHeight) {
            textY += szY2;
            ctx.font = `${szY2}px bedstead-double-height`;
        }
        else {
            textY += szY;
            ctx.font = `${szY}px bedstead`;
        }

        for (let col = 0; col < Constants.MaxCols; ++col) {
            const cell = buffer.Cell(row, col);
            const x = col * szX;

            //  Bg rectangle: top left origin
            ctx.fillStyle = colours[cell.Bg()];
            ctx.fillRect(x, rectY, szX, isDoubleHeight ? szY2 : szY);

            //  Fg char: bottom left origin
            ctx.fillStyle = colours[cell.Fg];
            ctx.fillText(cell.Character(), x, textY, szX);

            //  Blur left to avoid gaps in font
            if (cell.IsContiguousMosaic()) {
                ctx.fillText(cell.Character(), x - 1, textY, szX);
            }
        }

        rectY += isDoubleHeight ? szY2: szY;
    }

    const preamble = 'data:image/png;base64,';
    let data = canvas.toDataURL();

    if (data.indexOf(preamble) == 0) {
        data = data.substring(preamble.length);
    }
            
    return {
        mime: 'image/png',
        b64: data,
        size: 4 * Math.ceil(data.length / 3),
        extension: '.png'
    };
}
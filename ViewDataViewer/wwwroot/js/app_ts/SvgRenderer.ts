import * as Terminal from './Terminal.js';
import * as Mode7 from './Mode7.js';

class Constants {
    //  Bedstead: 1000 units per em, width: 600, descender: 200
    static readonly CellHeight = 20;
    static readonly CellDoubleHeight = 40;
    //  Em unit width would be 12. We use 15 to maintain 4:3 aspect ratio
    static readonly CellWidth = 15;
    //  Height of 'tails' in px gives baseline offset
    static readonly FontDescender = 4;
    static readonly DoubleFontDescender = 8;
}

export interface IGridLine {
    X1: number;
    Y1: number;
    X2: number;
    Y2: number;
    Css: string;
}

export class SvgBufferTransform {
    readonly Rows: Array<SvgBufferRow>;
    readonly ViewBox: KnockoutComputed<string>;
    readonly Grid: Array<IGridLine>;

    constructor(private readonly buffer: Terminal.Buffer, readonly ShowGrid: KnockoutObservable<boolean>) {
        this.Rows = [...buffer.Rows, buffer.StatusRow].map((row, rowIdx, array) => new SvgBufferRow(array, rowIdx));

        this.ViewBox = ko.computed<string>(() => {
            const width = Terminal.Constants.MaxCols * Constants.CellWidth;
            const height = (Terminal.Constants.MaxRows + 1) * Constants.CellHeight;
            return `0 0 ${width} ${height}`;
        });
        this.Grid = this.getGridLines();
    }

    private getGridLines(): Array<IGridLine> {
        const width = Terminal.Constants.MaxCols * Constants.CellWidth;
        const height = Terminal.Constants.MaxRows * Constants.CellHeight;
        const grid = new Array<IGridLine>();

        for (let colIdx = 0; colIdx <= Terminal.Constants.MaxCols; ++colIdx) {
            const x = colIdx * Constants.CellWidth;
            const is10th = colIdx > 0 && colIdx < Terminal.Constants.MaxCols && (colIdx % 10) == 0;
            grid.push({
                X1: x,
                Y1: 0,
                X2: x,
                Y2: height - 1,
                Css: `gcol ${is10th ? 'gcol-10': ''}`
            });
        }

        for (let rowIdx = 0; rowIdx <= Terminal.Constants.MaxRows; ++rowIdx) {
            const y = rowIdx * Constants.CellHeight;
            const is10th = rowIdx > 0 && rowIdx < Terminal.Constants.MaxRows && (rowIdx % 10) == 0;
            grid.push({
                X1: 0,
                Y1: y,
                X2: width - 1,
                Y2: y,
                Css: `grow ${is10th ? 'grow-10' : ''}`
            });
        }

        return grid;
    }
}

export class SvgBufferRow {
    private readonly myBufferRow: Terminal.Row;
    readonly IsHidden: KnockoutObservable<boolean>;
    readonly Y: KnockoutComputed<number>;
    readonly IsAnyDoubleHeight: KnockoutComputed<boolean>;
    readonly RowHeight: KnockoutComputed<number>;
    readonly Cells: Array<SvgBufferCell>;

    constructor(
        private readonly bufferRows: Array<Terminal.Row>,
        readonly RowIdx: number) {

        this.myBufferRow = this.bufferRows[this.RowIdx];
        this.IsHidden = this.myBufferRow.IsHidden;
        this.Y = ko.computed<number>(() => {
            return this.RowIdx * Constants.CellHeight;
        });  
        this.IsAnyDoubleHeight = ko.computed<boolean>(() => {
            return this.myBufferRow.Cells.some(x => x.IsDoubleHeight());
        });
        this.RowHeight = ko.computed<number>(() => {
            if (this.IsHidden()) {
                return 0;
            }

            return this.IsAnyDoubleHeight() ? Constants.CellDoubleHeight : Constants.CellHeight;
        });
        this.Cells = this.myBufferRow.Cells.map((cell, colIdx) => new SvgBufferCell(this, cell, colIdx));
    }
}

export interface IPosition {
    X: number,
    Y: number
}

export class SvgBufferCell {
    readonly Character: KnockoutObservable<string>;
    readonly FontDescender: KnockoutComputed<number>;
    readonly FontSize: KnockoutComputed<string>;
    readonly Width: KnockoutObservable<number>;
    readonly CellHeight: KnockoutComputed<number>;
    readonly X: KnockoutObservable<number>;
    readonly Y: KnockoutComputed<number>;
    readonly TextX: KnockoutComputed<number>;
    readonly TextY: KnockoutComputed<number>;
    readonly CellCss: KnockoutComputed<string>;
    readonly BgCss: KnockoutComputed<string>;
    readonly FgCss: KnockoutComputed<string>;
    readonly Id: KnockoutComputed<string>;
    readonly Fixes: KnockoutComputed<Array<IPosition>>;

    constructor(
        private readonly row: SvgBufferRow,
        private readonly bufferCell: Terminal.Cell,
        private readonly colIdx: number) {

        this.Character = this.bufferCell.Character;
        this.FontDescender = ko.computed<number>(() => {
            return this.bufferCell.IsDoubleHeight() ? Constants.DoubleFontDescender : Constants.FontDescender;
        });
        this.FontSize = ko.computed<string>(() => {
            return `${this.bufferCell.IsDoubleHeight() ? Constants.CellDoubleHeight : Constants.CellHeight}`;
        });

        this.Width = ko.observable<number>(Constants.CellWidth);
        this.CellHeight = ko.computed<number>(() => {
            if (this.row.IsHidden()) {
                return 0;
            }

            return this.bufferCell.IsDoubleHeight() ? Constants.CellDoubleHeight : Constants.CellHeight;
        });

        this.X = ko.observable<number>(this.colIdx * Constants.CellWidth);
        this.TextX = ko.computed<number>(() => {
            return this.X() - 1;
        });
        this.Y = this.row.Y;
        this.TextY = ko.computed<number>(() => {
            if (!this.row.IsHidden()) {
                return this.Y() + this.CellHeight() - this.FontDescender();
            }

            return 0;
        }); 
        this.CellCss = ko.computed<string>(() => {
            //  Sometimes we get an ascii character with mosaic flags. We don't want to alter the css of these chars to make them contiguous
            const isMosaic = this.bufferCell.IsContiguousMosaic() && Mode7.IsMosaic(this.Character());
            return `svg-viewdata-view-cell ${this.bufferCell.IsFlashing() ? 'blink' : ''} ${this.bufferCell.IsDoubleHeight() ? 'double-height' : ''} ${this.bufferCell.IsConcealed() ? 'concealed' : ''} ${isMosaic ? 'mosaic' : ''}`;
        });
        this.BgCss = ko.computed<string>(() => {
            const bg = this.bufferCell.IsCursor() ? Terminal.Colours[Terminal.Colours.white] : Terminal.Colours[this.bufferCell.Bg()];           
            return `bg-${bg}`;
        });
        this.FgCss = ko.computed<string>(() => {
            const fg = this.bufferCell.IsCursor() ? Terminal.Colours[Terminal.Colours.black] : Terminal.Colours[this.bufferCell.Fg];
            return `fg-${fg}`;
        });

        this.Id = ko.computed<string>(() => {
            return `row-${this.row.RowIdx}-col-${this.colIdx}`;
        });
        this.Fixes = ko.computed<Array<IPosition>>(() => {
            const fixes = new Array<IPosition>();

            if (this.bufferCell.IsContiguousMosaic() && Mode7.IsMosaic(this.Character())) {
                fixes.push({ X: this.TextX(), Y: this.TextY() - 2 });
            }

            return fixes;
        });
    }
}
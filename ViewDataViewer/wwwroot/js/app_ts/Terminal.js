"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaveAsImage = exports.Position = exports.Input = exports.Clock = exports.Cell = exports.Row = exports.Buffer = exports.Constants = exports.ControlKeys = exports.Colours = void 0;
var Mode7 = require("./Mode7.js");
/**
* Colours range 1..7
* n.b. black cannot be explicitly selected but can be used for initialisation
*/
var Colours;
(function (Colours) {
    Colours[Colours["black"] = 0] = "black";
    Colours[Colours["red"] = 1] = "red";
    Colours[Colours["green"] = 2] = "green";
    Colours[Colours["yellow"] = 3] = "yellow";
    Colours[Colours["blue"] = 4] = "blue";
    Colours[Colours["magenta"] = 5] = "magenta";
    Colours[Colours["cyan"] = 6] = "cyan";
    Colours[Colours["white"] = 7] = "white";
})(Colours || (exports.Colours = Colours = {}));
var ControlKeys;
(function (ControlKeys) {
    ControlKeys["Reveal"] = "REVEAL";
    ControlKeys["Advance"] = "ADVANCE";
    ControlKeys["Hold"] = "HOLD";
    ControlKeys["Download"] = "DOWNLOAD";
})(ControlKeys || (exports.ControlKeys = ControlKeys = {}));
var Constants = /** @class */ (function () {
    function Constants() {
    }
    Constants.MaxCols = 40;
    Constants.MaxRows = 24;
    return Constants;
}());
exports.Constants = Constants;
var Buffer = /** @class */ (function () {
    function Buffer() {
        this.Rows = new Array(Constants.MaxRows);
        this.StatusRow = new Row();
        this.Cursor = new Position({ row: 0, col: 0 });
        for (var ridx = 0; ridx < Constants.MaxRows; ++ridx) {
            this.Rows[ridx] = new Row();
        }
        this.CursorOff();
    }
    Buffer.prototype.Reset = function () {
        this.Rows.forEach(function (x) { return x.Reset(); });
        this.CursorOff();
    };
    Buffer.prototype.Row = function (rowIdx) {
        return this.Rows[rowIdx];
    };
    ;
    Buffer.prototype.Cell = function (rowIdx, colIdx) {
        return this.Rows[rowIdx].Cells[colIdx];
    };
    ;
    Buffer.prototype.CellAtPosition = function (position) {
        return this.Rows[position.Row()].Cells[position.Column()];
    };
    ;
    Buffer.prototype.CursorOff = function () {
        this.CellAtPosition(this.Cursor).IsCursor(false);
    };
    ;
    Buffer.prototype.CursorOn = function (row, col) {
        this.Cursor.Row(row);
        this.Cursor.Column(col);
        this.CellAtPosition(this.Cursor).IsCursor(true);
    };
    ;
    Buffer.prototype.ResetCursor = function () {
        this.CursorOff();
        this.Cursor.Row(0);
        this.Cursor.Column(0);
    };
    Buffer.prototype.SetStatusRow = function (text, fg, bg) {
        if (fg === void 0) { fg = Colours.white; }
        if (bg === void 0) { bg = Colours.black; }
        var idx = 0;
        if (text !== null) {
            if (text.length > Constants.MaxCols) {
                text = text.substring(0, Constants.MaxCols);
            }
            for (; idx < text.length; ++idx) {
                var cell = this.StatusRow.Cells[idx];
                var ch = Mode7.FromKeyboard(text[idx]).char;
                cell.Fg = fg;
                cell.Bg(bg);
                cell.Character(ch);
            }
        }
        while (idx < Constants.MaxCols) {
            var cell = this.StatusRow.Cells[idx];
            cell.Fg = fg;
            cell.Bg(bg);
            cell.Character(Mode7.Space);
            ++idx;
        }
    };
    return Buffer;
}());
exports.Buffer = Buffer;
var Row = /** @class */ (function () {
    function Row() {
        this.Cells = new Array(Constants.MaxRows);
        //  True if this row should not be rendered (i.e. double height row 2)
        this.IsHidden = ko.observable(false);
        for (var cidx = 0; cidx < Constants.MaxCols; ++cidx) {
            this.Cells[cidx] = new Cell();
        }
    }
    Row.prototype.Reset = function () {
        this.Cells.forEach(function (x) { return x.Reset(); });
        this.IsHidden(false);
    };
    Row.prototype.SetIsDoubleHeightLowerRow = function () {
        this.IsHidden(true);
    };
    return Row;
}());
exports.Row = Row;
var Cell = /** @class */ (function () {
    function Cell() {
        var _this = this;
        //  Colour index
        this._fg = ko.observable(Colours.white);
        this._cachedFg = Colours.white;
        //  Unicode character
        this.Character = ko.observable(Mode7.Space);
        //  Colour index
        this.Bg = ko.observable(Colours.black);
        //  True if flashing
        this.IsFlashing = ko.observable(false);
        //  When true, the text is only visible when 'reveal' is selected
        this.IsConcealed = ko.observable(false);
        //  When true, this is row 1 of double height text
        this.IsDoubleHeight = ko.observable(false);
        //  True when the cell has the cursor
        this.IsCursor = ko.observable(false);
        //  True when Character is a contiguous mosaic
        this.IsContiguousMosaic = ko.observable(false);
        this.Css = ko.computed(function () {
            var bg = Colours[_this.Bg()];
            var fg = Colours[_this._fg()];
            return "bg-".concat(bg, " fg-").concat(fg, " ").concat(_this.IsFlashing() ? 'blink' : '', " ").concat(_this.IsDoubleHeight() ? 'double-height' : '', " ").concat(_this.IsConcealed() ? 'concealed' : '', " ").concat(_this.IsCursor() ? 'cursor' : '', " ").concat(_this.IsContiguousMosaic() ? 'mosaic' : '');
        });
        Clock.Enlist(function (show) {
            if (!_this.IsFlashing()) {
                return;
            }
            if (show) {
                _this._fg(_this._cachedFg);
            }
            else {
                _this._fg(_this.Bg());
            }
        });
    }
    Object.defineProperty(Cell.prototype, "Fg", {
        get: function () {
            return this._fg();
        },
        set: function (fg) {
            this._fg(fg);
            this._cachedFg = fg;
        },
        enumerable: false,
        configurable: true
    });
    ;
    Cell.prototype.Reset = function () {
        this.Character(Mode7.Space);
        this.Bg(0);
        this.Fg = Colours.white;
        this.IsFlashing(false);
        this.IsConcealed(false);
        this.IsDoubleHeight(false);
        this.IsCursor(false);
        this.IsContiguousMosaic(false);
    };
    Cell.prototype.SetCharacter = function (ch, isContiguousMosaic) {
        if (isContiguousMosaic === void 0) { isContiguousMosaic = false; }
        this.Character(ch);
        this.IsContiguousMosaic(isContiguousMosaic);
    };
    return Cell;
}());
exports.Cell = Cell;
var Clock = /** @class */ (function () {
    function Clock() {
    }
    Clock.Enlist = function (callback) {
        Clock.callbacks.push(callback);
    };
    Clock.Start = function () {
        Clock.show = false;
        Clock.clock = window.setInterval(function () {
            Clock.callbacks.forEach(function (cb) {
                cb(Clock.show);
            });
            Clock.show = !Clock.show;
        }, 1000);
    };
    Clock.Stop = function () {
        if (Clock.clock != 0) {
            window.clearInterval(Clock.clock);
            Clock.clock = 0;
        }
        Clock.callbacks.forEach(function (cb) {
            cb(true);
        });
    };
    Clock.callbacks = new Array();
    Clock.show = false;
    Clock.clock = 0;
    return Clock;
}());
exports.Clock = Clock;
var Input = /** @class */ (function () {
    function Input(onAlt, onChar) {
        var _this = this;
        this.onAlt = onAlt;
        this.onChar = onChar;
        this.OnKeyDown = function (el, event) {
            var oe = event.originalEvent;
            if (oe.altKey) {
                switch (oe.key) {
                    case 'R':
                    case 'r':
                        _this.onAlt(ControlKeys.Reveal);
                        break;
                    case 'A':
                    case 'a':
                        _this.onAlt(ControlKeys.Advance);
                        break;
                    case 'H':
                    case 'h':
                        _this.onAlt(ControlKeys.Hold);
                        break;
                    case 'D':
                    case 'd':
                        _this.onAlt(ControlKeys.Download);
                        break;
                }
                return;
            }
            switch (oe.key) {
                case 'ArrowLeft':
                case 'Left':
                case 'Backspace':
                    _this.onChar('\b');
                    break;
                case 'ArrowRight':
                case 'Right':
                    _this.onChar('\t');
                    break;
                case 'ArrowUp':
                case 'Up':
                    _this.onChar('\v');
                    break;
                case 'ArrowDown':
                case 'Down':
                    _this.onChar('\n');
                    break;
                case 'Delete':
                    _this.onChar(String.fromCharCode(127));
                    break;
                case 'Enter':
                    _this.onChar('_');
                    break;
                case 'Escape':
                    _this.onChar(String.fromCharCode(27));
                    break;
                default:
                    if (oe.key.length == 1) {
                        if (oe.key == '#') {
                            _this.onChar('_');
                        }
                        else {
                            _this.onChar(oe.key);
                        }
                    }
                    break;
            }
        };
    }
    return Input;
}());
exports.Input = Input;
var Position = /** @class */ (function () {
    function Position(data) {
        this.Row = ko.observable(data.row);
        this.Column = ko.observable(data.col);
    }
    return Position;
}());
exports.Position = Position;
function SaveAsImage(buffer, canvas, imgSzX, imgSzY) {
    if (imgSzX === void 0) { imgSzX = 600; }
    if (imgSzY === void 0) { imgSzY = 480; }
    var colours = ['black', 'rgb(255, 0, 0)', 'rgb(0, 255, 0)', 'rgb(255, 255, 0)', 'rgb(0, 0, 255)', 'rgb(255, 0, 255)', 'rgb(0, 255, 255)', 'white'];
    var szX = Math.floor(imgSzX / Constants.MaxCols);
    var szY = Math.floor(imgSzY / Constants.MaxRows);
    var szY2 = szY * 2;
    canvas.height = imgSzY;
    canvas.width = imgSzX;
    var ctx = canvas.getContext('2d');
    ctx.textBaseline = 'bottom';
    var rectY = 0;
    var textY = 0;
    for (var row = 0; row < Constants.MaxRows; ++row) {
        if (buffer.Row(row).IsHidden()) {
            continue;
        }
        var isDoubleHeight = buffer.Row(row).Cells.some(function (x) { return x.IsDoubleHeight(); });
        if (isDoubleHeight) {
            textY += szY2;
            ctx.font = "".concat(szY2, "px bedstead-double-height");
        }
        else {
            textY += szY;
            ctx.font = "".concat(szY, "px bedstead");
        }
        for (var col = 0; col < Constants.MaxCols; ++col) {
            var cell = buffer.Cell(row, col);
            var x = col * szX;
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
        rectY += isDoubleHeight ? szY2 : szY;
    }
    var preamble = 'data:image/png;base64,';
    var data = canvas.toDataURL();
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
exports.SaveAsImage = SaveAsImage;
//# sourceMappingURL=Terminal.js.map
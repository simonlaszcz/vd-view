"use strict";
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SvgBufferCell = exports.SvgBufferRow = exports.SvgBufferTransform = void 0;
var Terminal = require("./Terminal.js");
var Mode7 = require("./Mode7.js");
var Constants = /** @class */ (function () {
    function Constants() {
    }
    //  Bedstead: 1000 units per em, width: 600, descender: 200
    Constants.CellHeight = 20;
    Constants.CellDoubleHeight = 40;
    //  Em unit width would be 12. We use 15 to maintain 4:3 aspect ratio
    Constants.CellWidth = 15;
    //  Height of 'tails' in px gives baseline offset
    Constants.FontDescender = 4;
    Constants.DoubleFontDescender = 8;
    return Constants;
}());
var SvgBufferTransform = /** @class */ (function () {
    function SvgBufferTransform(buffer, ShowGrid) {
        this.buffer = buffer;
        this.ShowGrid = ShowGrid;
        this.Rows = __spreadArray(__spreadArray([], __read(buffer.Rows), false), [buffer.StatusRow], false).map(function (row, rowIdx, array) { return new SvgBufferRow(array, rowIdx); });
        this.ViewBox = ko.computed(function () {
            var width = Terminal.Constants.MaxCols * Constants.CellWidth;
            var height = (Terminal.Constants.MaxRows + 1) * Constants.CellHeight;
            return "0 0 ".concat(width, " ").concat(height);
        });
        this.Grid = this.getGridLines();
    }
    SvgBufferTransform.prototype.getGridLines = function () {
        var width = Terminal.Constants.MaxCols * Constants.CellWidth;
        var height = Terminal.Constants.MaxRows * Constants.CellHeight;
        var grid = new Array();
        for (var colIdx = 0; colIdx <= Terminal.Constants.MaxCols; ++colIdx) {
            var x = colIdx * Constants.CellWidth;
            var is10th = colIdx > 0 && colIdx < Terminal.Constants.MaxCols && (colIdx % 10) == 0;
            grid.push({
                X1: x,
                Y1: 0,
                X2: x,
                Y2: height - 1,
                Css: "gcol ".concat(is10th ? 'gcol-10' : '')
            });
        }
        for (var rowIdx = 0; rowIdx <= Terminal.Constants.MaxRows; ++rowIdx) {
            var y = rowIdx * Constants.CellHeight;
            var is10th = rowIdx > 0 && rowIdx < Terminal.Constants.MaxRows && (rowIdx % 10) == 0;
            grid.push({
                X1: 0,
                Y1: y,
                X2: width - 1,
                Y2: y,
                Css: "grow ".concat(is10th ? 'grow-10' : '')
            });
        }
        return grid;
    };
    return SvgBufferTransform;
}());
exports.SvgBufferTransform = SvgBufferTransform;
var SvgBufferRow = /** @class */ (function () {
    function SvgBufferRow(bufferRows, RowIdx) {
        var _this = this;
        this.bufferRows = bufferRows;
        this.RowIdx = RowIdx;
        this.myBufferRow = this.bufferRows[this.RowIdx];
        this.IsHidden = this.myBufferRow.IsHidden;
        this.Y = ko.computed(function () {
            return _this.RowIdx * Constants.CellHeight;
        });
        this.IsAnyDoubleHeight = ko.computed(function () {
            return _this.myBufferRow.Cells.some(function (x) { return x.IsDoubleHeight(); });
        });
        this.RowHeight = ko.computed(function () {
            if (_this.IsHidden()) {
                return 0;
            }
            return _this.IsAnyDoubleHeight() ? Constants.CellDoubleHeight : Constants.CellHeight;
        });
        this.Cells = this.myBufferRow.Cells.map(function (cell, colIdx) { return new SvgBufferCell(_this, cell, colIdx); });
    }
    return SvgBufferRow;
}());
exports.SvgBufferRow = SvgBufferRow;
var SvgBufferCell = /** @class */ (function () {
    function SvgBufferCell(row, bufferCell, colIdx) {
        var _this = this;
        this.row = row;
        this.bufferCell = bufferCell;
        this.colIdx = colIdx;
        this.Character = this.bufferCell.Character;
        this.FontDescender = ko.computed(function () {
            return _this.bufferCell.IsDoubleHeight() ? Constants.DoubleFontDescender : Constants.FontDescender;
        });
        this.FontSize = ko.computed(function () {
            return "".concat(_this.bufferCell.IsDoubleHeight() ? Constants.CellDoubleHeight : Constants.CellHeight);
        });
        this.Width = ko.observable(Constants.CellWidth);
        this.CellHeight = ko.computed(function () {
            if (_this.row.IsHidden()) {
                return 0;
            }
            return _this.bufferCell.IsDoubleHeight() ? Constants.CellDoubleHeight : Constants.CellHeight;
        });
        this.X = ko.observable(this.colIdx * Constants.CellWidth);
        this.TextX = ko.computed(function () {
            return _this.X() - 1;
        });
        this.Y = this.row.Y;
        this.TextY = ko.computed(function () {
            if (!_this.row.IsHidden()) {
                return _this.Y() + _this.CellHeight() - _this.FontDescender();
            }
            return 0;
        });
        this.CellCss = ko.computed(function () {
            //  Sometimes we get an ascii character with mosaic flags. We don't want to alter the css of these chars to make them contiguous
            var isMosaic = _this.bufferCell.IsContiguousMosaic() && Mode7.IsMosaic(_this.Character());
            return "svg-viewdata-view-cell ".concat(_this.bufferCell.IsFlashing() ? 'blink' : '', " ").concat(_this.bufferCell.IsDoubleHeight() ? 'double-height' : '', " ").concat(_this.bufferCell.IsConcealed() ? 'concealed' : '', " ").concat(isMosaic ? 'mosaic' : '');
        });
        this.BgCss = ko.computed(function () {
            var bg = _this.bufferCell.IsCursor() ? Terminal.Colours[Terminal.Colours.white] : Terminal.Colours[_this.bufferCell.Bg()];
            return "bg-".concat(bg);
        });
        this.FgCss = ko.computed(function () {
            var fg = _this.bufferCell.IsCursor() ? Terminal.Colours[Terminal.Colours.black] : Terminal.Colours[_this.bufferCell.Fg];
            return "fg-".concat(fg);
        });
        this.Id = ko.computed(function () {
            return "row-".concat(_this.row.RowIdx, "-col-").concat(_this.colIdx);
        });
        this.Fixes = ko.computed(function () {
            var fixes = new Array();
            if (_this.bufferCell.IsContiguousMosaic() && Mode7.IsMosaic(_this.Character())) {
                fixes.push({ X: _this.TextX(), Y: _this.TextY() - 2 });
            }
            return fixes;
        });
    }
    return SvgBufferCell;
}());
exports.SvgBufferCell = SvgBufferCell;
//# sourceMappingURL=SvgRenderer.js.map
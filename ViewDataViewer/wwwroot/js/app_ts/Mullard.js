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
exports.SAA5050 = void 0;
var Terminal = require("./Terminal.js");
var Mode7 = require("./Mode7.js");
/**
 * Mullard SAA5050 (kind of)
 * See: http://www.etsi.org/deliver/etsi_en/300700_300799/300706/01.02.01_60/en_300706v010201p.pdf
 */
var SAA5050 = /** @class */ (function () {
    function SAA5050(displayBuffer) {
        var _this = this;
        this.displayBuffer = displayBuffer;
        this.flags = new Flags();
        this.afterFlags = new SetAfterFlags();
        this.bufferRowIdx = 0;
        this.bufferColIdx = 0;
        //  Set when we need to ignore double height row 2 in the input stream
        this.doubleHeightLowerRowIdx = -1;
        this.lastCharacter = null;
        this.frameBufferMax = 2000;
        this.frameBuffer = new Uint8Array(this.frameBufferMax);
        this.frameBufferOffset = 0;
        //  Store the characters written to the first row so we can check for the page number
        this.headerRow = Array(Terminal.Constants.MaxCols);
        //  Expose read only flags
        this.Flags = {
            IsEscaped: ko.computed(function () { return _this.flags.IsEscaped(); }),
            IsContiguous: ko.computed(function () { return _this.flags.IsContiguous(); }),
            IsCursorOn: ko.computed(function () { return _this.flags.IsCursorOn(); }),
            IsDoubleHeight: ko.computed(function () { return _this.flags.IsDoubleHeight(); }),
            IsConcealed: ko.computed(function () { return _this.flags.IsConcealed(); }),
            IsFlashing: ko.computed(function () { return _this.flags.IsFlashing(); }),
            IsAlpha: ko.computed(function () { return _this.flags.IsAlpha(); }),
            IsGraphics: ko.computed(function () { return !_this.flags.IsAlpha(); }),
            AlphaFgColour: ko.computed(function () { return _this.flags.AlphaFgColour(); }),
            MosaicFgColour: ko.computed(function () { return _this.flags.MosaicFgColour(); }),
            BgColour: ko.computed(function () { return _this.flags.BgColour(); }),
            IsMosaicHeld: ko.computed(function () { return _this.flags.IsMosaicHeld(); }),
            HeldMosaic: ko.computed(function () { return _this.flags.IsMosaicHeld() ? _this.flags.HeldMosaic() : null; })
        };
        var foo = new Array();
        foo.fill(0);
        this.headerRow.fill(Mode7.Space);
    }
    SAA5050.prototype.DecodeBase64 = function (b64) {
        var buffer = Uint8Array.from(atob(b64), function (c) { return c.charCodeAt(0); });
        return this.DecodeBytes(buffer);
    };
    SAA5050.prototype.DecodeBytes = function (buffer) {
        //  n.b. After evaluating chars, we 'continue' if it shouldn't be displayed. 'break' if it should
        for (var bufferIdx = 0; bufferIdx < buffer.length && this.bufferRowIdx < Terminal.Constants.MaxRows; ++bufferIdx) {
            var b = buffer[bufferIdx];
            if (this.frameBufferOffset < this.frameBufferMax) {
                this.frameBuffer.set([b], this.frameBufferOffset++);
            }
            //  ASCII control codes (codes < 32)
            //  Rows are either 40 chars long exactly or less than 40 chars and terminated by CRLF or CR or LF
            switch (b) {
                case 0: //  NULL
                    continue;
                case 8: //  Backspace
                    --this.bufferColIdx;
                    if (this.bufferColIdx < 0) {
                        this.bufferColIdx = Terminal.Constants.MaxCols - 1;
                        --this.bufferRowIdx;
                        if (this.bufferRowIdx < 0) {
                            this.bufferRowIdx = Terminal.Constants.MaxRows - 1;
                        }
                    }
                    continue;
                case 9: //  h-tab
                    ++this.bufferColIdx;
                    if (this.bufferColIdx >= Terminal.Constants.MaxCols) {
                        this.bufferColIdx = 0;
                        ++this.bufferRowIdx;
                        if (this.bufferRowIdx >= Terminal.Constants.MaxRows) {
                            this.bufferRowIdx = 0;
                        }
                    }
                    continue;
                case 10: //  LF (end of row)
                    this.nextRow();
                    continue;
                case 11: //  v-tab
                    --this.bufferRowIdx;
                    if (this.bufferRowIdx < 0) {
                        this.bufferRowIdx = Terminal.Constants.MaxRows - 1;
                    }
                    continue;
                case 12:
                    //  FF (new frame/clear screen)
                    this.newFrame();
                    continue;
                case 13: //  CR
                    this.fillEnd();
                    this.bufferColIdx = 0;
                    continue;
                case 17: //  DC1 - cursor on
                    this.flags.IsCursorOn(true);
                    continue;
                case 20: //  DC4 - cursor off
                    this.flags.IsCursorOn(false);
                    this.displayBuffer.CursorOff();
                    continue;
                case 30: //  RS  - back to origin
                    this.fillEnd();
                    this.bufferColIdx = 0;
                    this.bufferRowIdx = 0;
                    continue;
            }
            var rowCode = (b & 15);
            var colCode = (b & 112) >> 4;
            if (this.flags.IsEscaped()) {
                //  we're only interested in the first bit
                colCode &= 1;
                this.flags.IsEscaped(false);
            }
            if (colCode == 0) {
                switch (rowCode) {
                    case 0: //  NUL (alpha black at level 2.5+)
                        break;
                    case 8: //  Flash
                        this.afterFlags.isFlashing = true;
                        break;
                    case 9: //  Steady
                        this.flags.IsFlashing(false);
                        break;
                    case 10: //  end box
                        this.afterFlags.isBoxing = false;
                        break;
                    case 11: //  start box 
                        this.afterFlags.isBoxing = true;
                        break;
                    case 12: //  normal height
                        this.flags.IsDoubleHeight(false);
                        this.flags.HeldMosaic(Mode7.Space);
                        break;
                    case 13: //  double height (but not on last row)
                        if (this.bufferRowIdx < (Terminal.Constants.MaxRows - 2)) {
                            this.afterFlags.isDoubleHeight = true;
                        }
                        break;
                    case 14: //  Shift Out
                        break;
                    case 15: //  Shift In
                        break;
                    default:
                        this.afterFlags.alphaFgColour = rowCode;
                }
            }
            else if (colCode == 1) {
                switch (rowCode) {
                    case 0: //  Data Link Escape (graphics black at level 2.5+)
                        break;
                    case 8: //  conceal display
                        this.flags.IsConcealed(true);
                        break;
                    case 9:
                        this.flags.IsContiguous(true);
                        break;
                    case 10:
                        this.flags.IsContiguous(false);
                        break;
                    case 11: //  escape - do not print
                        this.flags.IsEscaped(true);
                        continue;
                    case 12: //  black bg
                        this.flags.BgColour(0);
                        break;
                    case 13: //  new bg, i.e. use the fg for the bg
                        this.flags.BgColour(this.flags.IsAlpha() ? this.flags.AlphaFgColour() : this.flags.MosaicFgColour());
                        break;
                    case 14: //  hold graphics
                        this.flags.IsMosaicHeld(true);
                        break;
                    case 15: //  release graphics
                        this.afterFlags.isMosaicHeld = false;
                        break;
                    default:
                        this.afterFlags.mosaicFgColour = rowCode;
                }
            }
            if (this.bufferRowIdx != this.doubleHeightLowerRowIdx) {
                var cell = this.displayBuffer.Cell(this.bufferRowIdx, this.bufferColIdx);
                cell.Fg = this.flags.IsAlpha() ? this.flags.AlphaFgColour() : this.flags.MosaicFgColour();
                cell.Bg(this.flags.BgColour());
                cell.IsFlashing(this.flags.IsFlashing());
                cell.IsConcealed(this.flags.IsConcealed());
                cell.IsDoubleHeight(this.flags.IsDoubleHeight());
                if (this.flags.IsDoubleHeight()) {
                    //  Row 2 of double height text has no fg data
                    //  When processing the next row, we need to ensure that we don't overwrite it
                    var cellBelow = this.displayBuffer.Cell(this.doubleHeightLowerRowIdx, this.bufferColIdx);
                    cellBelow.Bg(this.flags.BgColour());
                    cellBelow.IsFlashing(this.flags.IsFlashing());
                    cellBelow.IsConcealed(this.flags.IsConcealed());
                }
                if (colCode == 0 || colCode == 1) {
                    cell.SetCharacter(this.flags.IsMosaicHeld() ? this.flags.HeldMosaic() : Mode7.Space, this.flags.IsMosaicHeld() && this.flags.IsHeldMosaicContiguous());
                    if (this.bufferRowIdx == 0) {
                        this.headerRow[this.bufferColIdx] = Mode7.Space;
                    }
                }
                else {
                    this.lastCharacter = this.getChar(rowCode, colCode);
                    cell.SetCharacter(this.lastCharacter, !this.flags.IsAlpha() && this.flags.IsContiguous());
                    if (!this.flags.IsAlpha()) {
                        this.flags.HeldMosaic(this.lastCharacter);
                        this.flags.IsHeldMosaicContiguous(this.flags.IsContiguous());
                    }
                    if (this.bufferRowIdx == 0) {
                        this.headerRow[this.bufferColIdx] = this.lastCharacter;
                    }
                }
            }
            this.flags.SetAfterFlags(this.afterFlags);
            if (this.afterFlags.isDoubleHeight) {
                this.doubleHeightLowerRowIdx = this.bufferRowIdx + 1;
                this.displayBuffer.Rows[this.doubleHeightLowerRowIdx].SetIsDoubleHeightLowerRow();
            }
            this.afterFlags.Reset();
            ++this.bufferColIdx;
            //  Automatically start a new row if we've got a full row
            if (this.bufferColIdx == Terminal.Constants.MaxCols) {
                this.nextRow();
            }
        }
        //  Move the cursor to the last character displayed
        this.displayBuffer.CursorOff();
        if (this.flags.IsCursorOn()) {
            this.displayBuffer.CursorOn(this.bufferRowIdx, this.bufferColIdx);
        }
        return buffer.length;
    };
    SAA5050.prototype.Reset = function () {
        this.newFrame();
        this.flags.IsCursorOn(false);
        this.displayBuffer.ResetCursor();
    };
    SAA5050.prototype.Load = function (b64) {
        this.Reset();
        this.DecodeBase64(b64);
    };
    SAA5050.prototype.GetFrameAsBase64 = function () {
        return btoa(String.fromCharCode.apply(String, __spreadArray([], __read(this.frameBuffer.slice(0, this.frameBufferOffset)), false)));
    };
    SAA5050.prototype.FrameNumber = function () {
        var text = this.headerRow.join('');
        var matches = text.match(/ P?(\d+)|(\d+[a-z]) /);
        if (matches && matches.length > 1) {
            return matches[1];
        }
        return '0';
    };
    SAA5050.prototype.newFrame = function () {
        this.bufferRowIdx = this.bufferColIdx = 0;
        this.flags.Reset();
        this.afterFlags.Reset();
        this.displayBuffer.Reset();
        this.frameBufferOffset = 0;
        this.doubleHeightLowerRowIdx = -1;
        this.headerRow.fill(Mode7.Space);
    };
    SAA5050.prototype.nextRow = function () {
        if ((this.bufferRowIdx + 1) < Terminal.Constants.MaxRows) {
            ++this.bufferRowIdx;
        }
        else {
            //  Should we wrap around?
            this.bufferRowIdx = 0;
        }
        this.bufferColIdx = 0;
        this.flags.Reset();
        this.afterFlags.Reset();
    };
    SAA5050.prototype.fillEnd = function () {
        if (this.bufferColIdx > 0) {
            var prev = this.displayBuffer.Cell(this.bufferRowIdx, this.bufferColIdx - 1);
            for (var col = this.bufferColIdx; col < Terminal.Constants.MaxCols; ++col) {
                var cell = this.displayBuffer.Cell(this.bufferRowIdx, col);
                cell.Fg = prev.Fg;
                cell.Bg(prev.Bg());
                cell.IsFlashing(prev.IsFlashing());
                cell.IsConcealed(prev.IsConcealed());
                cell.IsDoubleHeight(prev.IsDoubleHeight());
            }
        }
    };
    SAA5050.prototype.getChar = function (rowCode, colCode) {
        return Mode7.ToDisplay(rowCode, colCode, this.flags.IsAlpha(), !this.flags.IsAlpha(), this.flags.IsContiguous()).char;
    };
    return SAA5050;
}());
exports.SAA5050 = SAA5050;
var Flags = /** @class */ (function () {
    function Flags() {
        //  Bg colour. The 'black bg' and 'new bg' commands are Set-At.
        this.BgColour = ko.observable(Terminal.Colours.black);
        //  Alphanumeric (G0 charset) fg colour. Selects alpha characters. Set-After
        this.AlphaFgColour = ko.observable(Terminal.Colours.white);
        //  Graphics/mosaic (G1 charset) fg colour. Selects mosaic characters. Set-After
        this.MosaicFgColour = ko.observable(Terminal.Colours.white);
        //  When true we're rendering alphanumerics, otherwise graphics. Set-After in accordance with fg colours
        this.IsAlpha = ko.observable(true);
        //  When true we're rendering contiguous graphics, otherwise separated. Set-At
        this.IsContiguous = ko.observable(true);
        //  True if flashing. True is Set-After, false (steady) is Set-At
        this.IsFlashing = ko.observable(false);
        //  When true, the next char is a control code. N.b. this is not used to select alternate G0 sets. Esc characters are not displayed as space. Set-After
        this.IsEscaped = ko.observable(false);
        //  True after a start box command. Set-After
        this.IsBoxing = ko.observable(false);
        //  When true, the text is concealed. Set-At
        this.IsConcealed = ko.observable(false);
        //  Hold Mosaics ("Set-At")
        //  Generally, all spacing attributes are displayed as spaces, implying at least one space
        //  between characters or mosaics with different colours in the same row. In mosaics mode, the
        //  "Hold Mosaics" option allows a limited range of attribute changes without intervening
        //  spaces. A mosaic character from the G1 set (referred to as the "Held-Mosaic" character) is
        //  displayed in place of the character "SPACE" corresponding to a control character.
        //  Substitution only takes place in mosaics mode when Hold Mosaics mode is in force. At a
        //  screen location where substitution is permitted, the "Held-Mosaic" character inserted is the
        //  most recent mosaics character with bit 6 = '1' in its code on that row. The "Held-Mosaic"
        //  character is reset to "SPACE" at the start of each row, on a change of
        //  alphanumeric/mosaics mode or on a change of size. It is not reset by reinforcement of the
        //  existing size setting. It is not reset by a change in Hold Mosaics mode.
        //  The "Held-Mosaic" character is always displayed in its original contiguous or separated form
        //  regardless of the mode prevailing at the time of substitution.
        //  Setting False is Set-After
        this.IsMosaicHeld = ko.observable(false);
        this.HeldMosaic = ko.observable(Mode7.Space);
        this.IsHeldMosaicContiguous = ko.observable(false);
        this.IsDoubleHeight = ko.observable(false);
        //  DC1 = on, DC4 = off. Set-At
        this.IsCursorOn = ko.observable(false);
    }
    //  Row reset
    Flags.prototype.Reset = function () {
        this.BgColour(Terminal.Colours.black);
        this.AlphaFgColour(Terminal.Colours.white);
        this.IsAlpha(true);
        this.IsFlashing(false);
        this.IsEscaped(false);
        this.IsBoxing(false);
        this.IsConcealed(false);
        this.IsContiguous(true);
        this.IsMosaicHeld(false);
        this.HeldMosaic(Mode7.Space);
        this.IsHeldMosaicContiguous(false);
        this.IsDoubleHeight(false);
        //  Leave cursor ON
    };
    Flags.prototype.SetAfterFlags = function (pending) {
        var wasAlpha = this.IsAlpha();
        if (pending.alphaFgColour != null) {
            this.AlphaFgColour(pending.alphaFgColour);
            this.IsAlpha(true);
            this.IsConcealed(false);
        }
        else if (pending.mosaicFgColour != null) {
            this.MosaicFgColour(pending.mosaicFgColour);
            this.IsAlpha(false);
            this.IsConcealed(false);
        }
        if (this.IsAlpha() != wasAlpha) {
            this.HeldMosaic(Mode7.Space);
            this.IsHeldMosaicContiguous(false);
        }
        if (pending.isFlashing === true) {
            this.IsFlashing(true);
        }
        if (pending.isBoxing != null) {
            this.IsBoxing(!!pending.isBoxing);
        }
        if (pending.isMosaicHeld === false) {
            this.IsMosaicHeld(false);
            this.IsHeldMosaicContiguous(false);
        }
        if (pending.isDoubleHeight === true) {
            this.IsDoubleHeight(true);
        }
    };
    return Flags;
}());
var SetAfterFlags = /** @class */ (function () {
    function SetAfterFlags() {
        this.alphaFgColour = null;
        this.mosaicFgColour = null;
        this.isFlashing = null;
        this.isBoxing = null;
        this.isMosaicHeld = null;
        this.isDoubleHeight = null;
    }
    SetAfterFlags.prototype.Reset = function () {
        this.alphaFgColour = null;
        this.mosaicFgColour = null;
        this.isFlashing = null;
        this.isBoxing = null;
        this.isMosaicHeld = null;
        this.isDoubleHeight = null;
    };
    return SetAfterFlags;
}());
//# sourceMappingURL=Mullard.js.map
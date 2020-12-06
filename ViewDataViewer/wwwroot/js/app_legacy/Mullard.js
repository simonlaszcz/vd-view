"use strict";

var Mullard = {};

/**
 * Mullard SAA5050
 * Teletext presentation level 1
 * See: http://www.etsi.org/deliver/etsi_en/300700_300799/300706/01.02.01_60/en_300706v010201p.pdf
 */
Mullard.SAA5050 = function (data) {
    data = data || {};
    var me = this;

    _.defaults(data, {
        displayBuffer: null
    });

    var flags = new Mullard.Flags();
    var afterFlags = new Mullard.SetAfterFlags();
    var bufferRowIdx = 0;
    var bufferColIdx = 0;
    //  Set when we need to ignore double height row 2 in the input stream
    var doubleHeightLowerRowIdx = null;
    var lastCharacter = null;
    const frameBufferMax = 2000;
    var frameBuffer = new Uint8Array(frameBufferMax);
    var frameBufferOffset = 0;
    //  Store the characters written to the first row so we can check for the page number
    var headerRow = Array(Terminal.Constants.MaxCols).fill(Mode7.Space);

    me.Decode = function (b64) {
        var buffer = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
       
        //  n.b. After evaluating chars, we 'continue' if it shouldn't be displayed. 'break' if it should
        for (var bufferIdx = 0; bufferIdx < buffer.length && bufferRowIdx < Terminal.Constants.MaxRows; ++bufferIdx) {
            var b = buffer[bufferIdx];

            if (frameBufferOffset < frameBufferMax) {
                frameBuffer.set([b], frameBufferOffset++);
            }

            //  ASCII control codes (codes < 32)
            //  Rows are either 40 chars long exactly or less than 40 chars and terminated by CRLF or CR or LF
            switch (b) {
                case 0:     //  NULL
                    fillEnd();
                    continue;
                case 8:     //  Backspace
                    --bufferColIdx;

                    if (bufferColIdx < 0) {
                        bufferColIdx = Terminal.Constants.MaxCols - 1;
                        --bufferRowIdx;

                        if (bufferRowIdx < 0) {
                            bufferRowIdx = Terminal.Constants.MaxRows - 1;
                        }
                    }
                    continue;
                case 9:     //  h-tab
                    ++bufferColIdx;

                    if (bufferColIdx >= Terminal.Constants.MaxCols) {
                        bufferColIdx = 0;
                        ++bufferRowIdx;

                        if (bufferRowIdx >= Terminal.Constants.MaxRows) {
                            bufferRowIdx = 0;
                        }
                    }
                    continue;
                case 10:    //  LF (end of row)
                    nextRow();
                    continue;
                case 11:    //  v-tab
                    --bufferRowIdx;

                    if (bufferRowIdx < 0) {
                        bufferRowIdx = Terminal.Constants.MaxRows - 1;
                    }
                    continue;
                case 12:
                    //  FF (new frame/clear screen)
                    newFrame();
                    continue;
                case 13:    //  CR
                    fillEnd();
                    bufferColIdx = 0;
                    continue;
                case 17:    //  DC1 - cursor on
                    flags.isCursorOn = true;
                    continue;
                case 20:    //  DC4 - cursor off
                    flags.isCursorOn = false;
                    data.displayBuffer.CursorOff();
                    continue;
                case 30:    //  RS  - back to origin
                    fillEnd();
                    bufferColIdx = 0;
                    bufferRowIdx = 0;
                    continue;
            }

            var rowCode = (b & 0b00001111);
            var colCode = (b & 0b01110000) >> 4;

            if (flags.isEscaped) {
                //  we're only interested in the first bit
                colCode &= 0b001;
                flags.isEscaped = false;
            }            

            if (colCode == 0) {
                switch (rowCode) {
                    case 0: //  NUL (alpha black at level 2.5+)
                        break;
                    case 8: //  Flash
                        afterFlags.isFlashing = true;
                        break;
                    case 9: //  Steady
                        flags.isFlashing = false;
                        break;
                    case 10:    //  end box
                        afterFlags.isBoxing = false;
                        break;
                    case 11:    //  start box 
                        afterFlags.isBoxing = true;
                        break;
                    case 12:    //  normal height
                        flags.isDoubleHeight = false;
                        flags.heldMosaic = Mode7.Space;
                        break;
                    case 13:    //  double height (but not on last row)
                        if (bufferRowIdx < (Terminal.Constants.MaxRows - 2)) {
                            afterFlags.isDoubleHeight = true;
                        }
                        break;
                    case 14:    //  Shift Out
                        break;
                    case 15:    //  Shift In
                        break;
                    default:
                        afterFlags.alphaFgColour = rowCode;
                        afterFlags.isAlpha = true;
                }
            }
            else if (colCode == 1) {
                switch (rowCode) {
                    case 0:     //  Data Link Escape (graphics black at level 2.5+)
                        break;
                    case 8:     //  conceal display
                        flags.isConcealed = true;
                        break;
                    case 9:
                        flags.isContiguous = true;
                        break;
                    case 10:
                        flags.isContiguous = false;
                        break;
                    case 11:    //  escape - do not print
                        flags.isEscaped = true;
                        continue;
                    case 12:    //  black bg
                        flags.bgColour = 0;
                        break;
                    case 13:    //  new bg, i.e. use the fg for the bg
                        flags.bgColour = flags.isAlpha ? flags.alphaFgColour : flags.mosaicFgColour;
                        break;
                    case 14:    //  hold graphics
                        flags.isMosaicHeld = true;
                        break;
                    case 15:    //  release graphics
                        afterFlags.isMosaicHeld = false;
                        break;
                    default:
                        afterFlags.mosaicFgColour = rowCode;
                        afterFlags.isAlpha = false;
                }
            }

            if (bufferRowIdx != doubleHeightLowerRowIdx) {
                var cell = data.displayBuffer.Cell(bufferRowIdx, bufferColIdx);
                cell.Fg(flags.isAlpha ? flags.alphaFgColour : flags.mosaicFgColour);
                cell.Bg(flags.bgColour);
                cell.IsFlashing(flags.isFlashing);
                cell.IsConcealed(flags.isConcealed);
                cell.IsDoubleHeight(flags.isDoubleHeight);

                if (flags.isDoubleHeight) {
                    //  Row 2 of double height text has no fg data
                    //  When processing the next row, we need to ensure that we don't overwrite it
                    var cellBelow = data.displayBuffer.Cell(doubleHeightLowerRowIdx, bufferColIdx);
                    cellBelow.Bg(flags.bgColour);
                    cellBelow.IsFlashing(flags.isFlashing);
                    cellBelow.IsConcealed(flags.isConcealed);
                }

                if (colCode == 0 || colCode == 1) {
                    cell.SetCharacter(flags.isMosaicHeld ? flags.heldMosaic : Mode7.Space, flags.isMosaicHeld && flags.isHeldMosaicContiguous);

                    if (bufferRowIdx == 0) {
                        headerRow[bufferColIdx] = Mode7.Space;
                    }
                }
                else {
                    lastCharacter = getChar(rowCode, colCode);
                    cell.SetCharacter(lastCharacter, !flags.isAlpha && flags.isContiguous);

                    if (!flags.isAlpha) {
                        flags.heldMosaic = lastCharacter;
                        flags.isHeldMosaicContiguous = flags.isContiguous;
                    }

                    if (bufferRowIdx == 0) {
                        headerRow[bufferColIdx] = lastCharacter;
                    }
                }
            }

            flags.SetAfterFlags(afterFlags);

            if (afterFlags.isDoubleHeight) {
                doubleHeightLowerRowIdx = bufferRowIdx + 1;
                data.displayBuffer.Rows[doubleHeightLowerRowIdx].SetIsDoubleHeightLowerRow();
            }

            afterFlags.Reset();            
            ++bufferColIdx;

            //  Automatically start a new row if we've got a full row
            if (bufferColIdx == Terminal.Constants.MaxCols) {
                nextRow();
            }
        }

        //  Move the cursor to the last character displayed
        data.displayBuffer.CursorOff();

        if (flags.isCursorOn) {
            data.displayBuffer.CursorOn(bufferRowIdx, bufferColIdx);
        }

        return buffer.length;
    };

    me.Load = function (b64) {
        newFrame();
        me.Decode(b64);
    };

    me.GetFrameAsBase64 = function () {
        return btoa(String.fromCharCode(...frameBuffer.slice(0, frameBufferOffset)));
    };

    me.FrameNumber = function () {
        const text = headerRow.join('');
        const matches = text.match(/ P?(\d+)|(\d+[a-z]) /);

        if (matches && matches.length > 1) {
            return matches[1];
        }

        return '0';
    };

    function newFrame() {
        bufferRowIdx = bufferColIdx = 0;
        flags.Reset();
        afterFlags.Reset();
        data.displayBuffer.Reset();
        frameBufferOffset = 0;
        doubleHeightLowerRowIdx = null;
        headerRow.fill(Mode7.Space);
    }

    function nextRow() {
        if ((bufferRowIdx + 1) < Terminal.Constants.MaxRows) {
            ++bufferRowIdx;
        }
        else {
            //  Should we wrap around?
            bufferRowIdx = 0;
        }
        
        bufferColIdx = 0;
        flags.Reset();
        afterFlags.Reset();
    }

    function fillEnd() {
        if (bufferColIdx > 0) {
            const prev = data.displayBuffer.Cell(bufferRowIdx, bufferColIdx - 1);

            for (let col = bufferColIdx; col < Terminal.Constants.MaxCols; ++col) {
                const cell = data.displayBuffer.Cell(bufferRowIdx, col);

                cell.Fg(prev.Fg());
                cell.Bg(prev.Bg());
                cell.IsFlashing(prev.IsFlashing());
                cell.IsConcealed(prev.IsConcealed());
                cell.IsDoubleHeight(prev.IsDoubleHeight());   
            }
        }
    }

    function getChar(rowCode, colCode) {
        return Mode7.ToDisplay(rowCode, colCode, flags.isAlpha, !flags.isAlpha, flags.isContiguous).display;
    }
};

Mullard.Flags = function () {
    var me = this;

    //  Bg colour. The 'black bg' and 'new bg' commands are Set-At.
    me.bgColour = 0;
    //  Alphanumeric (G0 charset) fg colour. Selects alpha characters. Set-After
    me.alphaFgColour = 7;
    //  Graphics/mosaic (G1 charset) fg colour. Selects mosaic characters. Set-After
    me.mosaicFgColour = 7;
    //  When true we're rendering alphanumerics, otherwise graphics. Set-After in accordance with fg colours
    me.isAlpha = true;
    //  When true we're rendering contiguous graphics, otherwise separated. Set-At
    me.isContiguous = true;
    //  True if flashing. True is Set-After, false (steady) is Set-At
    me.isFlashing = false;
    //  When true, the next char is a control code. N.b. this is not used to select alternate G0 sets. Esc characters are not displayed as space. Set-After
    me.isEscaped = false;
    //  True after a start box command. Set-After
    me.isBoxing = false;
    //  When true, the text is concealed. Set-At
    me.isConcealed = false;
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
    me.isMosaicHeld = false;
    me.heldMosaic = Mode7.Space;
    me.isHeldMosaicContiguous = false;
    me.isDoubleHeight = false;
    //  DC1 = on, DC4 = off. Set-At
    me.isCursorOn = false;

    //  Row reset
    me.Reset = function () {
        me.bgColour = 0;
        me.alphaFgColour = 7;
        me.isAlpha = true;
        me.isFlashing = false;
        me.isEscaped = false;
        me.isBoxing = false;
        me.isConcealed = false;
        me.isContiguous = true;
        me.isMosaicHeld = false;
        me.heldMosaic = Mode7.Space;
        me.isHeldMosaicContiguous = false;
        me.isDoubleHeight = false;
        //  Leave cursor ON
    };

    me.SetAfterFlags = function (pending) {
        var wasAlpha = me.isAlpha;

        if (pending.alphaFgColour != null) {
            me.alphaFgColour = pending.alphaFgColour;
            me.isAlpha = true;
            me.isConcealed = false;
        }
        else if (pending.mosaicFgColour != null) {
            me.mosaicFgColour = pending.mosaicFgColour;
            me.isAlpha = false;
            me.isConcealed = false;
        }

        if (me.isAlpha != wasAlpha) {
            me.heldMosaic = Mode7.Space;
            me.isHeldMosaicContiguous = false;
        }

        if (pending.isFlashing === true) {
            me.isFlashing = true;
        }

        if (pending.isBoxing != null) {
            me.isBoxing = !!pending.isBoxing;
        }

        if (pending.isMosaicHeld === false) {
            me.isMosaicHeld = false;
            me.isHeldMosaicContiguous = false;
        }

        if (pending.isDoubleHeight === true) {
            me.isDoubleHeight = true;
        }
    };
};

Mullard.SetAfterFlags = function() {
    var me = this;

    me.alphaFgColour = null;
    me.mosaicFgColour = null;
    me.isFlashing = null;
    me.isBoxing = null;
    me.isMosaicHeld = null;
    me.isDoubleHeight = null;

    me.Reset = function () {
        me.alphaFgColour = null;
        me.mosaicFgColour = null;
        me.isFlashing = null;
        me.isBoxing = null;
        me.isMosaicHeld = null;
        me.isDoubleHeight = null;
    };
};
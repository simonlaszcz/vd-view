"use strict";

var Terminal = Terminal || {};

/**
 * Colours range 1..7. We make the array 1-based
 * n.b. black cannot be explicitly selected but can be used for initialisation
 */
Terminal.Colours = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];

Terminal.Constants = {
    get MaxCols() {
        return 40;
    },
    get MaxRows() {
        return 24;
    }
};

Terminal.Cell = function () {
    var me = this;
    var cachedFg = 7;

    //  Unicode character
    me.Character = ko.observable(Mode7.Space);
    //  Colour index
    me.Bg = ko.observable(0);

    //  Colour index
    me._fg = ko.observable(7);
    me._cachedFg = 7;
    //  Setter
    me.Fg = function (fg) {
        if (fg != null) {
            me._fg(fg);
            me._cachedFg = fg;
        }

        return me._fg();
    };

    //  True if flashing
    me.IsFlashing = ko.observable(false);
    //  When true, the text is only visible when 'reveal' is selected
    me.IsConcealed = ko.observable(false);
    //  When true, this is row 1 of double height text
    me.IsDoubleHeight = ko.observable(false);
    //  True when the cell has the cursor
    me.IsCursor = ko.observable(false);
    //  True when Character is a contiguous mosaic
    me.IsContiguousMosaic = ko.observable(false);

    me.Css = ko.computed(function () {
        const bg = Terminal.Colours[me.Bg()];
        const fg = Terminal.Colours[me._fg()];

        return `bg-${bg} fg-${fg} ${me.IsFlashing() ? 'blink' : ''} ${me.IsDoubleHeight() ? 'double-height' : ''} ${me.IsConcealed() ? 'concealed' : ''} ${me.IsCursor() ? 'cursor' : ''} ${me.IsContiguousMosaic() ? 'mosaic' : ''}`;
    });

    me.Reset = function () {
        me.Character(Mode7.Space);
        me.Bg(0);
        me.Fg(7);
        me.IsFlashing(false);
        me.IsConcealed(false);
        me.IsDoubleHeight(false);
        me.IsCursor(false);
        me.IsContiguousMosaic(false);
    };

    me.SetCharacter = function(ch, isContiguousMosaic = false) {
        me.Character(ch);
        me.IsContiguousMosaic(isContiguousMosaic);
    };

    Terminal.Clock.Enlist(function (show) {
        if (!me.IsFlashing()) {
            return;
        }

        if (show) {
            me._fg(me._cachedFg);
        }
        else {
            me._fg(me.Bg());
        }
    });
};

Terminal.Row = function () {
    var me = this;

    me.Cells = new Array(Terminal.Constants.MaxRows);
    //  True if this row should not be rendered (i.e. double height row 2)
    me.IsHidden = ko.observable(false);

    me.Reset = function () {
        for (var cidx = 0; cidx < Terminal.Constants.MaxCols; ++cidx) {
            me.Cells[cidx].Reset();
        }

        me.IsHidden(false);
    };

    me.SetIsDoubleHeightLowerRow = function () {
        me.IsHidden(true);
    };

    for (var cidx = 0; cidx < Terminal.Constants.MaxCols; ++cidx) {
        me.Cells[cidx] = new Terminal.Cell();
    }
};

Terminal.Buffer = function () {
    var me = this;
   
    me.Rows = new Array(Terminal.Constants.MaxRows);
    me.StatusRow = new Terminal.Row();
    me.Cursor = new Terminal.Position({ row: 0, col: 0 });

    me.Reset = function () {
        for (var ridx = 0; ridx < Terminal.Constants.MaxRows; ++ridx) {
            me.Rows[ridx].Reset();
        }

        me.CursorOff();
    };

    me.Row = function (row) {
        return me.Rows[row];
    };

    me.Cell = function (row, col) {
        return me.Rows[row].Cells[col];
    };

    me.Position = function (position) {
        return me.Rows[position.Row()].Cells[position.Column()];
    };

    me.CursorOff = function () {
        me.Position(me.Cursor).IsCursor(false);
    };

    me.CursorOn = function (row, col) {
        me.Cursor.Row(row);
        me.Cursor.Column(col);
        me.Position(me.Cursor).IsCursor(true);
    };

    me.SetStatusRow = function (text, fg = 7, bg = 0) {
        let idx = 0;

        if (text !== null) {
            if (text.length > Terminal.Constants.MaxCols) {
                text = text.substring(0, Terminal.Constants.MaxCols);
            }
            
            for (; idx < text.length; ++idx) {
                let cell = me.StatusRow.Cells[idx];
                let ch = Mode7.FromKeyboard(text[idx]).display;
                cell.Fg(fg);
                cell.Bg(bg);
                cell.Character(ch);
            }
        }

        while (idx < Terminal.Constants.MaxCols) {
            let cell = me.StatusRow.Cells[idx];
            cell.Fg(fg);
            cell.Bg(bg);
            cell.Character(Mode7.Space);
            ++idx;
        }
    };
   
    for (var ridx = 0; ridx < Terminal.Constants.MaxRows; ++ridx) {
        me.Rows[ridx] = new Terminal.Row();
    }

    me.CursorOff();
};

Terminal.Clock = (function () {
    var me = {};

    me.callbacks = [];
    me.show = false;
    
    return {
        Enlist: function (callback) {
            me.callbacks.push(callback);
        },
        Start: function () {
            me.show = false;
            me.clock = window.setInterval(function () {
                me.callbacks.forEach(function (cb) {
                    cb(me.show);
                });

                me.show = !me.show;
            }, 1000);
        },
        Stop: function () {
            window.clearInterval(me.clock);

            me.callbacks.forEach(function (cb) {
                cb(true);
            });
        }
    };
})();

Terminal.SaveAsImage = (function () {
    const colours = ['black', 'rgb(255, 0, 0)', 'rgb(0, 255, 0)', 'rgb(255, 255, 0)', 'rgb(0, 0, 255)', 'rgb(255, 0, 255)', 'rgb(0, 255, 255)', 'white'];

    return function (buffer, canvas, imgSzX = 600, imgSzY = 480) {
        const szX = Math.floor(imgSzX / Terminal.Constants.MaxCols);
        const szY = Math.floor(imgSzY / Terminal.Constants.MaxRows);
        const szY2 = szY * 2;
        canvas.height = imgSzY;
        canvas.width = imgSzX;
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'bottom';
        let rectY = 0;
        let textY = 0;

        for (let row = 0; row < Terminal.Constants.MaxRows; ++row) {
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

            for (let col = 0; col < Terminal.Constants.MaxCols; ++col) {
                const cell = buffer.Cell(row, col);
                const x = col * szX;

                //  Bg rectangle: top left origin
                ctx.fillStyle = colours[cell.Bg()];
                ctx.fillRect(x, rectY, szX, isDoubleHeight ? szY2 : szY);

                //  Fg char: bottom left origin
                ctx.fillStyle = colours[cell.Fg()];
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

        if (data.startsWith(preamble)) {
            data = data.substring(preamble.length);
        }
            
        return {
            mime: 'image/png',
            b64: data,
            size: 4 * Math.ceil(data.length / 3),
            extension: '.png'
        };
    };
})();

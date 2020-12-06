"use strict";

var Terminal = Terminal || {};

Terminal.ControlKeys = {
    get Reveal() {
        return 'REVEAL';
    },
    get Advance() {
        return 'ADVANCE';
    },
    get Hold() {
        return 'HOLD';
    },
    get Download() {
        return 'DOWNLOAD';
    }
};

Terminal.Input = function (data) {
    data = data || {};
    var me = this;

    _.defaults(data, {
        onChar: function (char) { },
        onAlt: function (char) { }
    });

    me.OnKeyDown = function (el, event) {
        var oe = event.originalEvent;

        if (oe.altKey) {
            switch (oe.key) {
                case 'R':
                case 'r':
                    data.onAlt(Terminal.ControlKeys.Reveal);
                    break;
                case 'A':
                case 'a':
                    data.onAlt(Terminal.ControlKeys.Advance);
                    break;
                case 'H':
                case 'h':
                    data.onAlt(Terminal.ControlKeys.Hold);
                    break;
                case 'D':
                case 'd':
                    data.onAlt(Terminal.ControlKeys.Download);
                    break;
            }

            return;
        }

        switch (oe.key) {
            case 'ArrowLeft':
            case 'Left':
            case 'Backspace':
                data.onChar('\b');
                break;
            case 'ArrowRight':
            case 'Right':
                data.onChar('\t');
                break;
            case 'ArrowUp':
            case 'Up':
                data.onChar('\v');
                break;
            case 'ArrowDown':
            case 'Down':
                data.onChar('\n');
                break;
            case 'Delete':
                data.onChar(String.fromCharCode(127));
                break;
            case 'Enter':
                data.onChar('_');
                break;
            case 'Escape':
                data.onChar(String.fromCharCode(27));
                break;
            default:
                if (oe.key.length == 1) {
                    if (oe.key == '#') {
                        data.onChar('_');
                    }
                    else {
                        data.onChar(oe.key);
                    }
                }
                break;
        }
    }
};
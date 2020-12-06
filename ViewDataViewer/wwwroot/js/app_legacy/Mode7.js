"use strict";

let Mode7 = {
    get Space() {
        return ' ';
    }
};

/**
 * Map Teletext codes to display characters and codes
 * See: http://www.etsi.org/deliver/etsi_en/300700_300799/300706/01.02.01_60/en_300706v010201p.pdf
 * Latin G0/G1 primary set. Decoder level 1 with English character options
 */
Mode7.ToDisplay = function (rowCode, colCode, isAlpha, isGraph, isContiguous) {
    function map() {
        if (rowCode < 0 || rowCode > 15 || colCode < 0 || colCode > 7) {
            //  Return space
            return 0x20;
        }

        if (colCode == 2 && !!isAlpha) {
            switch (rowCode) {
                case 3: return 0xA3;
                default: return 0x20 + rowCode;
            }
        }
        else if (colCode == 2 && !!isGraph) {
            return (!!isContiguous ? 0xEE00 : 0xEE20) + rowCode;
        }
        else if (colCode == 3 && !!isAlpha) {
            return 0x30 + rowCode;
        }
        else if (colCode == 3 && !!isGraph) {
            return (!!isContiguous ? 0xEE10 : 0xEE30) + rowCode;
        }
        else if (colCode == 4) {
            return 0x40 + rowCode;
        }
        else if (colCode == 5) {
            switch (rowCode) {
                case 11: return 0x2190;
                case 12: return 0xBD;
                case 13: return 0x2192;
                case 14: return 0x2191;
                case 15: return 0x23;
                default: return 0x50 + rowCode;
            }
        }
        else if (colCode == 6 && !!isAlpha) {
            switch (rowCode) {
                case 0: return 0x2013;
                default: return 0x60 + rowCode;
            }
        }
        else if (colCode == 6 && !!isGraph) {
            return (!!isContiguous ? 0xEE40 : 0xEE60) + rowCode;
        }
        else if (colCode == 7 && !!isAlpha) {
            switch (rowCode) {
                case 11: return 0xBC;
                case 12: return 0x2016;
                case 13: return 0xBE;
                case 14: return 0xF7;
                case 15: return 0x25A0;
                default: return 0x70 + rowCode;
            }
        }
        else if (colCode == 7 && !!isGraph) {
            return (!!isContiguous ? 0xEE50 : 0xEE70) + rowCode;
        }

        return 0x20;
    }

    const code = map();

    return {
        code: code,
        display: String.fromCharCode(code)
    };
};

/**
 * Convert keyboard input to a teletext char
 */
Mode7.FromKeyboard = function (char) {
    char = char || Mode7.Space;

    var code = char.charCodeAt(0);
    var rowCode = 0;
    var colCode = 0;

    switch (code) {
        //  Pick off special chars that don't fit into unicode ranges
        case 0xA3:
            colCode = 2;
            rowCode = 3;
            break;
        case 0x2190: 
            colCode = 5;
            rowCode = 11;
            break;
        case 0xBD: 
            colCode = 5;
            rowCode = 12;
            break;
        case 0x2192: 
            colCode = 5;
            rowCode = 13;
            break;
        case 0x2191: 
            colCode = 5;
            rowCode = 14;
            break;
        case 0x23: 
            colCode = 5;
            rowCode = 15;
            break;
        case 0x2013:
            colCode = 6;
            rowCode = 0;
            break;
        case 0xBC:
            colCode = 7;
            rowCode = 11;
            break;
        case 0x2016:
            colCode = 7;
            rowCode = 12;
            break;
        case 0xBE:
            colCode = 7;
            rowCode = 13;
            break;
        case 0xF7:
            colCode = 7;
            rowCode = 14;
            break;
        case 0x25A0:
            colCode = 7;
            rowCode = 15;
            break;
        default:
            if (code >= 0x20 && code < 0x30) {
                colCode = 2;
                rowCode = code - 0x20;
            }
            else if (code >= 0xEE00 && code < 0xEE10) {
                colCode = 2;
                rowCode = code - 0xEE00;
            }
            else if (code >= 0xEE20 && code < 0xEE30) {
                colCode = 2;
                rowCode = code - 0xEE20;
            }
            else if (code >= 0x30 && code < 0x40) {
                colCode = 3;
                rowCode = code - 0x30;
            }
            else if (code >= 0xEE10 && code < 0xEE20) {
                colCode = 3;
                rowCode = code - 0xEE10;
            }
            else if (code >= 0xEE30 && code < 0xEE40) {
                colCode = 3;
                rowCode = code - 0xEE30;
            }
            else if (code >= 0x40 && code < 0x50) {
                colCode = 4;
                rowCode = code - 0x40;
            }
            else if (code >= 0x50 && code < 0x60) {
                colCode = 5;
                rowCode = code - 0x50;
            }
            else if (code >= 0x60 && code < 0x70) {
                colCode = 6;
                rowCode = code - 0x60;
            }
            else if (code >= 0xEE40 && code < 0xEE50) {
                colCode = 6;
                rowCode = code - 0xEE40;
            }
            else if (code >= 0xEE60 && code < 0xEE70) {
                colCode = 6;
                rowCode = code - 0xEE60;
            }
            else if (code >= 0x70 && code < 0x80) {
                colCode = 7;
                rowCode = code - 0x70;
            }
            else if (code >= 0xEE50 && code < 0xEE60) {
                colCode = 7;
                rowCode = code - 0xEE50;
            }
            else if (code >= 0xEE70 && code < 0xEE80) {
                colCode = 7;
                rowCode = code - 0xEE70;
            }
            else {
                //  Space
                colCode = 2;
                rowCode = 0;
            }
            break;
    }
    
    return {
        colCode: colCode,
        rowCode: rowCode,
        code: ((colCode << 4) + rowCode) & 0b01111111,
        display: Mode7.ToDisplay(rowCode, colCode, true, false, false).display
    };
};

/**
 * Create a Mode7 display string from keyboard input
 */
Mode7.FromKeyboardToDisplayString = function (text) {
    var chars = [...(String(text || ''))].map(Mode7.FromKeyboard).map(function (u) {
        return u.display;
    });

    return chars.join('');
};

/**
 * Create a Teletext coded string from keyboard input. Do not alter control codes < 32
 */
Mode7.FromKeyboardString = function (text) {
    var chars = [...(String(text || ''))].map(function (char) {
        var code = char.charCodeAt(0);

        if (code < 32) {
            return char;
        }
        else {
            return String.fromCharCode(Mode7.FromKeyboard(char).code);
        }
    });

    return chars.join('');
};
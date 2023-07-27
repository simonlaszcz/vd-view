"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Downloads = void 0;
var OutputBuffer = /** @class */ (function () {
    function OutputBuffer() {
        this.buffer = new Array();
    }
    OutputBuffer.prototype.Reset = function () {
        this.buffer.length = 0;
    };
    OutputBuffer.prototype.Write = function (b) {
        this.buffer.push(String.fromCharCode(b));
    };
    OutputBuffer.prototype.Length = function () {
        return this.buffer.length;
    };
    OutputBuffer.prototype.GetBase64 = function () {
        return btoa(this.buffer.join(''));
    };
    return OutputBuffer;
}());
var Downloads = /** @class */ (function () {
    function Downloads(onError, onEndOfFrame, onEndOfFile) {
        this.onError = onError;
        this.onEndOfFrame = onEndOfFrame;
        this.onEndOfFile = onEndOfFile;
        this.threeQuarters = 125;
        this.space = 32;
        this.bar = 124;
        this.outputBuffer = new OutputBuffer();
        this.state = 0;
        this.frameNumber = 0;
        //  xor of bytes in frame between |A and |Z
        this.runningChecksum = 0;
        //  the expected checksum
        this.checksum = 0;
        //  a..z
        this.frameLetter = null;
        //  Added to the byte code when writing to the file buffer
        this.shiftOffset = 0;
        //  Current control code
        this.controlCode = null;
        //  True until |I is found. Do not write chars to file but they may require special processing
        //  Allows us to ignore control data that we're not interested in
        this.ignore = false;
        //  True between |A and |Z. False for row 1 and 24
        this.inFrame = false;
        this.filename = '';
    }
    Downloads.prototype.Reset = function () {
        this.outputBuffer.Reset();
        this.state = 0;
        this.frameNumber = 0;
        this.runningChecksum = 0;
        this.checksum = 0;
        this.frameLetter = null;
        this.shiftOffset = 0;
        this.controlCode = null;
        this.ignore = false;
        this.inFrame = false;
        this.filename = '';
    };
    Downloads.prototype.TryDecodeHeaderFrame = function (b64) {
        this.Decode(b64, false);
        //  If we have a filename and the frame number is 1, then we assume that we have correctly decoded a header
        //  If we return true, the caller can proceed with the download by sending the name frame/packet
        //  If false, the caller should send the next packet and test again
        return this.frameNumber === 1 && !!this.filename;
    };
    Downloads.prototype.Decode = function (b64, invokeCallbacks, checkParity) {
        if (invokeCallbacks === void 0) { invokeCallbacks = true; }
        if (checkParity === void 0) { checkParity = false; }
        var buffer = Uint8Array.from(atob(b64), function (c) { return c.charCodeAt(0); });
        for (var bufferIdx = 0; bufferIdx < buffer.length; ++bufferIdx) {
            var b = buffer[bufferIdx];
            if (checkParity && this.inFrame && this.parity(b) !== (b >> 7)) {
                this.onError("parity error in frame ".concat(this.frameNumber));
            }
            //  Discard parity bit
            b &= 127;
            if (b == this.bar) {
                //  Next char will be a control code
                this.state = 1;
                continue;
            }
            //  Char equivalent
            var ch = String.fromCharCode(b);
            if (this.inFrame && this.state === 0) {
                this.runningChecksum ^= b;
                if (!this.ignore) {
                    //  The first frame is the header
                    if (this.frameNumber === 1) {
                        if (this.controlCode === 'I') {
                            this.filename += ch;
                        }
                    }
                    else {
                        if (b == this.threeQuarters) {
                            this.outputBuffer.Write(this.space + this.shiftOffset);
                        }
                        else {
                            this.outputBuffer.Write(b + this.shiftOffset);
                        }
                    }
                }
            }
            else if (this.state >= 1) {
                if (this.state === 1) {
                    this.controlCode = ch;
                    if (this.controlCode !== 'A' && this.controlCode !== 'Z') {
                        this.runningChecksum ^= 124;
                        this.runningChecksum ^= b;
                    }
                }
                switch (this.controlCode) {
                    case '0':
                        this.shiftOffset = 0;
                        this.state = 0;
                        continue;
                    case '1':
                        this.shiftOffset = -64;
                        this.state = 0;
                        continue;
                    case '2':
                        this.shiftOffset = 64;
                        this.state = 0;
                        continue;
                    case '3':
                        this.shiftOffset = 96;
                        this.state = 0;
                        continue;
                    case '4':
                        this.shiftOffset = 128;
                        this.state = 0;
                        continue;
                    case '5':
                        this.shiftOffset = 160;
                        this.state = 0;
                        continue;
                    case String.fromCharCode(this.threeQuarters): //  3/4
                        this.outputBuffer.Write(this.threeQuarters + this.shiftOffset);
                        this.state = 0;
                        continue;
                    case 'A': // start frame
                        ++this.frameNumber;
                        this.runningChecksum = 0;
                        this.state = 0;
                        this.inFrame = true;
                        continue;
                    case 'D': // start of data section
                        this.state = 0;
                        continue;
                    case 'E': // bar char
                        this.outputBuffer.Write(this.bar + this.shiftOffset);
                        this.state = 0;
                        continue;
                    case 'F': // end of file
                        if (invokeCallbacks && this.onEndOfFile) {
                            this.onEndOfFile(this.filename, this.outputBuffer.Length());
                        }
                        this.state = 0;
                        this.inFrame = false;
                        continue;
                    case 'G': // frame letter
                        switch (this.state) {
                            case 1:
                                ++this.state;
                                break;
                            case 2:
                                this.runningChecksum ^= b;
                                this.frameLetter = String.fromCharCode(b);
                                this.state = 0;
                                //  We may now get the data block number (0..9) and the number of the last data block in the frame but we ignore them
                                this.ignore = true;
                                break;
                        }
                        continue;
                    case 'I': // escape sequence terminator
                        this.ignore = false;
                        this.state = 0;
                        continue;
                    case 'L': // end of line
                        this.state = 0;
                        //  Ignore frame count in the header
                        if (this.frameNumber === 1) {
                            this.ignore = true;
                        }
                        else {
                            this.outputBuffer.Write(13);
                        }
                        continue;
                    case 'T': // start of header section
                        this.state = 0;
                        continue;
                    case 'Z': // end of frame
                        //  The next 3 bytes after Z store the expected checksum
                        switch (this.state) {
                            case 1:
                                this.checksum = 0;
                                ++this.state;
                                this.inFrame = false;
                                break;
                            case 2:
                                this.checksum += (b - 48) * 100;
                                ++this.state;
                                break;
                            case 3:
                                this.checksum += (b - 48) * 10;
                                ++this.state;
                                break;
                            case 4:
                                this.checksum += b - 48;
                                if (this.checksum !== this.runningChecksum) {
                                    this.onError("invalid frame checksum at frame ".concat(this.frameNumber, " (expected ").concat(this.checksum, ", got ").concat(this.runningChecksum, ")"));
                                }
                                this.state = 0;
                                if (invokeCallbacks && this.onEndOfFrame) {
                                    //  The terminal must now send '#' or '0' if this frame was 'z'
                                    this.onEndOfFrame(this.frameLetter || '');
                                }
                                break;
                        }
                        continue;
                    default:
                        //  Unrecognized. Ignore everything until |I is found
                        this.ignore = true;
                        this.state = 0;
                        continue;
                }
            }
        }
        return buffer.length;
    };
    Downloads.prototype.GetBase64 = function () {
        return this.outputBuffer.GetBase64();
    };
    Downloads.prototype.parity = function (v) {
        var count = (v & 1) + (v >> 1 & 1) + (v >> 2 & 1) + (v >> 3 & 1) + (v >> 4 & 1) + (v >> 5 & 1) + (v >> 6 & 1);
        return count % 2;
    };
    return Downloads;
}());
exports.Downloads = Downloads;
//# sourceMappingURL=Telesoft.js.map
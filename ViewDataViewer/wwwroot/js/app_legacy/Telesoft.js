"use strict";

let Telesoft = {};

Telesoft.OutputBuffer = function() {
    const me = this;
    let buffer = [];

    me.Reset = function() {
        buffer.length = 0;
    };

    me.Write = function(b) {
        buffer.push(String.fromCharCode(b));
    };

    me.Length = function() {
        return buffer.length;
    };

    me.GetBase64 = function () {
        return btoa(buffer.join(''));
    };
}

Telesoft.Downloads = function (options) {
    const me = this;
    const threeQuarters = 0b1111101;
    const space = 0b0100000;
    const bar = 0b1111100;
    const onEndOfFrame = options.onEndOfFrame;
    const onEndOfFile = options.onEndOfFile;
    const onError = options.onError;
    const outputBuffer = new Telesoft.OutputBuffer();
    let state = 0;
    let frameNumber = 0;
    //  xor of bytes in frame between |A and |Z
    let runningChecksum = 0;
    //  the expected checksum
    let checksum = 0;
    //  a..z
    let frameLetter = null;
    //  Added to the byte code when writing to the file buffer
    let shiftOffset = 0;
    //  Current control code
    let controlCode = null;
    //  True until |I is found. Do not write chars to file but they may require special processing
    //  Allows us to ignore control data that we're not interested in
    let ignore = false;
    //  True between |A and |Z. False for row 1 and 24
    let inFrame = false;
    let filename = '';

    me.Reset = function () {
        outputBuffer.Reset();
        state = 0;
        frameNumber = 0;
        runningChecksum = 0;
        checksum = 0;
        frameLetter = null;
        shiftOffset = 0;
        controlCode = null;
        ignore = false;
        inFrame = false;
        filename = '';
    };

    me.TryDecodeHeaderFrame = function (b64) {
        me.Decode(b64, false);

        //  If we have a filename and the frame number is 1, then we assume that we have correctly decoded a header
        //  If we return true, the caller can proceed with the download by sending the name frame/packet
        //  If false, the caller should send the next packet and test again
        return frameNumber === 1 && !!filename;
    };

    me.Decode = function (b64, invokeCallbacks = true) {
        const buffer = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
       
        for (var bufferIdx = 0; bufferIdx < buffer.length; ++bufferIdx) {
            let b = buffer[bufferIdx];

            //if (inFrame && parity(b) !== (b >> 7)) {
            //    onError(`parity error in frame ${frameNumber}`);
            //}

            //  Discard parity bit
            b &= 0b01111111;

            if (b == bar) {
                //  Next char will be a control code
                state = 1;
                continue;
            }

            //  Char equivalent
            let ch = String.fromCharCode(b);

            if (inFrame && state === 0) {
                runningChecksum ^= b;

                if (!ignore) {
                    //  The first frame is the header
                    if (frameNumber === 1) {
                        if (controlCode === 'I') {
                            filename += ch;
                        }
                    }
                    else {
                        if (b == threeQuarters) {
                            outputBuffer.Write(space + shiftOffset);
                        }
                        else {
                            outputBuffer.Write(b + shiftOffset);
                        }
                    }
                }
            }
            else if (state >= 1) {
                if (state === 1) {
                    controlCode = ch;

                    if (controlCode !== 'A' && controlCode !== 'Z') {
                        runningChecksum ^= 124;
                        runningChecksum ^= b;
                    }
                }

                switch (controlCode) {
                    case '0':
                        shiftOffset = 0;
                        state = 0;
                        continue;
                    case '1':
                        shiftOffset = -64;
                        state = 0;
                        continue;
                    case '2':
                        shiftOffset = 64;
                        state = 0;
                        continue;
                    case '3':
                        shiftOffset = 96;
                        state = 0;
                        continue;
                    case '4':
                        shiftOffset = 128;
                        state = 0;
                        continue;
                    case '5':
                        shiftOffset = 160;
                        state = 0;
                        continue;
                    case String.fromCharCode(threeQuarters):   //  3/4
                        outputBuffer.Write(threeQuarters + shiftOffset);
                        state = 0;
                        continue;
                    case 'A':   // start frame
                        ++frameNumber;
                        runningChecksum = 0;
                        state = 0;
                        inFrame = true;
                        continue;
                    case 'D':   // start of data section
                        state = 0;
                        continue;
                    case 'E':   // bar char
                        outputBuffer.Write(bar + shiftOffset);
                        state = 0;
                        continue;
                    case 'F':   // end of file
                        if (invokeCallbacks) {
                            onEndOfFile({
                                filename,
                                size: outputBuffer.Length()
                            });
                        }
                        state = 0;
                        inFrame = false;
                        continue;
                    case 'G':   // frame letter
                        switch (state) {
                            case 1:
                                ++state;
                                break;
                            case 2:
                                runningChecksum ^= b;
                                frameLetter = String.fromCharCode(b);
                                state = 0;
                                //  We may now get the data block number (0..9) and the number of the last data block in the frame but we ignore them
                                ignore = true;
                                break;
                        }
                        continue;
                    case 'I':   // escape sequence terminator
                        ignore = false;
                        state = 0;
                        continue;
                    case 'L':   // end of line
                        state = 0;

                        //  Ignore frame count in the header
                        if (frameNumber === 1) {
                            ignore = true;
                        }
                        else {
                            outputBuffer.Write(13);
                        }
                        continue;
                    case 'T':   // start of header section
                        state = 0;
                        continue;
                    case 'Z':   // end of frame
                        //  The next 3 bytes after Z store the expected checksum
                        switch (state) {
                            case 1:
                                checksum = 0;
                                ++state;
                                inFrame = false;
                                break;
                            case 2:
                                checksum += (b - 48) * 100;
                                ++state;
                                break;
                            case 3:
                                checksum += (b - 48) * 10;
                                ++state;
                                break;
                            case 4:
                                checksum += b - 48;

                                if (checksum !== runningChecksum) {
                                    onError(`invalid frame checksum at frame ${frameNumber} (expected ${checksum}, got ${runningChecksum})`);
                                }

                                state = 0;

                                if (invokeCallbacks) {
                                    //  The terminal must now send '#' or '0' if this frame was 'z'
                                    onEndOfFrame(frameLetter);
                                }
                                break;
                        }
                        continue;
                    default:
                        //  Unrecognized. Ignore everything until |I is found
                        ignore = true;
                        state = 0;
                        continue;
                }
            }            
        }

        return buffer.length;
    };

    me.GetBase64 = function () {
        return outputBuffer.GetBase64();
    };

    function parity(v) {
        let count = (v & 1) + (v >> 1 & 1) + (v >> 2 & 1) + (v >> 3 & 1) + (v >> 4 & 1) + (v >> 5 & 1) + (v >> 6 & 1);

        return count % 2;
    }
};
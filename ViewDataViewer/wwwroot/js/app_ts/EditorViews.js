"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Main = exports.ViewDataView = exports.ExoticCharacters = void 0;
var Mullard = require("./Mullard.js");
var Terminal = require("./Terminal.js");
var Storage = require("./Storage.js");
var Mode7 = require("./Mode7.js");
var Logger = require("./Logger.js");
var SVG = require("./SvgRenderer.js");
var ExoticCharacters = /** @class */ (function () {
    function ExoticCharacters(isContiguous, isAlpha, isGraphics) {
        var _this = this;
        this.isContiguous = isContiguous;
        this.isAlpha = isAlpha;
        this.isGraphics = isGraphics;
        var rows = Array.from(Array(16).keys());
        this.Column2 = rows.map(function (n) { return ko.computed(function () {
            return Mode7.ToDisplay(n, 2, _this.isAlpha(), _this.isGraphics(), _this.isContiguous());
        }); });
        this.Column3 = rows.map(function (n) { return ko.computed(function () {
            return Mode7.ToDisplay(n, 3, _this.isAlpha(), _this.isGraphics(), _this.isContiguous());
        }); });
        this.Column4 = rows.map(function (n) { return ko.computed(function () {
            return Mode7.ToDisplay(n, 4, _this.isAlpha(), _this.isGraphics(), _this.isContiguous());
        }); });
        this.Column5 = rows.map(function (n) { return ko.computed(function () {
            return Mode7.ToDisplay(n, 5, _this.isAlpha(), _this.isGraphics(), _this.isContiguous());
        }); });
        this.Column6 = rows.map(function (n) { return ko.computed(function () {
            return Mode7.ToDisplay(n, 6, _this.isAlpha(), _this.isGraphics(), _this.isContiguous());
        }); });
        this.Column7 = rows.map(function (n) { return ko.computed(function () {
            return Mode7.ToDisplay(n, 7, _this.isAlpha(), _this.isGraphics(), _this.isContiguous());
        }); });
    }
    return ExoticCharacters;
}());
exports.ExoticCharacters = ExoticCharacters;
var ViewDataView = /** @class */ (function () {
    function ViewDataView() {
        var _this = this;
        this.Buffer = new Terminal.Buffer();
        this.IsRevealed = ko.observable(false);
        this.ShowGrid = ko.observable(false);
        this.EnableFlash = ko.observable(false);
        this.Decoder = new Mullard.SAA5050(this.Buffer);
        this.Constants = Terminal.Constants;
        this.SVG = new SVG.SvgBufferTransform(this.Buffer, this.ShowGrid);
        this.Flags = this.Decoder.Flags;
        this.ExoticCharacters = new ExoticCharacters(this.Flags.IsContiguous, this.Flags.IsAlpha, this.Flags.IsGraphics);
        this.BgCss = ko.computed(function () {
            return "bg-".concat(Terminal.Colours[_this.Flags.BgColour()]);
        });
    }
    return ViewDataView;
}());
exports.ViewDataView = ViewDataView;
var UndoStackItemType;
(function (UndoStackItemType) {
    UndoStackItemType[UndoStackItemType["Base64"] = 0] = "Base64";
    UndoStackItemType[UndoStackItemType["Bytes"] = 1] = "Bytes";
})(UndoStackItemType || (UndoStackItemType = {}));
var Main = /** @class */ (function () {
    function Main() {
        var _this = this;
        this.defaultHeader = "Viewdata Editor";
        this.downloadsElement = document.getElementById('downloads');
        this.maxUndos = 10;
        this.Header = ko.observable(this.defaultHeader);
        this.IsViewFocused = ko.observable(true);
        this.Input = ko.observable();
        this.Downloads = ko.observableArray();
        this.SavedFrames = ko.observableArray();
        this.Log = new Logger.Log();
        this.View = new ViewDataView();
        this.Storage = new Storage.Storage();
        this.AutoEscape = ko.observable(false);
        this.UndoStack = new Array();
        this.UndoStackSize = ko.observable(0);
        this.Keyboard = new Terminal.Input(function (code) {
            switch (code) {
                case Terminal.ControlKeys.Reveal:
                    _this.ToggleReveal();
                    break;
            }
        }, function (text) {
            _this.SendText(text);
        });
        this.Status = {
            success: function (text) {
                _this.View.Buffer.SetStatusRow(text, 2, 0);
            },
            info: function (text) {
                _this.View.Buffer.SetStatusRow(text, 7, 0);
            },
            error: function (text) {
                _this.View.Buffer.SetStatusRow(text, 1, 0);
            },
            unexpected: function () {
                _this.View.Buffer.SetStatusRow('An error occurred', 1, 0);
            },
            warning: function (text) {
                _this.View.Buffer.SetStatusRow(text, 3, 0);
            },
            clear: function () {
                _this.View.Buffer.SetStatusRow(null, 0, 0);
            }
        };
        this.OnKeyDown = function (el, event) {
            return true;
        };
        this.ToggleReveal = _.throttle(function () {
            _this.IsViewFocused(true);
            _this.View.IsRevealed(!_this.View.IsRevealed());
        }, 1000);
        this.SendCode = function (code, escapable) {
            if (code < 128) {
                code += 128;
            }
            _this.IsViewFocused(true);
            _this.Status.clear();
            var codes = new Array();
            if (_this.AutoEscape() && escapable) {
                codes.push(155);
            }
            codes.push(code);
            _this.pushUndo();
            _this.View.Decoder.DecodeBytes(new Uint8Array(codes));
        };
        this.SendControl = function (code) {
            _this.IsViewFocused(true);
            _this.Status.clear();
            _this.pushUndo();
            _this.View.Decoder.DecodeBytes(new Uint8Array([code]));
        };
        this.SendText = function (text) {
            _this.IsViewFocused(true);
            _this.Status.clear();
            _this.pushUndo();
            _this.View.Decoder.DecodeBase64(btoa(text));
        };
        this.SendBase64 = function (b64) {
            _this.IsViewFocused(true);
            _this.Status.clear();
            _this.View.Decoder.Load(b64);
            _this.UndoStack.length = 0;
        };
        this.RemoveDownload = _.throttle(function (idx) {
            _this.IsViewFocused(true);
            _this.Storage.RemoveDownloadAt(idx);
            var downloads = _this.Downloads();
            downloads.splice(idx, 1);
            _this.Downloads(downloads);
        }, 1000);
        this.SaveFrame = _.throttle(function () {
            _this.IsViewFocused(true);
            var b64 = _this.View.Decoder.GetFrameAsBase64();
            if (b64 == null) {
                return;
            }
            var canvas = document.getElementById('Canvas');
            var thumbnail = Terminal.SaveAsImage(_this.View.Buffer, canvas, 160, 125);
            var data = _this.Storage.AddFrame(b64, thumbnail);
            _this.SavedFrames.push(data);
            _this.FrameSlider.refresh();
        }, 1000);
        this.LoadSavedFrame = _.throttle(function (idx) {
            _this.IsViewFocused(true);
            var data = _this.Storage.GetFrameAt(idx);
            _this.View.Decoder.Load(data.b64);
            _this.UndoStack.length = 0;
        }, 1000);
        this.Clipboard = ko.observable();
        this.CopySavedFrame = _.throttle(function (idx) {
            _this.IsViewFocused(true);
            var data = _this.Storage.GetFrameAt(idx);
            _this.Clipboard(data.b64);
            document.getElementById('Clipboard').select();
            document.execCommand('copy');
        }, 1000);
        this.RemoveSavedFrame = _.throttle(function (idx) {
            _this.IsViewFocused(true);
            _this.Storage.RemoveFrameAt(idx);
            var views = _this.SavedFrames();
            views.splice(idx, 1);
            _this.SavedFrames(views);
            _this.FrameSlider.refresh();
        }, 1000);
        this.SaveAsImage = _.throttle(function () {
            _this.IsViewFocused(true);
            var canvas = document.getElementById('Canvas');
            var data = Terminal.SaveAsImage(_this.View.Buffer, canvas);
            var filename = "".concat(_this.View.Decoder.FrameNumber()).concat(data.extension);
            var image = _this.Storage.AddDownload(filename, data.size, data.b64, data.mime);
            _this.Downloads.push(image);
            _this.scrollToDownloads();
        }, 1000);
        this.CopyCurrent = _.throttle(function () {
            _this.IsViewFocused(true);
            var b64 = _this.View.Decoder.GetFrameAsBase64();
            _this.Clipboard(b64);
            document.getElementById('Clipboard').select();
            document.execCommand('copy');
        }, 1000);
        this.Undo = function () {
            _this.IsViewFocused(true);
            _this.Status.clear();
            if (_this.UndoStack.length == 0) {
                _this.UndoStackSize(0);
                return;
            }
            var b64 = _this.UndoStack.pop();
            _this.View.Decoder.Load(b64);
            _this.UndoStackSize(_this.UndoStack.length);
        };
        this.Storage.Migrate();
        this.Downloads(this.Storage.Downloads());
        this.View.EnableFlash(this.Storage.EnableFlashing);
        this.View.EnableFlash.subscribe(function (newv) {
            _this.Storage.EnableFlashing = newv;
            if (newv) {
                Terminal.Clock.Start();
            }
            else {
                Terminal.Clock.Stop();
            }
        });
        if (this.View.EnableFlash()) {
            Terminal.Clock.Start();
        }
        this.FrameSlider = $("#saved-frames").lightSlider({
            item: 6,
            autoWidth: true
        });
        this.SavedFrames(this.Storage.Frames());
        setTimeout(function () {
            _this.FrameSlider.refresh();
        }, 0);
        [this.View.IsRevealed, this.View.ShowGrid, this.View.EnableFlash].forEach(function (x) { return x.subscribe(function () {
            _this.IsViewFocused(true);
        }); });
    }
    Main.prototype.scrollToDownloads = function () {
        var y = this.downloadsElement.getBoundingClientRect().top + window.scrollY;
        window.scroll({ top: y, behavior: 'smooth' });
    };
    Main.prototype.pushUndo = function () {
        var b64 = this.View.Decoder.GetFrameAsBase64();
        this.UndoStack.push(b64);
        if (this.UndoStack.length > this.maxUndos) {
            this.UndoStack.shift();
        }
        this.UndoStackSize(this.UndoStack.length);
    };
    return Main;
}());
exports.Main = Main;
//# sourceMappingURL=EditorViews.js.map
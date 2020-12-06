"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Main = exports.ViewDataView = void 0;
var Mullard = require("./Mullard.js");
var Terminal = require("./Terminal.js");
var Storage = require("./Storage.js");
var Telesoft = require("./Telesoft.js");
var Mode7 = require("./Mode7.js");
var ViewDataHub = require("./Hub.js");
var Logger = require("./Logger.js");
var SVG = require("./SvgRenderer.js");
var ViewDataView = /** @class */ (function () {
    function ViewDataView() {
        this.Buffer = new Terminal.Buffer();
        this.IsRevealed = ko.observable(false);
        this.ShowGrid = ko.observable(false);
        this.EnableFlash = ko.observable(false);
        this.Decoder = new Mullard.SAA5050(this.Buffer);
        this.Constants = Terminal.Constants;
        this.SVG = new SVG.SvgBufferTransform(this.Buffer, this.ShowGrid);
    }
    return ViewDataView;
}());
exports.ViewDataView = ViewDataView;
var Main = /** @class */ (function () {
    function Main() {
        var _this = this;
        this.defaultHeader = "Click 'Connect'";
        this.mainViewElement = document.getElementById('mainView');
        this.downloadsElement = document.getElementById('downloads');
        this.teletextCommands = {
            HOLD: 'H',
            ADVANCE: '.'
        };
        this.viewdataCommands = {
            NEXT: '#',
            PREVIOUS: '*#'
        };
        this.Header = ko.observable(this.defaultHeader);
        this.UserStats = ko.observable(null);
        this.Services = ko.observableArray();
        this.SelectedService = ko.observable();
        this.IsViewFocused = ko.observable(true);
        this.IsConnected = ko.observable(false);
        this.IsViewdata = ko.observable(true);
        this.IsTeletext = ko.observable(false);
        this.Postamble = ko.observable(null);
        this.Downloading = ko.observable(false);
        this.Input = ko.observable();
        this.Downloads = ko.observableArray();
        this.SavedFrames = ko.observableArray();
        this.EnableLogoff = ko.computed(function () {
            return _this.IsConnected() && _this.Postamble() != null;
        });
        this.EnableCommands = ko.computed(function () {
            return _this.IsConnected() && !_this.Downloading();
        });
        this.EnableDownload = ko.observable(false);
        this.Log = new Logger.Log();
        this.View = new ViewDataView();
        this.Storage = new Storage.Storage();
        this.Keyboard = new Terminal.Input(function (code) {
            switch (code) {
                case Terminal.ControlKeys.Hold:
                    _this.Command(_this.teletextCommands.HOLD);
                    break;
                case Terminal.ControlKeys.Advance:
                    _this.Command(_this.teletextCommands.ADVANCE);
                    break;
                case Terminal.ControlKeys.Reveal:
                    _this.ToggleReveal();
                    break;
                case Terminal.ControlKeys.Download:
                    _this.Download();
                    break;
            }
        }, function (text) {
            _this.Command(text);
        });
        this.Downloader = new Telesoft.Downloads(function (error) {
            _this.Status.unexpected();
            _this.Log.Error(error);
        }, function (frame) {
            _this.send(frame == 'z' ? '0' : '#');
        }, function (filename, size) {
            _this.Downloading(false);
            _this.EnableDownload(false);
            var b64 = _this.Downloader.GetBase64();
            _this.Downloads.push(_this.Storage.AddDownload(filename, size, b64, _this.Storage.MimeTypes.Binary));
            _this.Log.Info("'" + filename + "' downloaded");
            _this.send('#');
            _this.scrollToDownloads();
        });
        this.Hub = new ViewDataHub.Hub({
            received: function (b64) {
                if (b64 == null) {
                    return;
                }
                _this.View.Decoder.DecodeBase64(b64);
                if (_this.Downloading()) {
                    try {
                        _this.Downloader.Decode(b64);
                    }
                    catch (ex) {
                        _this.Log.Error(ex);
                        _this.Status.unexpected();
                    }
                }
                else {
                    try {
                        _this.EnableDownload(_this.Downloader.TryDecodeHeaderFrame(b64));
                    }
                    catch (ex) {
                        //  Do nothing
                    }
                }
            },
            stats: function (stats) {
                if (!stats.active) {
                    _this.UserStats('0 users online');
                }
                else if (stats.active == 1) {
                    _this.UserStats('1 user online');
                }
                else {
                    _this.UserStats(stats.active + " users online");
                }
            },
            exception: function (message) {
                _this.Status.error(message);
                _this.Log.Error(message);
            }
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
            var oe = event.originalEvent;
            if (oe.key == 'Enter') {
                _this.Send();
                return false;
            }
            return true;
        };
        this.ToggleConnect = _.throttle(function () {
            _this.IsViewFocused(true);
            _this.Status.clear();
            _this.Hub.Connect()
                .then(function () {
                return _this.IsConnected() ? _this.disconnect() : _this.connect();
            })
                .catch(function (err) {
                _this.Log.Error(err);
            });
        }, 1000);
        this.ToggleReveal = _.throttle(function () {
            _this.IsViewFocused(true);
            _this.View.IsRevealed(!_this.View.IsRevealed());
        }, 1000);
        this.Send = _.throttle(function () {
            if (!_this.IsConnected()) {
                return;
            }
            _this.IsViewFocused(true);
            var text = _this.Input() || '';
            if (!text.endsWith('#')) {
                text += '#';
            }
            _this.Command(text);
        }, 1000);
        this.Command = function (text) {
            if (text == null || !_this.IsConnected()) {
                return;
            }
            _this.IsViewFocused(true);
            _this.Downloader.Reset();
            _this.Status.clear();
            _this.Hub.Connect()
                .then(function () {
                _this.send(text);
            })
                .catch(function (err) {
                _this.Log.Error(err);
            });
        };
        this.Logoff = function () {
            if (!_this.IsConnected()) {
                return;
            }
            _this.IsViewFocused(true);
            _this.Downloader.Reset();
            _this.Status.clear();
            _this.Hub.Connect()
                .then(function () {
                if (_this.Postamble() != null) {
                    _this.send(_this.Postamble());
                }
            })
                .catch(function (err) {
                _this.Log.Error(err);
            });
        };
        this.Download = function () {
            if (!(_this.EnableDownload() && _this.IsConnected())) {
                return;
            }
            _this.IsViewFocused(true);
            _this.Status.clear();
            _this.Hub.Connect()
                .then(function () {
                _this.Downloading(true);
                _this.send('#');
            })
                .catch(function (err) {
                _this.Log.Error(err);
            });
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
            var filename = "" + _this.View.Decoder.FrameNumber() + data.extension;
            var image = _this.Storage.AddDownload(filename, data.size, data.b64, data.mime);
            _this.Downloads.push(image);
            _this.scrollToDownloads();
        }, 1000);
        this.FullScreen = _.throttle(function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.mainViewElement.requestFullscreen) return [3 /*break*/, 2];
                        this.View.ShowGrid(false);
                        return [4 /*yield*/, this.mainViewElement.requestFullscreen()];
                    case 1:
                        _a.sent();
                        this.IsViewFocused(true);
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        }); }, 1000);
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
        this.initGestures();
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
        this.Hub.Connect()
            .then(function () {
            return _this.Hub.Server.services();
        })
            .then(function (services) {
            _this.Services(services);
            return _this.checkConnection(true);
        })
            .catch(function () {
            _this.Log.Info('No existing connection');
        });
        [this.View.IsRevealed, this.View.ShowGrid, this.View.EnableFlash].forEach(function (x) { return x.subscribe(function () {
            _this.IsViewFocused(true);
        }); });
    }
    Main.prototype.checkConnection = function (reload) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.Hub.Server.isOpen()
                .then(function (result) {
                if (result.isOpen) {
                    _this.SelectedService(result.service);
                    _this.onConnected(result);
                    _this.Log.Info("Already connected");
                    if (reload) {
                        _this.Log.Info("Reloading frame. Sending '*00#'");
                        _this.send('*00#');
                    }
                    resolve();
                }
                else {
                    if (_this.IsConnected()) {
                        _this.Log.Warning("The session was closed due to inactivity or an error on the remote host. Please re-connect");
                        _this.Status.warning("Session closed: inactive/remote error");
                    }
                    _this.onDisconnected();
                    reject();
                }
            })
                .catch(function (error) {
                _this.Log.Error(error);
                _this.Status.unexpected();
                _this.onDisconnected();
                reject(error);
            });
        });
    };
    Main.prototype.send = function (text) {
        var _this = this;
        var raw = Mode7.FromKeyboardString(text);
        this.Log.Info("Sending '" + text + "' encoded as '" + raw + "'");
        var b64 = btoa(raw);
        this.Hub.Server.asyncWrite(b64)
            .catch(function () {
            _this.Log.Error("Send failed. Checking connection");
            return _this.checkConnection(false);
        })
            .catch(function () {
            _this.Log.Info('No existing connection');
        });
    };
    Main.prototype.connect = function () {
        var _this = this;
        var service = this.SelectedService();
        this.Log.Info("Connecting to " + service);
        return this.checkConnection(true).catch(function () {
            return _this.Hub.Server.open(service)
                .then(function (result) {
                _this.Log.Success("Connected to " + result.host + " on port " + result.port);
                _this.onConnected(result);
            })
                .catch(function (error) {
                _this.Log.Error(error);
                _this.Status.unexpected();
            });
        });
    };
    Main.prototype.disconnect = function () {
        var _this = this;
        this.Log.Info("Disconnecting...");
        return this.Hub.Server.close()
            .then(function () {
            _this.Log.Success('Disconnected');
            _this.onDisconnected();
        })
            .catch(function (error) {
            _this.Log.Error(error);
            _this.onDisconnected();
        });
    };
    Main.prototype.initGestures = function () {
        var _this = this;
        var mc = new Hammer.Manager(this.mainViewElement);
        mc.add(new Hammer.Tap({ event: 'singletap', taps: 1 }));
        mc.add(new Hammer.Pan({ event: 'panleft', direction: Hammer.DIRECTION_LEFT }));
        mc.add(new Hammer.Pan({ event: 'panright', direction: Hammer.DIRECTION_RIGHT }));
        mc.add(new Hammer.Pan({ event: 'pandown', direction: Hammer.DIRECTION_DOWN }));
        mc.on('panleft', _.debounce(function () {
            if (!_this.IsConnected()) {
                return;
            }
            if (_this.IsTeletext()) {
                _this.Command(_this.teletextCommands.ADVANCE);
            }
            else {
                _this.Command(_this.viewdataCommands.NEXT);
            }
        }, 500));
        mc.on('panright', _.debounce(function () {
            if (!_this.IsConnected()) {
                return;
            }
            if (!_this.IsTeletext()) {
                _this.Command(_this.viewdataCommands.PREVIOUS);
            }
        }, 500));
        mc.on('pandown', _.debounce(function () {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
        }, 500));
        mc.on('singletap', function (e) {
            if (_this.IsConnected()) {
                if (_this.IsTeletext()) {
                    _this.Command(_this.teletextCommands.HOLD);
                }
            }
        });
    };
    Main.prototype.onConnected = function (result) {
        this.Header(result.host + ":" + result.port);
        this.IsConnected(true);
        this.Postamble(result.postamble);
        this.IsViewdata(result.mode == 'Viewdata');
        this.IsTeletext(result.mode == 'Teletext');
        this.Hub.Server.asyncRead();
    };
    Main.prototype.onDisconnected = function () {
        this.Header(this.defaultHeader);
        this.IsConnected(false);
        this.EnableDownload(false);
        this.Postamble(null);
    };
    Main.prototype.scrollToDownloads = function () {
        var y = this.downloadsElement.getBoundingClientRect().top + window.scrollY;
        window.scroll({ top: y, behavior: 'smooth' });
    };
    return Main;
}());
exports.Main = Main;
//# sourceMappingURL=Views.js.map
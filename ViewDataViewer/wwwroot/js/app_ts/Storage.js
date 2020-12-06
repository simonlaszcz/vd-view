"use strict";
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
var __spread = (this && this.__spread) || function () {
    for (var ar = [], i = 0; i < arguments.length; i++) ar = ar.concat(__read(arguments[i]));
    return ar;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Storage = exports.Download = exports.Frame = void 0;
var Terminal = require("./Terminal.js");
var Views = require("./Views.js");
var Frame = /** @class */ (function () {
    function Frame(data) {
        this.b64 = data.b64;
        this.thumbnail = data.thumbnail;
        this.uri = "data:" + data.thumbnail.mime + ";base64," + data.thumbnail.b64;
    }
    return Frame;
}());
exports.Frame = Frame;
var Download = /** @class */ (function () {
    function Download(data) {
        this.filename = data.filename;
        this.size = data.size;
        this.b64 = data.b64;
        this.mime = data.mime;
        this.uri = "data:" + data.mime + ";base64," + data.b64;
    }
    return Download;
}());
exports.Download = Download;
var Storage = /** @class */ (function () {
    function Storage() {
        this.MimeTypes = {
            Binary: 'application/octet-stream',
            ImagePng: 'image/png'
        };
        this.frameKeyPrefix = /^SF_([0-9]+)$/;
        this.downloadKeyPrefix = /^DL_(.+)$/;
        this.storage = window.localStorage;
        this.frameKeys = __spread(this.getKeys(this.frameKeyPrefix));
        this.downloadKeys = __spread(this.getKeys(this.downloadKeyPrefix));
        this.frameKeys.sort();
        this.downloadKeys.sort();
    }
    Object.defineProperty(Storage.prototype, "EnableFlashing", {
        get: function () {
            return this.storage.getItem('EnableFlashing') == 'true';
        },
        set: function (b) {
            this.storage.setItem('EnableFlashing', String(b === true));
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Storage.prototype, "MessageSequenceNumber", {
        get: function () {
            return Number(this.storage.getItem('MessageSequenceNumber')) || 0;
        },
        set: function (sn) {
            this.storage.setItem('MessageSequenceNumber', String(sn));
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Storage.prototype, "Version", {
        get: function () {
            return Number(this.storage.getItem('Version')) || 0;
        },
        set: function (n) {
            this.storage.setItem('Version', String(n));
        },
        enumerable: false,
        configurable: true
    });
    Storage.prototype.Frames = function () {
        var _this = this;
        return this.frameKeys
            .map(function (key) {
            try {
                return new Frame(JSON.parse(_this.storage.getItem(key)));
            }
            catch (ex) {
                _this.storage.removeItem(key);
            }
            return null;
        })
            .filter(function (x) { return x != null; });
    };
    Storage.prototype.GetFrameAt = function (idx) {
        return new Frame(JSON.parse(this.storage.getItem(this.frameKeys[idx])));
    };
    ;
    Storage.prototype.RemoveFrameAt = function (idx) {
        this.storage.removeItem(this.frameKeys[idx]);
        this.frameKeys.splice(idx, 1);
    };
    ;
    Storage.prototype.AddFrame = function (b64, thumbnail) {
        var key = "SF_" + this.getSeqNo();
        var data = { b64: b64, thumbnail: thumbnail };
        this.storage.setItem(key, JSON.stringify(data));
        this.frameKeys.push(key);
        return new Frame(data);
    };
    Storage.prototype.Downloads = function () {
        var _this = this;
        return this.downloadKeys.map(function (key) {
            try {
                return new Download(JSON.parse(_this.storage.getItem(key)));
            }
            catch (ex) {
                _this.storage.removeItem(key);
            }
            return null;
        }).filter(function (x) { return x != null; });
    };
    Storage.prototype.RemoveDownloadAt = function (idx) {
        this.storage.removeItem(this.downloadKeys[idx]);
        this.downloadKeys.splice(idx, 1);
    };
    Storage.prototype.AddDownload = function (filename, size, b64, mime) {
        if (mime === void 0) { mime = this.MimeTypes.Binary; }
        var key = "DL_" + filename + "_" + this.getSeqNo();
        var data = { filename: filename, size: size, b64: b64, mime: mime };
        this.storage.setItem(key, JSON.stringify(data));
        this.downloadKeys.push(key);
        return new Download(data);
    };
    ;
    Storage.prototype.Migrate = function () {
        var _this = this;
        if (this.Version == 0) {
            if (this.storage.getItem('HelpDismissed') == 'true') {
                this.MessageSequenceNumber = 1;
            }
            this.storage.removeItem('HelpDismissed');
            this.Version = 1;
        }
        if (this.Version == 1) {
            this.downloadKeys.forEach(function (key) {
                var data = JSON.parse(_this.storage.getItem(key));
                if (!data.hasOwnProperty('mime')) {
                    data.mime = _this.MimeTypes.Binary;
                }
                _this.storage.setItem(key, JSON.stringify(data));
            });
            this.Version = 2;
        }
        if (this.Version == 2) {
            var canvas_1 = document.getElementById('Canvas');
            var view_1 = new Views.ViewDataView();
            this.frameKeys.forEach(function (key) {
                var b64 = _this.storage.getItem(key);
                view_1.Decoder.Load(b64);
                var thumbnail = Terminal.SaveAsImage(view_1.Buffer, canvas_1, 160, 125);
                _this.storage.setItem(key, JSON.stringify({ b64: b64, thumbnail: thumbnail }));
            });
            this.Version = 3;
        }
        if (this.Version == 3) {
            this.storage.removeItem('MessageSequenceNumber');
            this.Version = 4;
        }
    };
    Storage.prototype.getKeys = function (pattern) {
        var idx, key;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    idx = 0;
                    _a.label = 1;
                case 1:
                    if (!(idx < this.storage.length)) return [3 /*break*/, 4];
                    key = this.storage.key(idx);
                    if (!pattern.test(key)) return [3 /*break*/, 3];
                    return [4 /*yield*/, key];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    ++idx;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    };
    Storage.prototype.getSeqNo = function () {
        return Date.now() + Math.floor(Math.random() * 10);
    };
    return Storage;
}());
exports.Storage = Storage;
//# sourceMappingURL=Storage.js.map
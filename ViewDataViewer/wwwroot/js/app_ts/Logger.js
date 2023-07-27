"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Log = void 0;
var Log = /** @class */ (function () {
    function Log() {
    }
    Log.prototype.Success = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        args.forEach(function (x) { return console.log("vd-view: success: ".concat(x)); });
    };
    Log.prototype.Info = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        args.forEach(function (x) { return console.log("vd-view: info:  ".concat(x)); });
    };
    Log.prototype.Error = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        args.forEach(function (x) { return console.log("vd-view: error: ".concat(x)); });
    };
    Log.prototype.Warning = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        args.forEach(function (x) { return console.log("vd-view: warning: ".concat(x)); });
    };
    return Log;
}());
exports.Log = Log;
//# sourceMappingURL=Logger.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Hub = void 0;
var Logger = require("./Logger.js");
var SignalR = require("@microsoft/signalr");
var Hub = /** @class */ (function () {
    function Hub(callbacks) {
        var _this = this;
        this.log = new Logger.Log();
        this.connection = new SignalR.HubConnectionBuilder()
            .withUrl('/viewDataHub')
            .configureLogging(SignalR.LogLevel.Error)
            .build();
        this.connection.on('Received', function (b64) {
            callbacks.received(b64);
        });
        this.connection.on('stats', function (stats) {
            callbacks.stats(stats);
        });
        this.connection.on('exception', function (message) {
            callbacks.exception(message);
        });
        this.Server = {
            services: function () { return _this.connection.invoke('Services'); },
            isOpen: function () { return _this.connection.invoke('IsOpen'); },
            open: function (service) { return _this.connection.invoke('Open', service); },
            asyncWrite: function (b64) { return _this.connection.invoke('AsyncWrite', b64); },
            write: function (b64) { return _this.connection.invoke('Write', b64); },
            asyncRead: function () { return _this.connection.invoke('AsyncRead'); },
            read: function () { return _this.connection.invoke('Read'); },
            close: function () { return _this.connection.invoke('Close'); }
        };
    }
    Hub.prototype.Connect = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (_this.connection.state == SignalR.HubConnectionState.Disconnected) {
                _this.connection.start()
                    .then(function () {
                    _this.log.Success('SignalR: started');
                    resolve();
                })
                    .catch(function (error) {
                    _this.log.Success("SignalR: " + error);
                    reject(error);
                });
            }
            else {
                resolve();
            }
        });
    };
    return Hub;
}());
exports.Hub = Hub;
//# sourceMappingURL=Hub.js.map
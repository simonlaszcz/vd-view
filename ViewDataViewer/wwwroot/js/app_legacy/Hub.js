"use strict";

var ViewDataView = ViewDataView || {};

ViewDataView.Hub = (function () {
    $.connection.hub.logging = false;
    $.connection.hub.error(function (error) {
        console.log('SignalR error: ' + error)
    });

    var proxy = $.connection.viewDataHub;
    var exposed = {
        Connect: connect,
        OnReceived: function (callback) {
            proxy.client.received = callback;
        },
        OnStats: function (callback) {
            proxy.client.stats = callback;
        },
        OnException: function (callback) {
            proxy.client.exception = callback;
        },
        Services: proxy.server.services,
        IsOpen: proxy.server.isOpen,
        Open: proxy.server.open,
        AsyncWrite: proxy.server.asyncWrite,
        Write: proxy.server.write,
        AsyncRead: proxy.server.asyncRead,
        Read: proxy.server.read,
        Close: proxy.server.close,
        NextMessageAfter: proxy.server.nextMessageAfter
    };

    function connect() {
        var deferred = $.Deferred();

        if ($.connection.hub.state == $.signalR.connectionState.disconnected) {
            $.connection.hub.start()
                .done(function () {
                    console.log('SignalR started')
                    deferred.resolve();
                })
                .fail(function (error) {
                    console.log(error);
                    deferred.reject(error);
                });
        }
        else {
            deferred.resolve();
        }

        return deferred.promise();
    }

    return exposed;
})();
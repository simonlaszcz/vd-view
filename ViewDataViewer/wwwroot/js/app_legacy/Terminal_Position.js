"use strict";

var Terminal = Terminal || {};

Terminal.Position = function (data) {
    data = data || {};
    var me = this;

    _.defaults(data, {
        row: 0,
        col: 0
    });

    me.Row = ko.observable(data.row);
    me.Column = ko.observable(data.col);
};
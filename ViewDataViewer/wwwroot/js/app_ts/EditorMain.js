"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Views = require("./EditorViews.js");
window.vdView = {
    init: function () {
        var vm = new Views.Main();
        ko.applyBindings(vm);
    }
};
//# sourceMappingURL=EditorMain.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Views = require("./Views.js");
window.vdView = {
    init: function () {
        var vm = new Views.Main();
        ko.applyBindings(vm);
    }
};
//# sourceMappingURL=Main.js.map
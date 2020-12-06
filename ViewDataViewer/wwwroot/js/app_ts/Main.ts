import * as Views from './Views.js';

(window as any).vdView = {
    init: () => {
        var vm = new Views.Main();
        ko.applyBindings(vm);
    }
};
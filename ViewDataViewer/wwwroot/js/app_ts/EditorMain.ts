import * as Views from './EditorViews.js';

(window as any).vdView = {
    init: () => {
        var vm = new Views.Main();
        ko.applyBindings(vm);
    }
};
interface JQueryLightSlider extends JQuery {
    refresh(): void;
}

interface JQuery {
    lightSlider(options: object?): JQueryLightSlider;
}
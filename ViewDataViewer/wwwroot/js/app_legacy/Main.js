"use strict";

var ViewDataView = ViewDataView || {};

ViewDataView.ConsoleLine = function (data) {
    data = data || {};
    var me = this;

    _.defaults(data, {
        Text: null,
        Css: null
    });

    me.Text = ko.observable(data.Text);
    me.Css = ko.observable(data.Css);
};

ViewDataView.ViewDataView = function (data) {
    data = data || {};
    var me = this;

    _.defaults(data, {
        onSubmit: function (text) {
        }
    });

    me.Buffer = new Terminal.Buffer({
        onSubmit: data.onSubmit
    });
    me.Decoder = new Mullard.SAA5050({
        displayBuffer: me.Buffer
    });
    me.IsRevealed = ko.observable(false);
    me.ShowGrid = ko.observable(false);
    me.EnableFlash = ko.observable(false);
};

ViewDataView.Main = function () {
    const me = this;
    const defaultHeader = `Click \'Connect\'`;
    const mainViewId = 'mainView';
    const teletextCommands = {
        HOLD: 'H',
        ADVANCE: '.'
    };
    const viewdataCommands = {
        NEXT: '#',
        PREVIOUS: '*#'
    };
    
    me.Header = ko.observable(defaultHeader);
    me.UserStats = ko.observable(null);
    me.Services = ko.observableArray();
    me.SelectedService = ko.observable();
    me.IsViewFocused = ko.observable(true);
    me.IsConnected = ko.observable(false);
    me.Postamble = ko.observable(null);
    me.IsViewdata = ko.observable(true);
    me.IsTeletext = ko.observable(false);
    me.EnableLogoff = ko.computed(function () {
        return me.IsConnected() && !!me.Postamble();
    });
    me.Downloading = ko.observable(false);
    me.EnableCommands = ko.computed(function () {
        return me.IsConnected() && !me.Downloading();
    });
    me.EnableDownload = ko.observable(false);
    me.View = new ViewDataView.ViewDataView();
    me.Keyboard = new Terminal.Input({
        onChar: function (text) {
            me.Command(text);
        },
        onAlt: function (code) {
            switch (code) {
                case Terminal.ControlKeys.Hold:
                    me.Command(teletextCommands.HOLD);
                    break;
                case Terminal.ControlKeys.Advance:
                    me.Command(teletextCommands.ADVANCE);
                    break;
                case Terminal.ControlKeys.Reveal:
                    me.ToggleReveal();
                    break;
                case Terminal.ControlKeys.Download:
                    me.Download();
                    break;
            }
        }
    });
    me.Downloader = new Telesoft.Downloads({
        onEndOfFrame: function onEndOfFrame(frame) {
            send(frame == 'z' ? '0' : '#');
        },
        onEndOfFile: function onEndOfFile(data) {
            me.Downloading(false);
            me.EnableDownload(false);
            const b64 = me.Downloader.GetBase64();
            me.Downloads.push(Storage.AddDownload(data.filename, data.size, b64, Storage.MimeTypes.Binary));
            log.info(`'${data.filename}' downloaded`);            
            send('#');
            scrollToDownloads();
        },
        onError: function onError(error) {
            status.unexpected();
            log.error(error);
        }
    });
    me.Downloads = ko.observableArray();
    me.Input = ko.observable();
    me.OnKeyDown = function (el, event) {
        var oe = event.originalEvent;

        if (oe.key == 'Enter') {
            me.Send();
            return false;
        }

        return true;
    };
    me.Output = ko.observableArray();
    me.SavedFrames = ko.observableArray();

    me.ToggleConnect = _.throttle(function () {
        me.IsViewFocused(true);
        status.clear();
        ViewDataView.Hub.Connect()
            .then(function () {
                return (me.IsConnected() ? disconnect : connect)();
            });
    }, 1000);

    me.ToggleReveal = _.throttle(function () {
        me.IsViewFocused(true);
        me.View.IsRevealed(!me.View.IsRevealed());
    }, 1000);

    me.Send = _.throttle(function () {
        if (!me.IsConnected()) {
            return;
        }

        me.IsViewFocused(true);
        var text = me.Input() || '';

        if (!text.endsWith('#')) {
            text += '#';
        }

        log.info(`Sending '${text}'`)
        me.Command(text);
    }, 1000);

    me.Command = function (text) {        
        if (!(text != null && me.IsConnected())) {
            return;
        }

        me.IsViewFocused(true);
        me.Downloader.Reset();
        status.clear();

        ViewDataView.Hub.Connect()
            .done(function () {
                send(text);
            });
    };

    me.Logoff = function () {
        if (!me.IsConnected()) {
            return;
        }

        me.IsViewFocused(true);
        me.Downloader.Reset();
        status.clear();

        ViewDataView.Hub.Connect()
            .done(function () {
                send(me.Postamble());
            });
    };

    me.Download = function () {
        if (!(me.EnableDownload() && me.IsConnected())) {
            return;
        }

        me.IsViewFocused(true);
        status.clear();

        ViewDataView.Hub.Connect()
            .done(function () {
                me.Downloading(true);
                send('#');
            });
    };

    me.RemoveDownload = _.throttle(function (idx) {
        Storage.RemoveDownloadAt(idx);
        var downloads = me.Downloads();
        downloads.splice(idx, 1);
        me.Downloads(downloads);
    }, 1000);

    me.SaveFrame = _.throttle(function () {
        me.IsViewFocused(true);
        var b64 = me.View.Decoder.GetFrameAsBase64();

        if (!b64) {
            return;
        }

        const canvas = document.getElementById('Canvas');
        const thumbnail = Terminal.SaveAsImage(me.View.Buffer, canvas, 160, 125);
        const data = Storage.AddFrame(b64, thumbnail);
        me.SavedFrames.push(data);
        ViewDataView.FrameSlider.refresh();
    }, 1000);
    me.LoadSavedFrame = _.throttle(function (idx) {
        me.IsViewFocused(true);
        let data = Storage.GetFrameAt(idx);
        me.View.Decoder.Load(data.b64);
    }, 1000);
    me.Clipboard = ko.observable();
    me.CopySavedFrame = _.throttle(function (idx) {
        me.IsViewFocused(true);
        let data = Storage.GetFrameAt(idx);
        me.Clipboard(data.b64);
        document.getElementById('Clipboard').select();
        document.execCommand('copy');
    }, 1000);
    me.RemoveSavedFrame = _.throttle(function (idx) {
        Storage.RemoveFrameAt(idx);
        var views = me.SavedFrames();
        views.splice(idx, 1);
        me.SavedFrames(views);
        ViewDataView.FrameSlider.refresh();
    }, 1000);

    me.NewsContent = ko.observable();
    me.CloseNews = _.throttle(function () {
        ++Storage.MessageSequenceNumber;
        me.NewsContent(null);
    }, 1000);
    me.NextNews = _.throttle(function () {
        ++Storage.MessageSequenceNumber;
        ViewDataView.Hub.NextMessageAfter(Storage.MessageSequenceNumber).done(function (data) {
            me.NewsContent(data.Result);
        });
    }, 1000);

    me.SaveAsImage = _.throttle(function () {
        const canvas = document.getElementById('Canvas');
        const data = Terminal.SaveAsImage(me.View.Buffer, canvas);
        const filename = `${me.View.Decoder.FrameNumber()}${data.extension}`;
        const image = Storage.AddDownload(filename, data.size, data.b64, data.mime);
        me.Downloads.push(image);
        scrollToDownloads();
    }, 1000);
    me.FullScreen = _.throttle(function () {
        const view = document.getElementById(mainViewId);

        if (view.requestFullscreen) {
            me.View.ShowGrid(false);
            view.requestFullscreen();
            me.IsViewFocused(true);
        }
    }, 1000);

    me.View.EnableFlash(Storage.EnableFlashing);
    me.View.EnableFlash.subscribe(function (newv) {
        Storage.EnableFlashing = newv;

        if (newv) {
            Terminal.Clock.Start();
        }
        else {
            Terminal.Clock.Stop();
        }
    });

    ViewDataView.Hub.OnReceived(receive);
    ViewDataView.Hub.OnStats(stats);
    ViewDataView.Hub.OnException(onException);
    startup();    

    if (me.View.EnableFlash()) {
        Terminal.Clock.Start();
    }

    function startup() {
        return ViewDataView.Hub.Connect()
            .then(function () {
                return ViewDataView.Hub.Services();
            })
            .then(function (services) {
                me.Services(services);
                Storage.Migrate();
                initSavedFrames();
                initDownloads();
                initNews();
                initGestures();
                return checkConnection(true);
            });
    }

    function checkConnection(reload) {
        var deferred = $.Deferred();

        ViewDataView.Hub.IsOpen()
            .done(function (result) {
                if (result.IsOpen) {
                    me.SelectedService(result.Service);
                    connected(result);
                    log.info(`Already connected`);

                    if (!!reload) {
                        log.info(`Reloading frame. Sending '*00#'`);
                        send('*00#');
                    }

                    deferred.resolve();
                }
                else {
                    if (me.IsConnected()) {
                        log.warning(`The session was closed due to inactivity or an error on the remote host. Please re-connect`);
                        status.warning(`Session closed: inactive/remote error`);
                    }

                    disconnected();
                    deferred.reject();
                }
            })
            .fail(function (error) {
                log.error(error);
                status.unexpected();
                disconnected();
                deferred.reject();
            })
            .always(function () {
                if (!me.IsConnected()) {                    
                    disconnected();
                }
            });

        return deferred.promise();
    }

    function receive(b64) {
        if (b64) {
            me.View.Decoder.Decode(b64);

            if (me.Downloading()) {
                try {
                    me.Downloader.Decode(b64);
                }
                catch (ex) {
                    log.error(ex);
                    status.unexpected();
                }
            }
            else {
                try {
                    me.EnableDownload(me.Downloader.TryDecodeHeaderFrame(b64));
                }
                catch (ex) {
                    //  Do nothing
                }
            }
        }
    }

    function stats(data) {
        if (!data.Active) {
            me.UserStats('0 users online');
        }
        else if (data.Active == 1) {
            me.UserStats('1 user online');
        }
        else {
            me.UserStats(`${data.Active} users online`);
        }
    }

    function onException(message) {
        status.error(message);
        log.error(message);
    }

    function send(text) {
        var raw = Mode7.FromKeyboardString(text);
        var b64 = btoa(raw);
        ViewDataView.Hub.AsyncWrite(b64)
            .fail(function () {
                log.error(`Send failed. Checking connection`);
                return checkConnection();
            });
    }

    function connect() {
        var service = me.SelectedService();
        log.info(`Connecting to ${service}`);

        return checkConnection(true)
            .fail(function () {
                return ViewDataView.Hub.Open(service)
                    .then(function (result) {
                        log.success(`Connected to ${result.Host} on port ${result.Port}`);
                        connected(result);
                    })
                    .fail(function (error) {
                        log.error(error);
                        status.unexpected();
                    });
            });
    }

    function disconnect() {
        log.info(`Disconnecting...`);

        return ViewDataView.Hub.Close()
            .done(function () {
                log.success('Disconnected');                
            })
            .fail(function (error) {
                log.error(error);
            })
            .always(function () {
                disconnected();
            });
    }

    function initNews() {
        ViewDataView.Hub.NextMessageAfter(Storage.MessageSequenceNumber).done(function (data) {
            me.NewsContent(data.Result);
        });
    }

    function initSavedFrames() {
        setTimeout(function () {
            ViewDataView.FrameSlider = $("#saved-frames").lightSlider({
                item: 6,
                autoWidth: true
            });
            me.SavedFrames(Storage.Frames());
            ViewDataView.FrameSlider.refresh();
        }, 0);
    }

    function initDownloads() {
        me.Downloads(Storage.Downloads());
    }

    function initGestures() {
        let mc = new Hammer.Manager(document.getElementById(mainViewId));
        let single = mc.add(new Hammer.Tap({ event: 'singletap', taps: 1 }));
        let lpan = mc.add(new Hammer.Pan({ event: 'panleft', direction: Hammer.DIRECTION_LEFT }));
        let rpan = mc.add(new Hammer.Pan({ event: 'panright', direction: Hammer.DIRECTION_RIGHT }));
        let dpan = mc.add(new Hammer.Pan({ event: 'pandown', direction: Hammer.DIRECTION_DOWN }));

        mc.on('panleft', _.debounce(function () {
            if (!me.IsConnected()) {
                return;
            }

            if (me.IsTeletext()) {
                me.Command(teletextCommands.ADVANCE);
            }
            else {
                me.Command(viewdataCommands.NEXT);
            }
        }, 500));

        mc.on('panright', _.debounce(function () {
            if (!me.IsConnected()) {
                return;
            }

            if (!me.IsTeletext()) {
                me.Command(viewdataCommands.PREVIOUS);
            }
        }, 500));

        mc.on('pandown', _.debounce(function () {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
        }, 500));

        mc.on('singletap', function (e) {
            if (me.IsConnected()) {
                if (me.IsTeletext()) {
                    me.Command(teletextCommands.HOLD);
                }
            }
        });
    }

    function connected(result) {
        me.Header(`${result.Host}:${result.Port}`);
        me.IsConnected(true);
        me.Postamble(result.Postamble);
        me.IsViewdata(result.Mode == 'Viewdata');
        me.IsTeletext(result.Mode == 'Teletext');
        ViewDataView.Hub.AsyncRead();
    }

    function disconnected() {
        me.Header(defaultHeader);
        me.IsConnected(false);
        me.EnableDownload(false);
        me.Postamble(null);
    }

    function scrollToDownloads() {
        const y = document.getElementById('downloads').getBoundingClientRect().top + window.scrollY;
        window.scroll({ top: y, behavior: 'smooth' });
    }

    const log = (function () {
        function write(css, lines) {
            lines.forEach(function (text) {
                me.Output.push(new ViewDataView.ConsoleLine({ Text: text, Css: css }));
            });
                
            setTimeout(function () {
                var e = document.getElementsByClassName('console-output')[0];
                e.scrollTop = e.scrollHeight;
            }, 0);
        }

        return {
            success: function () {
                write('fg-green', [...arguments]);
            },
            info: function () {
                write('fg-cyan', [...arguments]);
            },
            error: function () {
                write('fg-red', [...arguments]);
            },
            warning: function () {
                write('fg-yellow', [...arguments]);
            }
        };
    })();

    const status = (function () {
        return {
            success: function (text) {
                me.View.Buffer.SetStatusRow(text, 2, 0);
            },
            info: function (text) {
                me.View.Buffer.SetStatusRow(text, 7, 0);
            },
            error: function (text) {
                me.View.Buffer.SetStatusRow(text, 1, 0);
            },
            unexpected: function () {
                me.View.Buffer.SetStatusRow('An error occurred', 1, 0);
            },
            warning: function (text) {
                me.View.Buffer.SetStatusRow(text, 3, 0);
            },
            clear: function () {
                me.View.Buffer.SetStatusRow(null, 0, 0);
            },
        };
    })();       
};

ViewDataView.init = function () {
    var vm = new ViewDataView.Main();
    ko.applyBindings(vm);
};
"use strict";

let Storage = (function () {
    const frameKeyPrefix = /^SF_([0-9]+)$/;
    const downloadKeyPrefix = /^DL_(.+)$/;
    const storage = window.localStorage;
    let me = {
        get EnableFlashing() {
            return storage.getItem('EnableFlashing') == 'true';
        },
        set EnableFlashing(b) {
            storage.setItem('EnableFlashing', b === true);
        },
        get MessageSequenceNumber() {
            return Number(storage.getItem('MessageSequenceNumber')) || 0;
        },
        set MessageSequenceNumber(sn) {
            return storage.setItem('MessageSequenceNumber', sn);
        },
        get Version() {
            return Number(storage.getItem('Version')) || 0;
        },
        set Version(n) {
            return storage.setItem('Version', n);
        },
        get MimeTypes() {
            return {
                Binary: 'application/octet-stream',
                ImagePng: 'image/png'
            };
        }
    };
    let frameKeys = [...getKeys(frameKeyPrefix)];
    let downloadKeys = [...getKeys(downloadKeyPrefix)];
    frameKeys.sort();
    downloadKeys.sort();

    me.Frames = function () {
        return frameKeys.map(function (key) {
            try {
                let data = JSON.parse(storage.getItem(key));
                data.uri = `data:${data.thumbnail.mime};base64,${data.thumbnail.b64}`;
                return data;
            }
            catch(ex) {
                storage.removeItem(key);
            }
        }).filter(x => x != null);
    };

    me.GetFrameAt = function (idx) {
        let data = JSON.parse(storage.getItem(frameKeys[idx]));
        data.uri = `data:${data.thumbnail.mime};base64,${data.thumbnail.b64}`;
        return data;
    };

    me.RemoveFrameAt = function (idx) {
        storage.removeItem(frameKeys[idx]);
        frameKeys.splice(idx, 1);
    };

    me.AddFrame = function (b64, thumbnail) {
        var key = `SF_${getSeqNo()}`;
        storage.setItem(key, JSON.stringify({b64, thumbnail}));
        frameKeys.push(key);

        return {
            b64: b64,
            thumbnail: thumbnail,
            uri: `data:${thumbnail.mime};base64,${thumbnail.b64}`
        };
    };

    me.Downloads = function () {
        return downloadKeys.map(function (key) {
            try {
                let data = JSON.parse(storage.getItem(key));
                data.uri = `data:${data.mime};base64,${data.b64}`;
                return data;
            }
            catch(ex) {
                storage.removeItem(key);
            }
        }).filter(x => x != null);
    };

    me.RemoveDownloadAt = function (idx) {
        storage.removeItem(downloadKeys[idx]);
        downloadKeys.splice(idx, 1);
    };

    me.AddDownload = function (filename, size, b64, mime = me.MimeTypes.Binary) {
        const key = `DL_${filename}_${getSeqNo()}`;
        storage.setItem(key, JSON.stringify({filename, size, b64, mime}));
        downloadKeys.push(key);

        return {
            filename: filename,
            size: size,
            b64: b64,
            uri: `data:${mime};base64,${b64}`
        };
    };

    me.Migrate = function migrate() {
        if (me.Version == 0) {
            if (storage.getItem('HelpDismissed') == 'true') {
                me.MessageSequenceNumber = 1;
            }

            storage.removeItem('HelpDismissed');
            me.Version = 1;
        }

        if (me.Version == 1) {
            downloadKeys.forEach(function (key) {
                let data = JSON.parse(storage.getItem(key));

                if (!data.hasOwnProperty('mime')) {
                    data.mime = me.MimeTypes.Binary;
                }

                storage.setItem(key, JSON.stringify(data));
            });

            me.Version = 2;
        }

        if (me.Version == 2) {
            const canvas = document.getElementById('Canvas');
            const view = new ViewDataView.ViewDataView();

            frameKeys.forEach(function (key) {
                const b64 = storage.getItem(key);
                view.Decoder.Load(b64);
                const thumbnail = Terminal.SaveAsImage(view.Buffer, canvas, 160, 125);
                storage.setItem(key, JSON.stringify({b64, thumbnail}));
            });

            me.Version = 3;
        }
    }
    
    function* getKeys(pattern) {
        for (var idx = 0; idx < storage.length; ++idx) {
            var key = storage.key(idx);

            if (pattern.test(key)) {
                yield key;
            }
        }
    }

    function getSeqNo() {
        return Date.now() + Math.floor(Math.random() * 10);
    }

    return me;
})();
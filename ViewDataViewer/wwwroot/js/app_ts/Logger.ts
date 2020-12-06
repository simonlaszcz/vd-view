export class Log {
    constructor() {
    }

    Success(...args: Array<string>) {
        args.forEach(x => console.log(`vd-view: success: ${x}`));
    }

    Info(...args: Array<string>) {
        args.forEach(x => console.log(`vd-view: info:  ${x}`));
    }

    Error(...args: Array<string>) {
        args.forEach(x => console.log(`vd-view: error: ${x}`));
    }

    Warning(...args: Array<string>) {
        args.forEach(x => console.log(`vd-view: warning: ${x}`));
    }
}
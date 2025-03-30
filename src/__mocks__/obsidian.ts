export class App {
    vault = {
        getAbstractFileByPath: jest.fn()
    };
}

export class TFile {
    path: string;
    constructor(path: string) {
        this.path = path;
    }
}

export const setIcon = jest.fn();
export const Notice = jest.fn(); 
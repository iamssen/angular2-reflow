/// <reference path="../typings/tsd.d.ts" />
import { Provider } from 'angular2/core';
import * as rf from './angular2-reflow.core';
export * from './angular2-reflow.core';
export declare class ContextFactory {
    private _providers;
    private _commandMapSettings;
    private _providerTokens;
    providers: Provider[];
    constructor();
    protected provide(provider: Provider): void;
    protected mapCommand(eventType: string, commands: rf.Command[] | rf.CommandFlowFactory, avoidRunSameCommand?: boolean): void;
    protected mapDependency(): void;
}

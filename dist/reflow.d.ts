import { Provider } from 'angular2/core';
import * as reflow from './reflow.core';
export * from './reflow.core';
export declare class ContextFactory {
    private _providers;
    private commandMapSettings;
    providers: Provider[];
    constructor();
    protected provide(provider: Provider): void;
    protected mapCommand(eventType: string, commands: reflow.Command[] | reflow.CommandFlowFactory, avoidRunSameCommand?: boolean): void;
    protected mapDependency(): void;
}

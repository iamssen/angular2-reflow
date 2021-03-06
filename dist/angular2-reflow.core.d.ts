import { Observable } from 'rxjs';
export declare const CONTEXT: string;
export declare const EVENT_BUS: string;
export interface Context {
    start(): any;
    destroy(): any;
}
export interface EventListener {
    type: string;
    listener: (event) => void;
    remove(): any;
    destroy(): any;
}
export interface EventObserver {
    type: string;
    observe(): Observable<any>;
    destroy(): any;
}
export interface EventBus {
    addEventListener(eventType: string, listener: (event) => void): EventListener;
    on(eventType: string, listener: (event) => void): EventListener;
    observe(eventType: string): EventObserver;
    dispatchEvent(event: any, toGlobal?: boolean): any;
    fire(event: any, toGlobal?: boolean): any;
}
export interface Command {
    execute(chain: CommandChain): any;
    stop?(): any;
}
export interface CommandFlowFactory {
    get(): CommandFlow;
}
export interface CommandFlow {
    hasNext(): boolean;
    next(): any;
}
export interface CommandChain {
    event: any;
    sharedData: Object;
    next(): any;
    stop(): any;
}

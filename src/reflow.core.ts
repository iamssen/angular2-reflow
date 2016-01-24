import {Provider} from 'angular2/core';

export const CONTEXT:string = 'reflow:context';
export const EVENT_BUS:string = 'reflow:eventBus';

export interface Context {
  start();
  destroy();
}

export interface EventListener {
  type:string;
  listener:(event) => void;
  remove();
}

export interface EventBus {
  addEventListener(eventType:string, listener:(event) => void):EventListener;
  on(eventType:string, listener:(event) => void):EventListener;
  dispatchEvent(event, toGlobal:boolean);
  fire(event, toGlobal:boolean);
}

export interface Command {
  execute(chain:CommandChain);
  stop?();
}

export interface CommandFlowFactory {
  get():CommandFlow;
}

export interface CommandFlow {
  hasNext():boolean;
  next():any;
}

export interface CommandChain {
  event;
  sharedData:Object;
  next();
  stop();
}
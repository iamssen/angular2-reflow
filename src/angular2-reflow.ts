/// <reference path="../typings/tsd.d.ts"/>
import {Provider, Inject, Injector} from 'angular2/core';
import * as rf from './angular2-reflow.core';

export * from './angular2-reflow.core';

const COMMAND_MAP_SETTINGS:string = '__commandMapSettings__';
const PROVIDER_TOKENS:string = '__providerTokens__';

export class ContextFactory {
  private _providers:Provider[];
  private _commandMapSettings:CommandMapSetting[];
  private _providerTokens:any[];

  get providers():Provider[] {
    return this._providers.slice();
  }

  constructor() {
    this._commandMapSettings = [];
    this._providerTokens = [rf.CONTEXT, rf.EVENT_BUS];
    this._providers = [
      new Provider(rf.CONTEXT, {useClass: Context}),
      new Provider(rf.EVENT_BUS, {useClass: EventBus}),
      new Provider(COMMAND_MAP_SETTINGS, {useValue: this._commandMapSettings}),
      new Provider(PROVIDER_TOKENS, {useValue: this._providerTokens})
    ];
    this.mapDependency();
  }

  protected provide(provider:Provider) {
    this._providers.push(provider);
    this._providerTokens.push(provider.token);
  }

  protected mapCommand(eventType:string,
                       commands:rf.Command[]|rf.CommandFlowFactory,
                       avoidRunSameCommand:boolean = false) {
    this._commandMapSettings.push({
      eventType,
      commands: (commands instanceof Array) ? new Commands(commands) : commands as rf.CommandFlowFactory,
      avoidRunSameCommand
    });
  }

  protected mapDependency() {
  }
}

interface CommandMapSetting {
  eventType:string;
  commands:rf.CommandFlowFactory;
  avoidRunSameCommand:boolean;
}

class Context implements rf.Context {
  private commandMap:CommandMap;

  constructor(@Inject(Injector) private injector:Injector,
              @Inject(rf.EVENT_BUS) private eventBus:EventBus,
              @Inject(COMMAND_MAP_SETTINGS) private commandMapSettings:CommandMapSetting[],
              @Inject(PROVIDER_TOKENS) private providerTokens:any[]) {
  }

  start() {
    this.commandMap = new CommandMap(this.eventBus, this.injector, this.commandMapSettings);
  }

  destroy() {
    this.providerTokens
      .map(token => this.injector.get(token))
      .forEach(instance => {
        if (instance.hasOwnProperty('destroy') && typeof instance['destroy'] === 'function') {
          instance['destroy']();
        }
      });

    this.commandMap = null;
    this.eventBus = null;
  }
}

class Commands implements rf.CommandFlowFactory {
  constructor(private commands:rf.Command[]) {
    if (!commands || commands.length < 1) throw new Error('require command classes.');
  }

  get():rf.CommandFlow {
    return new SequentialCommandFlow(this.commands);
  }
}

class SequentialCommandFlow implements rf.CommandFlow {
  f:number;
  fmax:number;

  constructor(private commands:rf.Command[]) {
    this.f = -1;
    this.fmax = commands.length;
  }

  hasNext():boolean {
    return this.f < this.fmax - 1;
  }

  next():any {
    if (++this.f < this.fmax) return this.commands[this.f];
    return null;
  }
}

class CommandChain implements rf.CommandChain {
  private _sharedData:Object;
  private _currentCommand:rf.Command;

  constructor(private _event:{type:string},
              private injector:Injector,
              private commands:rf.CommandFlow,
              private deconstructCallback:Function) {
  }

  get event() {
    return this._event;
  }

  get sharedData():Object {
    if (!this._sharedData) this._sharedData = {};
    return this._sharedData;
  }

  next() {
    if (this.commands.hasNext()) {
      let CommandClass = this.commands.next();
      let command:rf.Command = this.injector.resolveAndInstantiate(CommandClass);

      this._currentCommand = command;

      command.execute(this);
    } else {
      this.destroy();
    }
  }

  stop() {
    if (this._currentCommand && this._currentCommand.hasOwnProperty('stop')) this._currentCommand.stop();
    this.destroy();
  }

  destroy() {
    this._currentCommand = null;
    if (this.deconstructCallback) {
      this.deconstructCallback(this);
      this.deconstructCallback = null;
    }
    this._event = null;
    this.injector = null;
    this.commands = null;
  }
}

interface CommandInfo {
  eventType:string;
  eventListener:rf.EventListener;
  commands:rf.CommandFlowFactory;
  avoidRunSameCommand:boolean;
}

class CommandMap {
  commandInfos:{[eventType:string]:CommandInfo};
  progressingCommandChains:rf.CommandChain[];

  constructor(private eventBus:rf.EventBus,
              private injector:Injector,
              commandMapSettings:CommandMapSetting[]) {
    this.commandInfos = {};
    this.progressingCommandChains = [];
    commandMapSettings.forEach(setting => {
      this.map(setting.eventType, setting.commands, setting.avoidRunSameCommand)
    })
  }

  map(eventType:string, commands:rf.CommandFlowFactory, avoidRunSameCommand:boolean = false) {
    if (this.commandInfos[eventType] !== undefined) throw new Error(`${eventType} is already on command map`);

    this.commandInfos[eventType] = {
      eventType,
      eventListener: this.eventBus.addEventListener(eventType, this.eventHandler.bind(this)),
      commands,
      avoidRunSameCommand
    };
  }

  has(eventType:string):boolean {
    return this.commandInfos[eventType] !== undefined;
  }

  eventHandler(event) {
    const commandInfo:CommandInfo = this.commandInfos[event.type];
    if (!commandInfo) throw new Error(`${event.type} is not exists on command map`);

    if (commandInfo.avoidRunSameCommand) {
      this.progressingCommandChains.forEach(chain => {
        if (chain.event.type === event.type) {
          chain.stop();
          this.commandChainDeconstructed(chain);
        }
      });
    }

    let commandChain:CommandChain = new CommandChain(
      event,
      this.injector,
      commandInfo.commands.get(),
      this.commandChainDeconstructed.bind(this)
    );

    this.progressingCommandChains.push(commandChain);
    commandChain.next();
  }

  commandChainDeconstructed(chain:rf.CommandChain) {
    if (!this.progressingCommandChains) return;
    let index:number = this.progressingCommandChains.indexOf(chain);
    if (index > -1) this.progressingCommandChains.splice(index, 1);
  }

  destroy() {
    let commandChains:rf.CommandChain[] = this.progressingCommandChains.slice();
    this.progressingCommandChains = null;

    commandChains.forEach(commandChain => {
      commandChain.stop();
    });

    this.commandInfos = null;
    this.eventBus = null;
    this.injector = null;
  }
}

class EventBus implements rf.EventBus {
  private static dispatchers:Set<EventDispatcher> = new Set<EventDispatcher>();
  private dispatcher:EventDispatcher;

  constructor() {
    this.dispatcher = new EventDispatcher;
    EventBus.dispatchers.add(this.dispatcher);
  }

  addEventListener(eventType:string, listener:(event)=>void):rf.EventListener {
    return this.dispatcher.addEventListener(eventType, listener);
  }

  on(eventType:string, listener:(event)=>void):rf.EventListener {
    return this.addEventListener(eventType, listener);
  }

  dispatchEvent(event, toGlobal:boolean = false) {
    if (toGlobal) {
      EventBus.dispatchers.forEach(dispatcher => dispatcher.dispatchEvent(event));
    } else {
      this.dispatcher.dispatchEvent(event);
    }
  }

  fire(event, toGlobal:boolean = false) {
    this.dispatchEvent(event, toGlobal);
  }

  destroy() {
    EventBus.dispatchers.delete(this.dispatcher);
    this.dispatcher.destroy();
    this.dispatcher = null;
  }
}

class EventDispatcher {
  private collection:EventCollection;

  constructor() {
    this.collection = new EventCollection;
  }

  addEventListener(type:string, listener:(event) => void):rf.EventListener {
    return this.collection.add(type, listener);
  }

  dispatchEvent(event:{type:string}) {
    let listeners:rf.EventListener[] = this.collection.get(event.type);
    if (!listeners || listeners.length === 0) return;
    listeners.forEach((listener:rf.EventListener) => listener.listener(event));
  }

  destroy() {
    this.collection.destroy();
    this.collection = null;
  }
}


interface EventListenerRef {
  keys: Set<Function>;
  map: WeakMap<Function, rf.EventListener>;
}

class EventCollection {
  private types:Map<string, EventListenerRef> = new Map<string, EventListenerRef>();

  add(type:string, handler:Function):rf.EventListener {
    if (this.types.has(type) && this.types.get(type).keys.has(handler)) {
      return this.types.get(type).map.get(handler);
    }

    let ref:EventListenerRef;
    if (!this.types.has(type)) {
      //noinspection TypeScriptValidateTypes
      ref = {keys: new Set<Function>(), map: new WeakMap<Function, rf.EventListener>()};
      this.types.set(type, ref);
    } else {
      ref = this.types.get(type);
    }

    let listener:EventListener = new EventListener(type, handler as (event) => void, this);
    ref.keys.add(handler);
    ref.map.set(handler, listener);
    return listener;
  }

  remove(type:string, handler:Function) {
    if (!this.types) return;

    if (this.types.has(type) && this.types.get(type).keys.has(handler)) {
      let ref:EventListenerRef = this.types.get(type);
      ref.keys.delete(handler);
      ref.map.delete(handler);
    }
  }

  get(type:string):rf.EventListener[] {
    if (!this.types) return null;

    let eventListeners:rf.EventListener[] = [];
    if (this.types.has(type)) {
      let ref:EventListenerRef = this.types.get(type);
      let map:WeakMap<Function, rf.EventListener> = ref.map;
      let values:Iterator<Function> = ref.keys.values();
      while (true) {
        let entry = values.next();
        if (typeof entry.value === 'function') {
          eventListeners.push(map.get(entry.value));
        } else {
          break;
        }
      }
    }
    return eventListeners;
  }

  destroy() {
    this.types.forEach((ref:EventListenerRef) => {
      ref.keys.clear();
      if (ref.map.hasOwnProperty('clear')) ref.map['clear']();
    });
    this.types.clear();
    this.types = null;
  }

}

class EventListener implements rf.EventListener {
  get type():string {
    return this._type;
  }

  get listener():(event) => void {
    return this._listener;
  }

  constructor(private _type:string,
              private _listener:(event) => void,
              private _collection:EventCollection) {
  }

  remove():void {
    if (this._collection) this._collection.remove(this._type, this._listener);

    this._type = null;
    this._listener = null;
    this._collection = null;
  }
}
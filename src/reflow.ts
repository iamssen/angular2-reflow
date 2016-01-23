import {Provider, Inject, Injector} from 'angular2/core';
import * as reflow from './reflow.core';

export * from './reflow.core';

const __commandMapSettings__:string = '__commandMapSettings__';

export class ContextFactory {
  private _providers:Provider[];
  private commandMapSettings:CommandMapSetting[];

  get providers():Provider[] {
    return this._providers.slice();
  }

  constructor() {
    this.commandMapSettings = [];
    this._providers = [
      new Provider(reflow.CONTEXT, {useClass: Context}),
      new Provider(reflow.EVENT_BUS, {useClass: EventBus}),
      new Provider(__commandMapSettings__, {useValue: this.commandMapSettings})
    ];
    this.mapDependency();
  }

  protected provide(provider:Provider) {
    this._providers.push(provider);
  }

  protected mapCommand(eventType:string,
             commands:reflow.Command[]|reflow.CommandFlowFactory,
             avoidRunSameCommand:boolean = false) {
    this.commandMapSettings.push({
      eventType,
      commands: (commands instanceof Array) ? new Commands(commands) : commands as reflow.CommandFlowFactory,
      avoidRunSameCommand
    });
  }

  protected mapDependency() {
  }
}

interface CommandMapSetting {
  eventType:string;
  commands:reflow.CommandFlowFactory;
  avoidRunSameCommand:boolean;
}

class Context implements reflow.Context {
  private commandMap:CommandMap;

  constructor(@Inject(Injector) private injector:Injector,
        @Inject(reflow.EVENT_BUS) private eventBus:EventBus,
        @Inject(__commandMapSettings__) private commandMapSettings:CommandMapSetting[]) {
  }

  start() {
    console.log('reflow.ts..start()');
    this.commandMap = new CommandMap(this.eventBus, this.injector, this.commandMapSettings);
  }

  destroy() {
    console.log('reflow.ts..destroy()');
    this.commandMap.destroy();
    this.eventBus.destroy();

    this.commandMap = null;
    this.eventBus = null;
  }
}

class Commands implements reflow.CommandFlowFactory {
  constructor(private commands:reflow.Command[]) {
    if (!commands || commands.length < 1) throw new Error('require command classes.');
  }

  get():reflow.CommandFlow {
    return new SequentialCommandFlow(this.commands);
  }
}

class SequentialCommandFlow implements reflow.CommandFlow {
  f:number;
  fmax:number;

  constructor(private commands:reflow.Command[]) {
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

class CommandChain implements reflow.CommandChain {
  private _sharedData:Object;
  private _currentCommand:reflow.Command;

  constructor(private _event:{type:string},
        private injector:Injector,
        private commands:reflow.CommandFlow,
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
      let command:reflow.Command = this.injector.resolveAndInstantiate(CommandClass);

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
  eventListener:reflow.EventListener;
  commands:reflow.CommandFlowFactory;
  avoidRunSameCommand:boolean;
}

class CommandMap {
  commandInfos:{[eventType:string]:CommandInfo};
  progressingCommandChains:reflow.CommandChain[];

  constructor(private eventBus:reflow.EventBus,
        private injector:Injector,
        commandMapSettings:CommandMapSetting[]) {
    this.commandInfos = {};
    this.progressingCommandChains = [];
    commandMapSettings.forEach(setting => {
      this.map(setting.eventType, setting.commands, setting.avoidRunSameCommand)
    })
  }

  map(eventType:string, commands:reflow.CommandFlowFactory, avoidRunSameCommand:boolean = false) {
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

  commandChainDeconstructed(chain:reflow.CommandChain) {
    if (!this.progressingCommandChains) return;
    let index:number = this.progressingCommandChains.indexOf(chain);
    if (index > -1) this.progressingCommandChains.splice(index, 1);
  }

  destroy() {
    let commandChains:reflow.CommandChain[] = this.progressingCommandChains.slice();
    this.progressingCommandChains = null;

    commandChains.forEach(commandChain => {
      commandChain.stop();
    });

    this.commandInfos = null;
    this.eventBus = null;
    this.injector = null;
  }
}

class EventBus implements reflow.EventBus {
  private dispatcher:EventDispatcher;

  constructor() {
    this.dispatcher = new EventDispatcher;
  }

  addEventListener(eventType:string, listener:(event)=>void):reflow.EventListener {
    return this.dispatcher.addEventListener(eventType, listener);
  }

  on(eventType:string, listener:(event)=>void):reflow.EventListener {
    return this.addEventListener(eventType, listener);
  }

  dispatchEvent(event) {
    this.dispatcher.dispatchEvent(event);
  }

  fire(event) {
    this.dispatchEvent(event);
  }

  destroy() {
    this.dispatcher.destroy();
    this.dispatcher = null;
  }
}

class EventDispatcher {
  private collection:EventCollection;

  constructor() {
    this.collection = new EventCollection;
  }

  addEventListener(type:string, listener:(event) => void):reflow.EventListener {
    return this.collection.add(type, listener);
  }

  dispatchEvent(event:{type:string}) {
    let listeners:reflow.EventListener[] = this.collection.get(event.type);
    if (!listeners || listeners.length === 0) return;
    listeners.forEach((listener:reflow.EventListener) => listener.listener(event));
  }

  destroy() {
    this.collection.destroy();
    this.collection = null;
  }
}


interface EventListenerRef {
  keys: Set<Function>;
  map: WeakMap<Function, reflow.EventListener>;
}

class EventCollection {
  private types:Map<string, EventListenerRef> = new Map<string, EventListenerRef>();

  add(type:string, handler:Function):reflow.EventListener {
    if (this.types.has(type) && this.types.get(type).keys.has(handler)) {
      return this.types.get(type).map.get(handler);
    }

    let ref:EventListenerRef;
    if (!this.types.has(type)) {
      ref = {keys: new Set<Function>(), map: new WeakMap<Function, reflow.EventListener>()};
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

  get(type:string):reflow.EventListener[] {
    if (!this.types) return null;

    let eventListeners:reflow.EventListener[] = [];
    if (this.types.has(type)) {
      let ref:EventListenerRef = this.types.get(type);
      let map:WeakMap<Function, reflow.EventListener> = ref.map;
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

class EventListener implements reflow.EventListener {
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
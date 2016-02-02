var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
define("angular2-reflow.core", ["require", "exports"], function (require, exports) {
    "use strict";
    exports.CONTEXT = 'reflow:context';
    exports.EVENT_BUS = 'reflow:eventBus';
});
define("angular2-reflow", ["require", "exports", 'angular2/core', "angular2-reflow.core", "angular2-reflow.core"], function (require, exports, core_1, rf, angular2_reflow_core_1) {
    "use strict";
    function __export(m) {
        for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
    }
    __export(angular2_reflow_core_1);
    var COMMAND_MAP_SETTINGS = '__commandMapSettings__';
    var PROVIDER_TOKENS = '__providerTokens__';
    var ContextFactory = (function () {
        function ContextFactory() {
            this._commandMapSettings = [];
            this._providerTokens = [rf.CONTEXT, rf.EVENT_BUS];
            this._providers = [
                new core_1.Provider(rf.CONTEXT, { useClass: Context }),
                new core_1.Provider(rf.EVENT_BUS, { useClass: EventBus }),
                new core_1.Provider(COMMAND_MAP_SETTINGS, { useValue: this._commandMapSettings }),
                new core_1.Provider(PROVIDER_TOKENS, { useValue: this._providerTokens })
            ];
            this.mapDependency();
        }
        Object.defineProperty(ContextFactory.prototype, "providers", {
            get: function () {
                return this._providers.slice();
            },
            enumerable: true,
            configurable: true
        });
        ContextFactory.prototype.provide = function (provider) {
            this._providers.push(provider);
            this._providerTokens.push(provider.token);
        };
        ContextFactory.prototype.mapCommand = function (eventType, commands, avoidRunSameCommand) {
            if (avoidRunSameCommand === void 0) { avoidRunSameCommand = false; }
            this._commandMapSettings.push({
                eventType: eventType,
                commands: (commands instanceof Array) ? new Commands(commands) : commands,
                avoidRunSameCommand: avoidRunSameCommand
            });
        };
        ContextFactory.prototype.mapDependency = function () {
        };
        return ContextFactory;
    }());
    exports.ContextFactory = ContextFactory;
    var Context = (function () {
        function Context(injector, eventBus, commandMapSettings, providerTokens) {
            this.injector = injector;
            this.eventBus = eventBus;
            this.commandMapSettings = commandMapSettings;
            this.providerTokens = providerTokens;
        }
        Context.prototype.start = function () {
            this.commandMap = new CommandMap(this.eventBus, this.injector, this.commandMapSettings);
        };
        Context.prototype.destroy = function () {
            var _this = this;
            this.providerTokens
                .map(function (token) { return _this.injector.get(token); })
                .forEach(function (instance) {
                if (instance.hasOwnProperty('destroy') && typeof instance['destroy'] === 'function') {
                    instance['destroy']();
                }
            });
            this.commandMap = null;
            this.eventBus = null;
        };
        Context = __decorate([
            __param(0, core_1.Inject(core_1.Injector)),
            __param(1, core_1.Inject(rf.EVENT_BUS)),
            __param(2, core_1.Inject(COMMAND_MAP_SETTINGS)),
            __param(3, core_1.Inject(PROVIDER_TOKENS)), 
            __metadata('design:paramtypes', [(typeof (_a = typeof core_1.Injector !== 'undefined' && core_1.Injector) === 'function' && _a) || Object, EventBus, Array, Array])
        ], Context);
        return Context;
        var _a;
    }());
    var Commands = (function () {
        function Commands(commands) {
            this.commands = commands;
            if (!commands || commands.length < 1)
                throw new Error('require command classes.');
        }
        Commands.prototype.get = function () {
            return new SequentialCommandFlow(this.commands);
        };
        return Commands;
    }());
    var SequentialCommandFlow = (function () {
        function SequentialCommandFlow(commands) {
            this.commands = commands;
            this.f = -1;
            this.fmax = commands.length;
        }
        SequentialCommandFlow.prototype.hasNext = function () {
            return this.f < this.fmax - 1;
        };
        SequentialCommandFlow.prototype.next = function () {
            if (++this.f < this.fmax)
                return this.commands[this.f];
            return null;
        };
        return SequentialCommandFlow;
    }());
    var CommandChain = (function () {
        function CommandChain(_event, injector, commands, deconstructCallback) {
            this._event = _event;
            this.injector = injector;
            this.commands = commands;
            this.deconstructCallback = deconstructCallback;
        }
        Object.defineProperty(CommandChain.prototype, "event", {
            get: function () {
                return this._event;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(CommandChain.prototype, "sharedData", {
            get: function () {
                if (!this._sharedData)
                    this._sharedData = {};
                return this._sharedData;
            },
            enumerable: true,
            configurable: true
        });
        CommandChain.prototype.next = function () {
            if (this.commands.hasNext()) {
                var CommandClass = this.commands.next();
                var command = this.injector.resolveAndInstantiate(CommandClass);
                this._currentCommand = command;
                command.execute(this);
            }
            else {
                this.destroy();
            }
        };
        CommandChain.prototype.stop = function () {
            if (this._currentCommand && this._currentCommand.hasOwnProperty('stop'))
                this._currentCommand.stop();
            this.destroy();
        };
        CommandChain.prototype.destroy = function () {
            this._currentCommand = null;
            if (this.deconstructCallback) {
                this.deconstructCallback(this);
                this.deconstructCallback = null;
            }
            this._event = null;
            this.injector = null;
            this.commands = null;
        };
        return CommandChain;
    }());
    var CommandMap = (function () {
        function CommandMap(eventBus, injector, commandMapSettings) {
            var _this = this;
            this.eventBus = eventBus;
            this.injector = injector;
            this.commandInfos = {};
            this.progressingCommandChains = [];
            commandMapSettings.forEach(function (setting) {
                _this.map(setting.eventType, setting.commands, setting.avoidRunSameCommand);
            });
        }
        CommandMap.prototype.map = function (eventType, commands, avoidRunSameCommand) {
            if (avoidRunSameCommand === void 0) { avoidRunSameCommand = false; }
            if (this.commandInfos[eventType] !== undefined)
                throw new Error(eventType + " is already on command map");
            this.commandInfos[eventType] = {
                eventType: eventType,
                eventListener: this.eventBus.addEventListener(eventType, this.eventHandler.bind(this)),
                commands: commands,
                avoidRunSameCommand: avoidRunSameCommand
            };
        };
        CommandMap.prototype.has = function (eventType) {
            return this.commandInfos[eventType] !== undefined;
        };
        CommandMap.prototype.eventHandler = function (event) {
            var _this = this;
            var commandInfo = this.commandInfos[event.type];
            if (!commandInfo)
                throw new Error(event.type + " is not exists on command map");
            if (commandInfo.avoidRunSameCommand) {
                this.progressingCommandChains.forEach(function (chain) {
                    if (chain.event.type === event.type) {
                        chain.stop();
                        _this.commandChainDeconstructed(chain);
                    }
                });
            }
            var commandChain = new CommandChain(event, this.injector, commandInfo.commands.get(), this.commandChainDeconstructed.bind(this));
            this.progressingCommandChains.push(commandChain);
            commandChain.next();
        };
        CommandMap.prototype.commandChainDeconstructed = function (chain) {
            if (!this.progressingCommandChains)
                return;
            var index = this.progressingCommandChains.indexOf(chain);
            if (index > -1)
                this.progressingCommandChains.splice(index, 1);
        };
        CommandMap.prototype.destroy = function () {
            var commandChains = this.progressingCommandChains.slice();
            this.progressingCommandChains = null;
            commandChains.forEach(function (commandChain) {
                commandChain.stop();
            });
            this.commandInfos = null;
            this.eventBus = null;
            this.injector = null;
        };
        return CommandMap;
    }());
    var EventBus = (function () {
        function EventBus() {
            this.dispatcher = new EventDispatcher;
            EventBus.dispatchers.add(this.dispatcher);
        }
        EventBus.prototype.addEventListener = function (eventType, listener) {
            return this.dispatcher.addEventListener(eventType, listener);
        };
        EventBus.prototype.on = function (eventType, listener) {
            return this.addEventListener(eventType, listener);
        };
        EventBus.prototype.dispatchEvent = function (event, toGlobal) {
            if (toGlobal === void 0) { toGlobal = false; }
            if (toGlobal) {
                EventBus.dispatchers.forEach(function (dispatcher) { return dispatcher.dispatchEvent(event); });
            }
            else {
                this.dispatcher.dispatchEvent(event);
            }
        };
        EventBus.prototype.fire = function (event, toGlobal) {
            if (toGlobal === void 0) { toGlobal = false; }
            this.dispatchEvent(event, toGlobal);
        };
        EventBus.prototype.destroy = function () {
            EventBus.dispatchers.delete(this.dispatcher);
            this.dispatcher.destroy();
            this.dispatcher = null;
        };
        EventBus.dispatchers = new Set();
        return EventBus;
    }());
    var EventDispatcher = (function () {
        function EventDispatcher() {
            this.collection = new EventCollection;
        }
        EventDispatcher.prototype.addEventListener = function (type, listener) {
            return this.collection.add(type, listener);
        };
        EventDispatcher.prototype.dispatchEvent = function (event) {
            var listeners = this.collection.get(event.type);
            if (!listeners || listeners.length === 0)
                return;
            listeners.forEach(function (listener) { return listener.listener(event); });
        };
        EventDispatcher.prototype.destroy = function () {
            this.collection.destroy();
            this.collection = null;
        };
        return EventDispatcher;
    }());
    var EventCollection = (function () {
        function EventCollection() {
            this.types = new Map();
        }
        EventCollection.prototype.add = function (type, handler) {
            if (this.types.has(type) && this.types.get(type).keys.has(handler)) {
                return this.types.get(type).map.get(handler);
            }
            var ref;
            if (!this.types.has(type)) {
                ref = { keys: new Set(), map: new WeakMap() };
                this.types.set(type, ref);
            }
            else {
                ref = this.types.get(type);
            }
            var listener = new EventListener(type, handler, this);
            ref.keys.add(handler);
            ref.map.set(handler, listener);
            return listener;
        };
        EventCollection.prototype.remove = function (type, handler) {
            if (!this.types)
                return;
            if (this.types.has(type) && this.types.get(type).keys.has(handler)) {
                var ref = this.types.get(type);
                ref.keys.delete(handler);
                ref.map.delete(handler);
            }
        };
        EventCollection.prototype.get = function (type) {
            if (!this.types)
                return null;
            var eventListeners = [];
            if (this.types.has(type)) {
                var ref = this.types.get(type);
                var map = ref.map;
                var values = ref.keys.values();
                while (true) {
                    var entry = values.next();
                    if (typeof entry.value === 'function') {
                        eventListeners.push(map.get(entry.value));
                    }
                    else {
                        break;
                    }
                }
            }
            return eventListeners;
        };
        EventCollection.prototype.destroy = function () {
            this.types.forEach(function (ref) {
                ref.keys.clear();
                if (ref.map.hasOwnProperty('clear'))
                    ref.map['clear']();
            });
            this.types.clear();
            this.types = null;
        };
        return EventCollection;
    }());
    var EventListener = (function () {
        function EventListener(_type, _listener, _collection) {
            this._type = _type;
            this._listener = _listener;
            this._collection = _collection;
        }
        Object.defineProperty(EventListener.prototype, "type", {
            get: function () {
                return this._type;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(EventListener.prototype, "listener", {
            get: function () {
                return this._listener;
            },
            enumerable: true,
            configurable: true
        });
        EventListener.prototype.remove = function () {
            if (this._collection)
                this._collection.remove(this._type, this._listener);
            this._type = null;
            this._listener = null;
            this._collection = null;
        };
        return EventListener;
    }());
});
//# sourceMappingURL=angular2-reflow.amd.js.map
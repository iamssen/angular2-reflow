# Sample: Event Bus

## Create `Context`
```
import * as reflow from 'angular2-reflow';

export class ContextFactory extends reflow.ContextFactory {
  mapDependency() {
    // mapping dependency
  }
}
```

## Dispatch event
```
import * as reflow from 'angular2-reflow';

class Class1 {
  constructor(@Inject(reflow.EVENT_BUS) private eventBus:reflow.EventBus) {
  }
  
  click() {
    this.eventBus.dispatchEvent(new Event('some-event'));
  }
}
```

## Listen event
```
import * as reflow from 'angular2-reflow';

class Class2 {
  constructor(@Inject(reflow.EVENT_BUS) private eventBus:reflow.EventBus) {
    eventBus.addEventListener('some-event', this.handler); 
  }
  
  handler(event) {
    console.log('!!!');
  }
}
```


# Sample: Command Mapping

## Create `Command`
```
import * as reflow from 'angular2-reflow';

export class Command1 implements reflow.Command {
  constructor(@Inject('service') private service:Service
              @Inject('model') private model:Model) {
  }

  execute(chain:reflow.CommandChain) {
    this.service.getData().then((result) => {
      this.model.data = result;
      chain.next();
    });
  }
}
```

## Mapping `Command` to `Context`
```
import * as reflow from 'angular2-reflow';
import {Command1, Command2} from './commands';

export class ContextFactory extends reflow.ContextFactory {
  mapDependency() {
    this.mapCommand('execute-commands', [Command1, Command2]);
  }
}
```

## Execute `Command`
```
import * as reflow from 'angular2-reflow';
import {ContextFactory} from './context';

let factory:reflow.ContextFactory = new ContextFactory;

@Component({
  selector: 'app-main',
  providers: [factory.providers]
})
class Main implements OnInit, OnDestroy {
  constructor(@Inject(reflow.CONTEXT) private context:reflow.Context,
              @Inject(reflow.EVENT_BUS) private eventBus:reflow.EventBus) {
  }
  
  ngOnInit() {
    this.context.start();
  }

  ngOnDestroy() {
    this.context.destroy();
  }
  
  click() {
    this.eventBus.dispatchEvent(new Event('execute-commands'));
  }
}
```

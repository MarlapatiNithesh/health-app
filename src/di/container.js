export class Container {
  constructor() {
    this.definitions = new Map();
    this.singletons = new Map();
    this.resolvingStack = new Set();
  }

  register(token, factory, { singleton = true } = {}) {
    this.definitions.set(token, {
      factory,
      singleton,
      isClass: false,
    });
    return this;
  }

  registerInstance(token, instance) {
    this.singletons.set(token, instance);
    this.definitions.set(token, {
      factory: () => instance,
      singleton: true,
      isClass: false,
    });
    return this;
  }

  registerClass(token, ClassConstructor, dependencyTokens = [], { singleton = true } = {}) {
    this.definitions.set(token, {
      ClassConstructor,
      dependencyTokens,
      singleton,
      isClass: true,
    });
    return this;
  }

  resolve(token) {
    if (this.singletons.has(token)) {
      return this.singletons.get(token);
    }

    const definition = this.definitions.get(token);
    if (!definition) {
      throw new Error(`[IoC Container] Dependency token "${token}" is not registered.`);
    }

    if (this.resolvingStack.has(token)) {
      const cycle = [...this.resolvingStack, token].join(' -> ');
      throw new Error(`[IoC Container] Circular dependency detected: ${cycle}`);
    }

    this.resolvingStack.add(token);
    let instance;

    try {
      if (definition.isClass) {
        const resolvedDeps = definition.dependencyTokens.map((depToken) => this.resolve(depToken));
        instance = new definition.ClassConstructor(...resolvedDeps);
      } else {
        instance = definition.factory(this);
      }
    } finally {
      this.resolvingStack.delete(token);
    }

    if (definition.singleton) {
      this.singletons.set(token, instance);
    }

    return instance;
  }

  has(token) {
    return this.definitions.has(token) || this.singletons.has(token);
  }

  clear() {
    this.definitions.clear();
    this.singletons.clear();
    this.resolvingStack.clear();
  }
}

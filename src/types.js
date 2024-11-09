class Agent {
  constructor({
    name = "Agent",
    model = "gpt-4o-mini",
    instructions = "You are a helpful agent.",
    functions = [],
    toolChoice = null,
    parallelToolCalls = true,
  } = {}) {
    this.name = name;
    this.model = model;
    this.instructions = instructions;
    this.functions = functions;
    this.toolChoice = toolChoice;
    this.parallelToolCalls = parallelToolCalls;
  }
}

class Result {
  constructor({ value = "", agent = null, contextVariables = {} } = {}) {
    this.value = value;
    this.agent = agent;
    this.contextVariables = contextVariables;
  }
}

class Response {
  constructor({ messages = [], agent = null, contextVariables = {} } = {}) {
    this.messages = messages;
    this.agent = agent;
    this.contextVariables = contextVariables;
  }
}

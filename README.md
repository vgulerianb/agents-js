# agents-js

`agents-js` is a JavaScript package designed to facilitate interaction with chat models, such as OpenAI's GPT models. It provides a structured way to define agents with specific instructions and functions, and it handles tool calls and context variables efficiently.

## Installation

To install `agents-js`, you can use npm:

```bash
npm install agents-js
```

## Usage

The primary classes provided by the `agents-js` package are `Agent`, `AgentController`, `Result`, and `Response`. Here, we'll walk through some basic usage examples.

### Example 1: Creating an Agent

```javascript
const { Agent } = require("agents-js");

// Define a simple agent with a name and instruction
const myAgent = new Agent({
  name: "MyAssistant",
  instructions: "You are a friendly assistant.",
  model: "gpt-4",
});

console.log(myAgent);
```

### Example 2: Initializing OpenAI Client and Using AgentController

Before using the `AgentController` class to interact with chat models, you need to initialize the OpenAI client with your API key.

```javascript
const OpenAI = require("openai");
const { AgentController, Agent } = require("agents-js");

// Initialize OpenAI client
const client = new OpenAI({
  apiKey: "sk-thekey", // Replace 'sk-thekey' with your actual API key
});

// Use the initialized client to create a AgentController instance
const agentController = new AgentController(client);

// Create an agent
const agent = new Agent({
  name: "Assistant",
  instructions: "You are a helpful assistant.",
  model: "gpt-4",
});

// Define a message history
const messages = [{ role: "user", content: "Hello, can you help me?" }];

// Fetch a chat completion
(async () => {
  const response = await agentController.run(agent, messages);
  console.log(response);
})();
```

### Example 3: Handling Tool Calls

You can define functions that the agent can call during its operation.

```javascript
const { AgentController, Agent, Result } = require("agents-js");

// Define a simple function that the agent can use
function add({ a, b }) {
  return new Result({ value: `${a + b}` });
}

// Initialize OpenAI client
const client = new OpenAI({
  apiKey: "sk-thekey", // Replace 'sk-thekey' with your actual API key
});

// Use the initialized client to create a AgentController instance
const agentController = new AgentController(client);

// Create an agent with the function
const agent = new Agent({
  name: "Calculator",
  instructions: "You can perform addition using the add function.",
  model: "gpt-4",
  functions: [add],
});

// Define a message history
const messages = [{ role: "user", content: "What is 2 + 3?" }];

// Fetch a chat completion
(async () => {
  const response = await agentController.run(agent, messages);
  console.log(response);
})();
```

### Example 4: Using Context Variables

Context variables allow the agent to maintain state across interactions.

```javascript
const { AgentController, Agent, Result } = require("agents-js");

// Define a function using context variables
function greet({ name }) {
  return new Result({ value: `Hello, ${name}!` });
}

// Initialize OpenAI client
const client = new OpenAI({
  apiKey: "sk-thekey", // Replace 'sk-thekey' with your actual API key
});

// Use the initialized client to create a AgentController instance
const agentController = new AgentController(client);

// Create an agent with the function
const agent = new Agent({
  name: "Greeter",
  instructions: "You can greet people using the greet function.",
  model: "gpt-4",
  functions: [greet],
});

// Define a message history and context variables
const messages = [{ role: "user", content: "Greet John for me." }];
const contextVariables = { name: "John" };

// Fetch a chat completion
(async () => {
  const response = await agentController.run(agent, messages, contextVariables);
  console.log(response);
})();
```

## Conclusion

`agents-js` provides a flexible framework for building conversational applications that can leverage external functions and maintain context across interactions. By defining agents and their capabilities, you can create powerful and dynamic chat applications.

---

Make sure to replace `"sk-thekey"` with your actual API key when using the OpenAI client in your application.

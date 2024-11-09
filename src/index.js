const { Agent, Result, Response } = require("./types");
const { debugPrint, mergeChunk, functionToJson } = require("./utils");
const CTX_VARS_NAME = "context_variables";

class AgentController {
  constructor(client = null) {
    this.client = client;
  }

  async getChatCompletion(
    agent,
    history,
    contextVariables,
    modelOverride,
    stream,
    debug
  ) {
    const defaultContextVars = new Proxy(
      {},
      {
        get: (target, prop) => (prop in target ? target[prop] : ""),
      }
    );

    const ctx = { ...defaultContextVars, ...contextVariables };
    const instructions =
      typeof agent.instructions === "function"
        ? agent.instructions(ctx)
        : agent.instructions;

    const messages = [{ role: "system", content: instructions }, ...history];

    debugPrint(debug, "Getting chat completion for...:", messages);

    const tools = agent.functions.map((f) => functionToJson(f));
    // Hide context_variables from model
    tools.forEach((tool) => {
      const params = tool.function.parameters;
      delete params.properties[CTX_VARS_NAME];
      const reqIndex = params.required.indexOf(CTX_VARS_NAME);
      if (reqIndex > -1) params.required.splice(reqIndex, 1);
    });

    const createParams = {
      model: modelOverride || agent.model,
      messages,
      tools: tools.length ? tools : undefined,
      tool_choice: agent.toolChoice,
      stream,
    };

    if (tools.length) {
      createParams.parallel_tool_calls = agent.parallelToolCalls;
    }

    return this.client.chat.completions.create(createParams);
  }

  handleFunctionResult(result, debug) {
    if (result instanceof Result) {
      return result;
    }

    if (result instanceof Agent) {
      return new Result({
        value: JSON.stringify({ assistant: result.name }),
        agent: result,
      });
    }

    try {
      return new Result({ value: String(result) });
    } catch (e) {
      const errorMessage = `Failed to cast response to string: ${result}. Make sure agent functions return a string or Result object. Error: ${e.message}`;
      debugPrint(debug, errorMessage);
      throw new TypeError(errorMessage);
    }
  }

  async handleToolCalls(toolCalls, functions, contextVariables, debug) {
    const functionMap = Object.fromEntries(functions.map((f) => [f.name, f]));

    const partialResponse = new Response({
      messages: [],
      contextVariables: {},
    });

    for (const toolCall of toolCalls) {
      const name = toolCall.function.name;

      if (!(name in functionMap)) {
        debugPrint(debug, `Tool ${name} not found in function map.`);
        partialResponse.messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          tool_name: name,
          content: `Error: Tool ${name} not found.`,
        });
        continue;
      }

      const args = JSON.parse(toolCall.function.arguments);
      debugPrint(debug, `Processing tool call: ${name} with arguments ${args}`);

      const func = functionMap[name];
      // Check if function expects context_variables
      const funcString = func.toString();
      if (funcString.includes(CTX_VARS_NAME)) {
        args[CTX_VARS_NAME] = contextVariables;
      }

      const rawResult = await func(args);
      const result = this.handleFunctionResult(rawResult, debug);

      partialResponse.messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        tool_name: name,
        content: result.value,
      });

      partialResponse.contextVariables = {
        ...partialResponse.contextVariables,
        ...result.contextVariables,
      };

      if (result.agent) {
        partialResponse.agent = result.agent;
      }
    }

    return partialResponse;
  }

  async *runAndStream(
    agent,
    messages,
    contextVariables = {},
    modelOverride = null,
    debug = false,
    maxTurns = Infinity,
    executeTools = true
  ) {
    let activeAgent = agent;
    const ctx = { ...contextVariables };
    const history = [...messages];
    const initLen = messages.length;

    while (history.length - initLen < maxTurns) {
      const message = {
        content: "",
        sender: agent.name,
        role: "assistant",
        function_call: null,
        tool_calls: new Proxy(
          {},
          {
            get: (target, prop) =>
              target[prop] || {
                function: { arguments: "", name: "" },
                id: "",
                type: "",
              },
          }
        ),
      };

      const completion = await this.getChatCompletion(
        activeAgent,
        history,
        ctx,
        modelOverride,
        true,
        debug
      );

      yield { delim: "start" };
      for await (const chunk of completion) {
        const delta = JSON.parse(chunk.choices[0].delta.toJSON());
        if (delta.role === "assistant") {
          delta.sender = activeAgent.name;
        }
        yield delta;
        delete delta.role;
        delete delta.sender;
        mergeChunk(message, delta);
      }
      yield { delim: "end" };

      message.tool_calls = Object.values(message.tool_calls);
      if (!message.tool_calls.length) {
        message.tool_calls = null;
      }

      debugPrint(debug, "Received completion:", message);
      history.push(message);

      if (!message.tool_calls || !executeTools) {
        debugPrint(debug, "Ending turn.");
        break;
      }

      const toolCalls = message.tool_calls.map((toolCall) => ({
        id: toolCall.id,
        function: {
          arguments: toolCall.function.arguments,
          name: toolCall.function.name,
        },
        type: toolCall.type,
      }));

      const partialResponse = await this.handleToolCalls(
        toolCalls,
        activeAgent.functions,
        ctx,
        debug
      );

      history.push(...partialResponse.messages);
      Object.assign(ctx, partialResponse.contextVariables);

      if (partialResponse.agent) {
        activeAgent = partialResponse.agent;
      }
    }

    yield {
      response: new Response({
        messages: history.slice(initLen),
        agent: activeAgent,
        contextVariables: ctx,
      }),
    };
  }

  async run(
    agent,
    messages,
    contextVariables = {},
    modelOverride = null,
    stream = false,
    debug = false,
    maxTurns = Infinity,
    executeTools = true
  ) {
    if (stream) {
      return this.runAndStream(
        agent,
        messages,
        contextVariables,
        modelOverride,
        debug,
        maxTurns,
        executeTools
      );
    }

    let activeAgent = agent;
    const ctx = { ...contextVariables };
    const history = [...messages];
    const initLen = messages.length;

    while (history.length - initLen < maxTurns && activeAgent) {
      const completion = await this.getChatCompletion(
        activeAgent,
        history,
        ctx,
        modelOverride,
        stream,
        debug
      );

      const message = completion.choices[0].message;
      debugPrint(debug, "Received completion:", message);
      message.sender = activeAgent.name;
      history.push(JSON.parse(JSON.stringify(message)));

      if (!message.tool_calls || !executeTools) {
        debugPrint(debug, "Ending turn.");
        break;
      }

      const partialResponse = await this.handleToolCalls(
        message.tool_calls,
        activeAgent.functions,
        ctx,
        debug
      );

      history.push(...partialResponse.messages);
      Object.assign(ctx, partialResponse.contextVariables);

      if (partialResponse.agent) {
        activeAgent = partialResponse.agent;
      }
    }

    return new Response({
      messages: history.slice(initLen),
      agent: activeAgent,
      contextVariables: ctx,
    });
  }
}

export { Agent, Result, Response, AgentController };

const debugPrint = (debug, ...args) => {
  if (!debug) return;
  const timestamp = new Date().toISOString();
  const message = args.join(" ");
  console.log(`[${timestamp}]`, message);
};

const mergeFields = (target, source) => {
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string") {
      target[key] = (target[key] || "") + value;
    } else if (value !== null && typeof value === "object") {
      target[key] = target[key] || {};
      mergeFields(target[key], value);
    }
  }
};

const mergeChunk = (finalResponse, delta) => {
  delete delta.role;
  mergeFields(finalResponse, delta);

  const toolCalls = delta.tool_calls;
  if (toolCalls?.length > 0) {
    const index = toolCalls[0].index;
    delete toolCalls[0].index;
    finalResponse.tool_calls = finalResponse.tool_calls || {};
    finalResponse.tool_calls[index] = finalResponse.tool_calls[index] || {
      function: { arguments: "", name: "" },
      id: "",
      type: "",
    };
    mergeFields(finalResponse.tool_calls[index], toolCalls[0]);
  }
};

const functionToJson = (func) => {
  // Parse JSDoc comments to get parameter types
  const funcString = func.toString();
  const docString = funcString.match(/\/\*\*\s*([\s\S]*?)\s*\*\//)?.[1] || "";
  const paramMatches = docString.match(/@param\s+{(\w+)}\s+(\w+)/g) || [];
  const description = docString.match(/@description\s+([\s\S]*)/)?.[1] || "";

  // Extract parameter names from function definition
  const paramsMap = {};

  paramMatches.forEach((paramMatch) => {
    const [_, type, name] = paramMatch.match(/@param\s+{(\w+)}\s+(\w+)/);
    paramsMap[name] = { type: type };
  });

  return {
    type: "function",
    function: {
      name: func.name,
      description: description,
      parameters: {
        type: "object",
        properties: paramsMap,
        required: Object.keys(paramsMap),
      },
    },
  };
};

module.exports = {
  debugPrint,
  mergeChunk,
  functionToJson,
};

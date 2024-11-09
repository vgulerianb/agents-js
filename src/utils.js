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
  const typeMap = {
    string: "string",
    number: "number",
    boolean: "boolean",
    object: "object",
    array: "array",
    null: "null",
  };

  // Get function parameters using reflection
  const params = {};
  const required = [];

  // Parse JSDoc comments to get parameter types
  const funcString = func.toString();
  const docString = funcString.match(/\/\*\*\s*([\s\S]*?)\s*\*\//)?.[1] || "";
  const paramMatches = docString.match(/@param\s+{(\w+)}\s+(\w+)/g) || [];

  // Extract parameter names from function definition
  const paramNames = funcString
    .match(/\(([^)]*)\)/)[1]
    .split(",")
    .map((param) => param.trim())
    .filter(Boolean);

  paramNames.forEach((paramName, index) => {
    const paramMatch = paramMatches[index];
    const type = paramMatch
      ? paramMatch.match(/@param\s+{(\w+)}/)[1]
      : "string";

    params[paramName] = { type: typeMap[type] || "string" };
    required.push(paramName);
  });

  return {
    type: "function",
    function: {
      name: func.name,
      description: docString.split("@param")[0].trim(),
      parameters: {
        type: "object",
        properties: params,
        required,
      },
    },
  };
};

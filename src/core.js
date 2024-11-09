const CTX_VARS_NAME = "context_variables";

class AgentController {
  constructor(client = null) {
    this.client = client || new OpenAI();
  }
}

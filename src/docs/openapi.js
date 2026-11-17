const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "XL Perfumes API",
    version: "1.0.0",
    description: "API documentation for XL Perfumes.",
  },
  servers: [{ url: "/", description: "Current API server" }],
  paths: {
    "/": {
      get: {
        operationId: "getApiStatus",
        summary: "Check API status",
        tags: ["Status"],
        responses: {
          200: {
            description: "The API is running.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["message"],
                  properties: {
                    message: { type: "string", example: "XL Perfumes API is running" },
                  },
                },
                example: { message: "XL Perfumes API is running" },
              },
            },
          },
        },
      },
    },
  },
  tags: [{ name: "Status", description: "API availability" }],
};

module.exports = openapiSpec;

const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "XL Perfumes API",
    version: "1.0.0",
    description: "API documentation for XL Perfumes.",
  },
  servers: [{ url: "/", description: "Current API server" }],
  paths: {
    "/api/auth/login": {
      post: {
        operationId: "login",
        summary: "Sign in and receive a JWT",
        tags: ["Authentication"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "password"],
                properties: {
                  username: { type: "string", example: "admin" },
                  password: { type: "string", format: "password" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "The JWT is returned and also set as an HttpOnly cookie.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["token", "user"],
                  properties: {
                    token: { type: "string" },
                    user: { $ref: "#/components/schemas/User" },
                  },
                },
              },
            },
          },
          401: { description: "Invalid credentials or inactive account." },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        operationId: "logout",
        summary: "Clear the login cookie",
        tags: ["Authentication"],
        responses: { 204: { description: "The session cookie was cleared." } },
      },
    },
    "/api/auth/me": {
      get: {
        operationId: "getCurrentUser",
        summary: "Get the current user",
        tags: ["Authentication"],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Current authenticated user.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { user: { $ref: "#/components/schemas/User" } },
                },
              },
            },
          },
          401: { description: "Authentication is required." },
        },
      },
    },
    "/api/users": {
      get: {
        operationId: "listUsers",
        summary: "List users",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Users without password hashes.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    users: { type: "array", items: { $ref: "#/components/schemas/User" } },
                  },
                },
              },
            },
          },
          403: { description: "Administrator access is required." },
        },
      },
      post: {
        operationId: "createUser",
        summary: "Create a user",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "password", "role"],
                properties: {
                  username: { type: "string", minLength: 3, maxLength: 50 },
                  password: { type: "string", minLength: 8, maxLength: 72, format: "password" },
                  role: { $ref: "#/components/schemas/UserRole" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "User created." },
          400: { description: "Invalid user data." },
          409: { description: "Username already exists." },
        },
      },
    },
    "/api/users/{id}": {
      patch: {
        operationId: "updateUser",
        summary: "Update a user",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        parameters: [{
          name: "id",
          in: "path",
          required: true,
          schema: { type: "integer" },
        }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  username: { type: "string", minLength: 3, maxLength: 50 },
                  password: { type: "string", minLength: 8, maxLength: 72, format: "password" },
                  role: { $ref: "#/components/schemas/UserRole" },
                  isActive: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "User updated." },
          404: { description: "User not found." },
          409: { description: "The change would leave no active administrator." },
        },
      },
      delete: {
        operationId: "deleteUser",
        summary: "Delete a user",
        tags: ["Users"],
        security: [{ bearerAuth: [] }],
        parameters: [{
          name: "id",
          in: "path",
          required: true,
          schema: { type: "integer" },
        }],
        responses: {
          204: { description: "User deleted." },
          404: { description: "User not found." },
          409: { description: "The user cannot be deleted." },
        },
      },
    },
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
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      UserRole: {
        type: "string",
        enum: ["admin", "spg", "collecting", "gudang", "owner"],
      },
      User: {
        type: "object",
        required: ["id", "username", "role", "isActive", "createdAt"],
        properties: {
          id: { type: "integer", example: 1 },
          username: { type: "string", example: "admin" },
          role: { $ref: "#/components/schemas/UserRole" },
          isActive: { type: "boolean", example: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
    },
  },
  tags: [
    { name: "Authentication", description: "Login and account session" },
    { name: "Users", description: "Administrator user management" },
    { name: "Status", description: "API availability" },
  ],
};

module.exports = openapiSpec;

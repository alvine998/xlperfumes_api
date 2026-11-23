const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "XL Perfumes API",
    version: "1.0.0",
    description: "API documentation for XL Perfumes.",
  },
  servers: [{ url: "/", description: "Current API server" }],
  paths: {
    "/api/telegram/webhook": {
      post: {
        operationId: "handleTelegramWebhook",
        summary: "Handle a Telegram bot update",
        tags: ["Telegram"],
        parameters: [{
          in: "header",
          name: "X-Telegram-Bot-Api-Secret-Token",
          required: true,
          schema: { type: "string" },
          description: "Secret configured when registering the Telegram webhook.",
        }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: {
                    type: "object",
                    properties: {
                      text: { type: "string" },
                      chat: {
                        type: "object",
                        properties: { id: { type: "integer", format: "int64" } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "The update was processed or ignored." },
          401: { description: "The webhook secret is missing or invalid." },
          429: { description: "The sender and IP have exceeded the request limit." },
          502: { description: "OpenAI or Telegram could not process the reply." },
          503: { description: "The integration is not configured." },
        },
      },
    },
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
    "/api/branches": {
      get: {
        operationId: "listBranches",
        summary: "List branches",
        tags: ["Branches"],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Branches with creator names and linked store counts." },
          403: { description: "Access to store management is required." },
        },
      },
      post: {
        operationId: "createBranch",
        summary: "Create a branch",
        tags: ["Branches"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/BranchInput" } } },
        },
        responses: { 201: { description: "Branch created." }, 400: { description: "Invalid branch data." } },
      },
    },
    "/api/branches/{id}": {
      patch: {
        operationId: "updateBranch",
        summary: "Update a branch",
        tags: ["Branches"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/BranchInput" } } } },
        responses: { 200: { description: "Branch updated." }, 404: { description: "Branch not found." } },
      },
      delete: {
        operationId: "deleteBranch",
        summary: "Delete an unused branch",
        tags: ["Branches"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          204: { description: "Branch deleted." },
          404: { description: "Branch not found." },
          409: { description: "Branch is still referenced by related data." },
        },
      },
    },
    "/api/zones": {
      get: {
        operationId: "listZones",
        summary: "List zones",
        tags: ["Zones"],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Zones with branch, creator, and linked store counts." },
          403: { description: "Access to store management is required." },
        },
      },
      post: {
        operationId: "createZone",
        summary: "Create a zone",
        tags: ["Zones"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ZoneInput" } } },
        },
        responses: {
          201: { description: "Zone created." },
          400: { description: "Invalid zone data." },
        },
      },
    },
    "/api/zones/collectors": {
      get: {
        operationId: "listZoneCollectors",
        summary: "List active collecting users for zone assignments",
        tags: ["Zones"],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Active collecting users eligible for zone membership or PIC." },
          403: { description: "Access to store management is required." },
        },
      },
    },
    "/api/zones/{id}": {
      get: {
        operationId: "getZoneDetail",
        summary: "Get a zone and its stores",
        tags: ["Zones"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          200: {
            description: "Zone details, its stores in route order, and unassigned stores from the same branch.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["zone", "stores", "availableStores"],
                  properties: {
                    zone: { $ref: "#/components/schemas/Zone" },
                    stores: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ZoneStore" },
                    },
                    availableStores: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ZoneStoreCandidate" },
                    },
                  },
                },
              },
            },
          },
          404: { description: "Zone not found." },
        },
      },
      patch: {
        operationId: "updateZone",
        summary: "Update an unused zone",
        tags: ["Zones"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ZoneInput" } } } },
        responses: {
          200: { description: "Zone updated." },
          404: { description: "Zone not found." },
          409: { description: "Zone is still referenced by a store." },
        },
      },
      delete: {
        operationId: "deleteZone",
        summary: "Delete an unused zone",
        tags: ["Zones"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          204: { description: "Zone deleted." },
          404: { description: "Zone not found." },
          409: { description: "Zone is still referenced by a store." },
        },
      },
    },
    "/api/zones/{id}/stores": {
      post: {
        operationId: "addStoresToZone",
        summary: "Add multiple unassigned same-branch stores to a zone",
        tags: ["Zones"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["storeIds"],
                properties: {
                  storeIds: {
                    type: "array",
                    minItems: 1,
                    uniqueItems: true,
                    items: { type: "integer", minimum: 1 },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Stores added to the zone." },
          400: { description: "Invalid stores or a store is not in the zone's branch." },
          404: { description: "Zone or a store was not found." },
          409: { description: "One or more stores are already assigned to a zone." },
        },
      },
    },
    "/api/zones/{id}/stores/order": {
      put: {
        operationId: "updateZoneStoreOrder",
        summary: "Update the ordered stores in a zone route",
        tags: ["Zones"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["storeIds"],
                properties: {
                  storeIds: { type: "array", items: { type: "integer" } },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Zone store order updated." },
          400: { description: "Invalid or outdated store order." },
          404: { description: "Zone not found." },
        },
      },
    },
    "/api/zones/{id}/stores/{storeId}": {
      post: {
        operationId: "addStoreToZone",
        summary: "Add an unassigned same-branch store to a zone",
        tags: ["Zones"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
          { name: "storeId", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          201: { description: "Store added to the zone." },
          400: { description: "Store is not in the zone's branch." },
          404: { description: "Zone or store not found." },
          409: { description: "Store is already assigned to a zone." },
        },
      },
      delete: {
        operationId: "removeStoreFromZone",
        summary: "Remove a store from a zone without deleting the store",
        tags: ["Zones"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
          { name: "storeId", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          204: { description: "Store removed from the zone." },
          404: { description: "Zone, store, or assignment not found." },
        },
      },
    },
    "/api/zones/{id}/users": {
      get: {
        operationId: "getZoneUsers",
        summary: "List users assigned to a zone",
        tags: ["Zones"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          200: { description: "Users assigned to the zone." },
          404: { description: "Zone not found." },
        },
      },
      put: {
        operationId: "updateZoneUsers",
        summary: "Replace a zone's collecting user assignments",
        tags: ["Zones"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["userIds"],
                properties: {
                  userIds: { type: "array", items: { type: "integer" } },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Zone user assignments updated." },
          400: { description: "Invalid user assignment." },
          404: { description: "Zone not found." },
        },
      },
    },
    "/api/stores": {
      get: {
        operationId: "listStores",
        summary: "List stores",
        tags: ["Stores"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
          { name: "start_date", in: "query", description: "Inclusive creation date in Asia/Jakarta (YYYY-MM-DD).", schema: { type: "string", format: "date" } },
          { name: "end_date", in: "query", description: "Inclusive creation date in Asia/Jakarta (YYYY-MM-DD).", schema: { type: "string", format: "date" } },
          { name: "store_name", in: "query", schema: { type: "string" } },
        ],
        responses: { 200: { description: "Stores ordered by creation date, with pagination metadata when filters or pagination parameters are supplied." }, 400: { description: "Invalid date filter." }, 403: { description: "The user does not have store access." } },
      },
      post: {
        operationId: "createStore",
        summary: "Create a store",
        tags: ["Stores"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/StoreInput" } } },
        },
        responses: {
          201: { description: "Store created." },
          400: { description: "Invalid store data or unsupported zone assignment." },
        },
      },
    },
    "/api/stores/{id}": {
      patch: {
        operationId: "updateStore",
        summary: "Update a store",
        tags: ["Stores"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/StoreInput" } } } },
        responses: {
          200: { description: "Store updated." },
          404: { description: "Store not found." },
          409: { description: "Remove the store from its zone before changing its branch." },
        },
      },
      delete: {
        operationId: "deleteStore",
        summary: "Delete a store",
        tags: ["Stores"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { 204: { description: "Store deleted." }, 404: { description: "Store not found." } },
      },
    },
    "/api/store-stock": {
      get: {
        operationId: "listStoreStock",
        summary: "List stock for every store",
        tags: ["Store stock"],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Stock totals for each store and product variant, including the last updater.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["stocks"],
                  properties: {
                    stocks: {
                      type: "array",
                      items: { $ref: "#/components/schemas/StoreVariantStock" },
                    },
                  },
                },
              },
            },
          },
          403: { description: "The account does not have inventory access." },
        },
      },
    },
    "/api/store-stock/{storeId}/receive": {
      post: {
        operationId: "receiveStoreStock",
        summary: "Transfer warehouse products into a store stock total",
        tags: ["Store stock"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "storeId", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["items"],
                properties: {
                  items: {
                    type: "array",
                    minItems: 1,
                    items: {
                      type: "object",
                      required: ["variantId", "quantity"],
                      properties: {
                        variantId: { type: "integer" },
                        quantity: { type: "integer", minimum: 1 },
                        notes: { type: "string", maxLength: 500 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Warehouse products were transferred and store stock totals updated." },
          400: { description: "Invalid quantities or insufficient matching products in the warehouse." },
          404: { description: "Store or variant not found." },
        },
      },
    },
    "/api/products": {
      get: {
        operationId: "listProducts",
        summary: "List products with optional filters",
        tags: ["Products"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["pending", "di_gudang", "di_toko", "di_spg", "di_collecting", "terjual", "rusak"] } },
          { name: "search", in: "query", description: "Search variant name or barcode.", schema: { type: "string" } },
          { name: "branchId", in: "query", schema: { type: "integer" } },
          { name: "startDate", in: "query", schema: { type: "string", format: "date" } },
          { name: "endDate", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: {
          200: { description: "Products sorted by most recently updated." },
          403: { description: "The account does not have inventory access." },
        },
      },
    },
    "/api/products/branches": {
      get: {
        operationId: "listProductBranches",
        summary: "List branches available for product filters",
        tags: ["Products"],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Branch identifiers and names." }, 403: { description: "The account does not have inventory access." } },
      },
    },
    "/api/products/generate": {
      post: {
        operationId: "generateProducts",
        summary: "Generate multiple products for a branch and variant",
        tags: ["Products"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: {
            type: "object",
            required: ["branchId", "variantId", "quantity"],
            properties: {
              branchId: { type: "integer", minimum: 1 },
              variantId: { type: "integer", minimum: 1 },
              quantity: { type: "integer", minimum: 1, maximum: 500 },
            },
          } } },
        },
        responses: {
          201: { description: "Products with unique barcodes were created in Pending status." },
          400: { description: "The variant is not assigned to the selected branch or the quantity is invalid." },
          403: { description: "The account does not have inventory access." },
          404: { description: "The branch or variant was not found." },
        },
      },
    },
    "/api/products/warehouse-movement": {
      post: {
        operationId: "moveWarehouseProducts",
        summary: "Move scanned products into or out of the warehouse",
        tags: ["Products"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: {
            type: "object",
            required: ["direction", "barcodes"],
            properties: {
              direction: { type: "string", enum: ["in", "out"] },
              barcodes: { type: "array", minItems: 1, maxItems: 500, items: { type: "string", maxLength: 120 } },
            },
          } } },
        },
        responses: {
          200: { description: "The scanned product status transitions were applied." },
          400: { description: "A barcode was not found or is not in the expected source status." },
          403: { description: "The account does not have inventory access." },
        },
      },
    },
    "/api/products/{id}": {
      get: {
        operationId: "getProduct",
        summary: "Get product details",
        tags: ["Products"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { 200: { description: "Product details and activity history matched by barcode." }, 404: { description: "Product not found." } },
      },
      delete: {
        operationId: "deleteProduct",
        summary: "Delete a product",
        tags: ["Products"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { 204: { description: "Product deleted." }, 404: { description: "Product not found." } },
      },
    },
    "/api/variants": {
      get: {
        operationId: "listVariants",
        summary: "List product variants, optionally filtered by branch",
        tags: ["Variants"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "branchId", in: "query", schema: { type: "integer", minimum: 1 } },
        ],
        responses: {
          200: { description: "Product variant records." },
          403: { description: "The account does not have inventory access." },
        },
      },
      post: {
        operationId: "createVariant",
        summary: "Create a product variant",
        tags: ["Variants"],
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/VariantInput" } } } },
        responses: { 201: { description: "Product variant created." }, 400: { description: "Invalid variant." } },
      },
    },
    "/api/variants/{id}": {
      patch: {
        operationId: "updateVariant",
        summary: "Update a product variant",
        tags: ["Variants"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/VariantInput" } } } },
        responses: { 200: { description: "Product variant updated." }, 400: { description: "Invalid variant." }, 404: { description: "Variant not found." } },
      },
      delete: {
        operationId: "deleteVariant",
        summary: "Delete a product variant",
        tags: ["Variants"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { 204: { description: "Product variant deleted." }, 404: { description: "Variant not found." } },
      },
    },
    "/api/store-stock/{storeId}/{variantId}": {
      patch: {
        operationId: "adjustStoreStock",
        summary: "Increase or decrease stock for a store variant",
        tags: ["Store stock"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "storeId", in: "path", required: true, schema: { type: "integer" } },
          { name: "variantId", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["direction", "quantity"],
                properties: {
                  direction: { type: "string", enum: ["increase", "decrease"] },
                  quantity: { type: "integer", minimum: 1 },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Updated stock and the authenticated updater.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    stock: { $ref: "#/components/schemas/StoreVariantStock" },
                  },
                },
              },
            },
          },
          400: { description: "Invalid adjustment." },
          403: { description: "The account does not have inventory access." },
          404: { description: "Store or variant not found." },
        },
      },
    },
    "/api/roles": {
      get: {
        operationId: "listRoles",
        summary: "List roles and feature access",
        tags: ["Roles"],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Roles with their feature permissions." },
          403: { description: "The account does not have role management access." },
        },
      },
    },
    "/api/roles/permissions": {
      put: {
        operationId: "updateRolePermissions",
        summary: "Update feature access for every role",
        tags: ["Roles"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["permissions"],
                properties: {
                  permissions: {
                    type: "object",
                    required: ["owner", "admin", "gudang", "collecting", "spg"],
                    properties: {
                      owner: { $ref: "#/components/schemas/FeaturePermissions" },
                      admin: { $ref: "#/components/schemas/FeaturePermissions" },
                      gudang: { $ref: "#/components/schemas/FeaturePermissions" },
                      collecting: { $ref: "#/components/schemas/FeaturePermissions" },
                      spg: { $ref: "#/components/schemas/FeaturePermissions" },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Feature permissions saved." },
          400: { description: "The permission matrix is invalid." },
          403: { description: "The account does not have role management access." },
          409: { description: "At least one active user must keep access to role management." },
        },
      },
    },
    "/api/activity-logs": {
      get: {
        operationId: "listActivityLogs",
        summary: "List activity logs",
        tags: ["Activity logs"],
        security: [{ bearerAuth: [] }],
        parameters: [{
          name: "limit",
          in: "query",
          required: false,
          schema: { type: "integer", minimum: 1, maximum: 500, default: 100 },
        }],
        responses: {
          200: {
            description: "Newest activity logs.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    activityLogs: { type: "array", items: { $ref: "#/components/schemas/ActivityLog" } },
                  },
                },
              },
            },
          },
          403: { description: "Administrator access is required." },
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
      FeaturePermissions: {
        type: "object",
        required: ["overview", "inventory", "sales", "stores", "users", "activity"],
        properties: {
          overview: { type: "boolean" },
          inventory: { type: "boolean" },
          sales: { type: "boolean" },
          stores: { type: "boolean" },
          users: { type: "boolean" },
          activity: { type: "boolean" },
        },
      },
      ActivityLog: {
        type: "object",
        required: ["id", "action", "entityType", "createdAt"],
        properties: {
          id: { type: "integer" },
          userId: { type: "integer", nullable: true },
          username: { type: "string", nullable: true },
          action: { type: "string", example: "create" },
          entityType: { type: "string", example: "store" },
          entityId: { type: "string", nullable: true },
          details: { type: "object", nullable: true, additionalProperties: true },
          ipAddress: { type: "string", nullable: true },
          userAgent: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
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
          permissions: { $ref: "#/components/schemas/FeaturePermissions" },
          isActive: { type: "boolean", example: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Branch: {
        type: "object",
        required: ["id", "name", "city", "address", "createdBy", "createdAt", "storeCount"],
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "Jakarta Selatan" },
          city: { type: "string", example: "Jakarta" },
          address: { type: "string", example: "Jl. Melawai, Jakarta Selatan" },
          createdBy: { type: "string", nullable: true, example: "admin" },
          createdAt: { type: "string", format: "date-time" },
          storeCount: { type: "integer", minimum: 0 },
        },
      },
      BranchInput: {
        type: "object",
        required: ["name", "city", "address"],
        properties: {
          name: { type: "string", maxLength: 120 },
          city: { type: "string", maxLength: 100 },
          address: { type: "string" },
        },
      },
      Zone: {
        type: "object",
        required: [
          "id",
          "name",
          "branchId",
          "branch",
          "userPicId",
          "picUsername",
          "createdBy",
          "createdAt",
          "storeCount",
          "memberCount",
        ],
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "Zona Jakarta Selatan" },
          branchId: { type: "integer", example: 1 },
          branch: { type: "string", example: "Jakarta Selatan" },
          userPicId: { type: "integer", nullable: true },
          picUsername: { type: "string", nullable: true },
          createdBy: { type: "string", nullable: true, example: "admin" },
          createdAt: { type: "string", format: "date-time" },
          storeCount: { type: "integer", minimum: 0 },
          memberCount: { type: "integer", minimum: 0 },
        },
      },
      ZoneInput: {
        type: "object",
        required: ["name", "branchId"],
        properties: {
          name: { type: "string", maxLength: 120 },
          branchId: { type: "integer", example: 1 },
          userPicId: { type: "integer", nullable: true },
        },
      },
      ZoneStore: {
        type: "object",
        required: [
          "id",
          "name",
          "branch",
          "address",
          "latitude",
          "longitude",
          "routeIndex",
          "createdAt",
        ],
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          branch: { type: "string" },
          address: { type: "string" },
          latitude: { type: "number", minimum: -90, maximum: 90 },
          longitude: { type: "number", minimum: -180, maximum: 180 },
          routeIndex: { type: "integer", minimum: 1 },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      ZoneStoreCandidate: {
        type: "object",
        required: [
          "id",
          "name",
          "branch",
          "branchId",
          "zonaId",
          "zona",
          "routeIndex",
          "address",
          "latitude",
          "longitude",
          "createdAt",
        ],
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          branch: { type: "string" },
          branchId: { type: "integer" },
          zonaId: { type: "integer", nullable: true },
          zona: { type: "string", nullable: true },
          routeIndex: { type: "integer", nullable: true },
          address: { type: "string" },
          latitude: { type: "number", minimum: -90, maximum: 90 },
          longitude: { type: "number", minimum: -180, maximum: 180 },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      StoreInput: {
        type: "object",
        required: ["name", "branch", "address", "latitude", "longitude"],
        properties: {
          name: { type: "string", maxLength: 120, example: "XL Perfumes Blok M" },
          branch: { type: "string", maxLength: 100, example: "Jakarta Selatan" },
          branchId: { type: "integer", nullable: true, example: 1 },
          address: { type: "string", example: "Jl. Melawai, Jakarta Selatan" },
          latitude: { type: "number", minimum: -90, maximum: 90 },
          longitude: { type: "number", minimum: -180, maximum: 180 },
        },
      },
      VariantInput: {
        type: "object",
        required: ["name", "quantity", "unit", "unitPrice", "branchId"],
        properties: {
          name: { type: "string", maxLength: 150, example: "Eau de Parfum 50 ml" },
          quantity: { type: "integer", minimum: 0, example: 24 },
          unit: { type: "string", maxLength: 40, example: "pcs" },
          unitPrice: { type: "number", minimum: 0, example: 125000 },
          branchId: { type: "integer", minimum: 1 },
        },
      },
      StoreStockUpdater: {
        type: "object",
        nullable: true,
        properties: {
          id: { type: "integer" },
          username: { type: "string" },
        },
      },
      StoreVariantStock: {
        type: "object",
        required: [
          "id",
          "storeId",
          "name",
          "branch",
          "variantId",
          "variantName",
          "variantQuantity",
          "variantUnit",
          "totalStock",
          "lastUpdate",
          "updatedBy",
        ],
        properties: {
          id: { type: "string", example: "1:2" },
          storeId: { type: "integer" },
          name: { type: "string" },
          branch: { type: "string" },
          variantId: { type: "integer" },
          variantName: { type: "string" },
          variantQuantity: { type: "integer" },
          variantUnit: { type: "string" },
          totalStock: { type: "integer", minimum: 0 },
          lastUpdate: { type: "string", format: "date-time", nullable: true },
          updatedBy: { $ref: "#/components/schemas/StoreStockUpdater" },
        },
      },
    },
  },
  tags: [
    { name: "Authentication", description: "Login and account session" },
    { name: "Users", description: "Administrator user management" },
    { name: "Branches", description: "Branch location management" },
    { name: "Roles", description: "Role based access control by feature" },
    { name: "Stores", description: "Store locations and records" },
    { name: "Store stock", description: "Variant stock levels per store" },
    { name: "Variants", description: "Product variant catalog" },
    { name: "Status", description: "API availability" },
  ],
};

module.exports = openapiSpec;

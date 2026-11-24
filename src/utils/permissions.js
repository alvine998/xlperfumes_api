const ROLE_SLUGS = ["admin", "spg", "collecting", "gudang", "owner"];

const FEATURE_KEYS = [
  "overview",
  "store_inventory",
  "warehouse_inventory",
  "variants",
  "products",
  "generate_product",
  "print_product_barcodes",
  "branchs",
  "zonas",
  "stores",
  "store_visit",
  "print_store_barcodes",
  "users",
  "roles",
  "activity_logs",
];

const DEFAULT_FEATURE_PERMISSIONS = Object.fromEntries(
  FEATURE_KEYS.map((feature) => [feature, true]),
);

const DEFAULT_PERMISSIONS = Object.fromEntries(
  ROLE_SLUGS.map((slug) => [slug, { ...DEFAULT_FEATURE_PERMISSIONS }]),
);

const LEGACY_FEATURES = {
  inventory: [
    "store_inventory",
    "warehouse_inventory",
    "variants",
    "products",
    "generate_product",
    "print_product_barcodes",
  ],
  stores: ["branchs", "zonas", "store_visit", "print_store_barcodes"],
  users: ["roles"],
  activity: ["activity_logs"],
};

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRolePermissions(value, roleSlug) {
  const source = isRecord(value) ? value : {};
  const defaults = DEFAULT_PERMISSIONS[roleSlug] ?? {};
  const permissions = Object.fromEntries(
    FEATURE_KEYS.map((feature) => [
      feature,
      typeof source[feature] === "boolean"
        ? source[feature]
        : defaults[feature] ?? false,
    ]),
  );

  for (const [legacyFeature, features] of Object.entries(LEGACY_FEATURES)) {
    if (typeof source[legacyFeature] !== "boolean") continue;
    for (const feature of features) {
      if (typeof source[feature] !== "boolean") {
        permissions[feature] = source[legacyFeature];
      }
    }
  }

  return permissions;
}

module.exports = {
  FEATURE_KEYS,
  ROLE_SLUGS,
  DEFAULT_PERMISSIONS,
  normalizeRolePermissions,
};

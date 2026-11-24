const { Op } = require("sequelize");
const Branch = require("../models/branch");
const Store = require("../models/store");
const StoreStock = require("../models/store-stock");
const Variant = require("../models/variant");

const MAX_SEARCH_TERMS = 8;
const MAX_VARIANT_MATCHES = 6;
const MAX_STORE_MATCHES = 6;

const STOP_WORDS = new Set([
  "ada", "all", "any", "apa", "apakah", "atau", "available", "bagaimana", "berapa",
  "bisa", "branch", "branches", "buat", "cari", "can", "catalog", "catalogue",
  "do", "does", "dan", "dari", "di", "dong", "dengan", "everything", "find", "for",
  "fragrance", "fragrances", "have", "harga", "how", "info", "in", "ini", "is", "itu",
  "jual", "ke", "kah", "kan", "kayak", "list", "lokasi", "mau", "my", "of",
  "on", "our", "perfume", "perfumes", "price", "produk", "product", "products", "saya",
  "shop", "shops", "show", "stok", "store", "stores", "tell", "the", "to", "tolong",
  "toko", "untuk", "varian", "what", "where", "which", "yang", "you", "your",
]);

function getSearchTerms(value) {
  if (typeof value !== "string") return [];
  const terms = value.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  return [...new Set(terms)]
    .filter((term) => (term.length > 1 || /^\d+$/.test(term)) && !STOP_WORDS.has(term))
    .slice(0, MAX_SEARCH_TERMS);
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function likePatterns(terms) {
  return terms.map((term) => `%${escapeLike(term)}%`);
}

function getSizeSearchClauses(query) {
  const sizeMatches = [...query.matchAll(/(\d+(?:[.,]\d+)?)\s*(ml|kg|g|l|oz)\b/gi)];
  return sizeMatches.map(([, rawQuantity, rawUnit]) => ({
    [Op.and]: [
      { quantity: Number(rawQuantity.replace(",", ".")) },
      { unit: { [Op.like]: `%${escapeLike(rawUnit)}%` } },
    ],
  }));
}

function isBroadCatalogQuery(query) {
  const normalized = query.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return normalized.length === 0 ||
    /^(?:(?:show|list|what|which|tell me|do you have)(?:\s+me)?\s+)?(?:all\s+)?(?:our\s+)?(?:products?|variants?|catalog(?:ue)?|range|selection)(?:\s+(?:do you have|are available|available))?$/.test(normalized);
}

function scoreMatch(terms, fields, phrase) {
  const normalizedPhrase = phrase.trim().toLowerCase();
  const normalizedFields = fields.map(([value]) => String(value || "").toLowerCase());
  let score = 0;

  for (const term of terms) {
    fields.forEach(([value, weight], index) => {
      if (normalizedFields[index].includes(term)) score += weight;
    });
  }

  const combined = normalizedFields.join(" ");
  if (normalizedPhrase && combined.includes(normalizedPhrase)) score += 8;
  if (terms.length > 1 && terms.every((term) => combined.includes(term))) score += 5;
  return score;
}

async function findMatchingVariants(query) {
  const terms = getSearchTerms(query);
  const sizeClauses = getSizeSearchClauses(query);
  if (terms.length === 0 && sizeClauses.length === 0) {
    if (!isBroadCatalogQuery(query)) return [];
    const variants = await Variant.findAll({
      attributes: ["id", "name", "quantity", "unit", "unitPrice", "branchId"],
      include: [{ model: Branch, as: "branchRecord", attributes: ["name", "city"] }],
      order: [["name", "ASC"]],
      limit: MAX_VARIANT_MATCHES,
    });
    return variants.map((variant) => variant.get({ plain: true }));
  }

  const patterns = likePatterns(terms);
  const variants = await Variant.findAll({
    attributes: ["id", "name", "quantity", "unit", "unitPrice", "branchId"],
    include: [{ model: Branch, as: "branchRecord", attributes: ["name", "city"] }],
    where: {
      [Op.or]: [
        ...patterns.map((pattern) => ({ name: { [Op.like]: pattern } })),
        ...patterns.map((pattern) => ({ "$branchRecord.name$": { [Op.like]: pattern } })),
        ...patterns.map((pattern) => ({ "$branchRecord.city$": { [Op.like]: pattern } })),
        ...sizeClauses,
      ],
    },
    order: [["name", "ASC"]],
    limit: 36,
    subQuery: false,
    distinct: true,
  });

  return variants
    .map((variant) => {
      const row = variant.get({ plain: true });
      return {
        row,
        score: scoreMatch(terms, [
          [row.name, 5],
          [`${row.quantity}${row.unit}`, 4],
          [row.branchRecord?.name, 2],
          [row.branchRecord?.city, 2],
        ], query),
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.row.name.localeCompare(right.row.name))
    .slice(0, MAX_VARIANT_MATCHES)
    .map(({ row }) => row);
}

function publicVariant(variant) {
  return {
    name: variant.name,
    size: `${variant.quantity} ${variant.unit}`,
    price: String(variant.unitPrice),
    currency: "IDR",
    branch: variant.branchRecord
      ? { name: variant.branchRecord.name, city: variant.branchRecord.city }
      : null,
  };
}

async function searchProducts(query) {
  const matches = await findMatchingVariants(query);
  return {
    source: "XL Perfumes variant catalog",
    retrievedAt: new Date().toISOString(),
    query,
    resultLimit: MAX_VARIANT_MATCHES,
    matches: matches.map(publicVariant),
  };
}

async function searchStores(query, variantQuery = "") {
  const terms = getSearchTerms(query);
  const variants = getSearchTerms(variantQuery).length > 0 || getSizeSearchClauses(variantQuery).length > 0
    ? await findMatchingVariants(variantQuery)
    : [];
  const patterns = likePatterns(terms);
  let broadStockRows = [];
  let storeWhere;
  let storeLimit = 36;
  if (terms.length > 0) {
    storeWhere = {
      [Op.or]: [
        ...patterns.map((pattern) => ({ name: { [Op.like]: pattern } })),
        ...patterns.map((pattern) => ({ branch: { [Op.like]: pattern } })),
        ...patterns.map((pattern) => ({ address: { [Op.like]: pattern } })),
        ...patterns.map((pattern) => ({ "$branchRecord.name$": { [Op.like]: pattern } })),
        ...patterns.map((pattern) => ({ "$branchRecord.city$": { [Op.like]: pattern } })),
      ],
    };
  } else {
    storeLimit = MAX_STORE_MATCHES;
    if (variants.length > 0) {
      broadStockRows = await StoreStock.findAll({
        attributes: ["storeId", "variantId", "totalStock", "updatedAt"],
        where: { variantId: { [Op.in]: variants.map((variant) => variant.id) } },
        order: [["updatedAt", "DESC"]],
        limit: MAX_STORE_MATCHES * MAX_VARIANT_MATCHES,
        raw: true,
      });
      const storeIds = [...new Set(broadStockRows.map((stock) => stock.storeId))]
        .slice(0, MAX_STORE_MATCHES);
      if (storeIds.length > 0) storeWhere = { id: { [Op.in]: storeIds } };
    }
  }

  const stores = await Store.findAll({
    attributes: ["id", "name", "branch", "address", "branchId"],
    include: [{ model: Branch, as: "branchRecord", attributes: ["name", "city"] }],
    ...(storeWhere ? { where: storeWhere } : {}),
    order: [["name", "ASC"]],
    limit: storeLimit,
    subQuery: false,
    distinct: true,
  });

  const candidates = stores
    .map((store) => {
      const row = store.get({ plain: true });
      return {
        row,
        score: scoreMatch(terms, [
          [row.name, 5],
          [row.branch, 3],
          [row.address, 1],
          [row.branchRecord?.name, 3],
          [row.branchRecord?.city, 3],
        ], query),
      };
    });
  const rankedStores = terms.length > 0
    ? candidates
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score || left.row.name.localeCompare(right.row.name))
      .slice(0, MAX_STORE_MATCHES)
    : candidates.slice(0, MAX_STORE_MATCHES);

  const stockByPair = new Map();
  for (const stock of broadStockRows) {
    stockByPair.set(`${stock.storeId}:${stock.variantId}`, stock);
  }
  if (rankedStores.length > 0 && variants.length > 0) {
    const stocks = broadStockRows.length > 0
      ? []
      : await StoreStock.findAll({
      attributes: ["storeId", "variantId", "totalStock", "updatedAt"],
      where: {
        storeId: { [Op.in]: rankedStores.map(({ row }) => row.id) },
        variantId: { [Op.in]: variants.map((variant) => variant.id) },
      },
      order: [["updatedAt", "DESC"]],
      raw: true,
    });
    for (const stock of stocks) {
      stockByPair.set(`${stock.storeId}:${stock.variantId}`, stock);
    }
  }

  return {
    source: "XL Perfumes store directory and recorded store stock",
    retrievedAt: new Date().toISOString(),
    query,
    resultLimit: MAX_STORE_MATCHES,
    matches: rankedStores.map(({ row }) => ({
      name: row.name,
      branch: row.branchRecord
        ? { name: row.branchRecord.name, city: row.branchRecord.city }
        : row.branch,
      address: row.address,
      stock: variants.map((variant) => {
        const recorded = stockByPair.get(`${row.id}:${variant.id}`);
        return recorded
          ? {
            variant: publicVariant(variant),
            recordedUnits: Number(recorded.totalStock),
            lastUpdated: recorded.updatedAt,
          }
          : null;
      }).filter(Boolean),
    })),
    stockNote: variants.length > 0
      ? "Stock entries are operational records and may not reflect a live physical count. An omitted variant has no recorded count for that returned store. When no location is specified, at most six stores with the most recently updated stock records are returned; absence from that list does not prove there is no stock elsewhere."
      : undefined,
  };
}

module.exports = { searchProducts, searchStores };

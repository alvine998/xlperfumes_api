const { timingSafeEqual } = require("node:crypto");

const TELEGRAM_MESSAGE_LIMIT = 4096;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 50;
const requestTimestamps = new Map();
const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful assistant for XL Perfumes. Do not invent product availability, prices, or order status. If you do not know something, say so and direct the customer to contact the shop.";

const cleanupRateLimitEntries = setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  for (const [key, timestamps] of requestTimestamps) {
    while (timestamps.length > 0 && timestamps[0] <= cutoff) {
      timestamps.shift();
    }
    if (timestamps.length === 0) requestTimestamps.delete(key);
  }
}, RATE_LIMIT_WINDOW_MS);
cleanupRateLimitEntries.unref();

function isValidWebhookSecret(providedSecret, expectedSecret) {
  if (typeof providedSecret !== "string") {
    return false;
  }
  const provided = Buffer.from(providedSecret);
  const expected = Buffer.from(expectedSecret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

function getRateLimitRetryAfter(ip, userId) {
  const key = JSON.stringify([ip, userId]);
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = requestTimestamps.get(key) || [];

  while (timestamps.length > 0 && timestamps[0] <= cutoff) {
    timestamps.shift();
  }

  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestTimestamps.set(key, timestamps);
    return Math.max(1, Math.ceil((timestamps[0] + RATE_LIMIT_WINDOW_MS - now) / 1000));
  }

  timestamps.push(now);
  requestTimestamps.set(key, timestamps);
  return null;
}

function upstreamError(service, cause) {
  const error = new Error(`${service} request failed.`, { cause });
  error.statusCode = 502;
  return error;
}

async function postJson(url, body, headers, service) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    throw upstreamError(service, error);
  }

  if (!response.ok) {
    throw upstreamError(`${service} (HTTP ${response.status})`);
  }

  try {
    return await response.json();
  } catch (error) {
    throw upstreamError(`${service} returned invalid JSON`, error);
  }
}

function splitTelegramMessage(text) {
  const chunks = [];
  let remaining = text;

  while (remaining.length > TELEGRAM_MESSAGE_LIMIT) {
    let end = remaining.lastIndexOf("\n", TELEGRAM_MESSAGE_LIMIT);
    if (end < TELEGRAM_MESSAGE_LIMIT / 2) {
      end = remaining.lastIndexOf(" ", TELEGRAM_MESSAGE_LIMIT);
    }
    if (end < TELEGRAM_MESSAGE_LIMIT / 2) {
      end = TELEGRAM_MESSAGE_LIMIT;
    }
    if (
      end < remaining.length &&
      /[\uD800-\uDBFF]/.test(remaining[end - 1]) &&
      /[\uDC00-\uDFFF]/.test(remaining[end])
    ) {
      end -= 1;
    }

    chunks.push(remaining.slice(0, end));
    remaining = remaining.slice(end).trimStart();
  }

  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

async function generateReply(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  const data = await postJson(
    "https://api.openai.com/v1/chat/completions",
    {
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: process.env.OPENAI_SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      max_tokens: 800,
    },
    { Authorization: `Bearer ${apiKey}` },
    "OpenAI",
  );
  const reply = data.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || reply.trim().length === 0) {
    throw upstreamError("OpenAI returned no reply");
  }
  return reply.trim();
}

async function sendTelegramMessage(chatId, text) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  for (const chunk of splitTelegramMessage(text)) {
    const data = await postJson(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      { chat_id: chatId, text: chunk },
      {},
      "Telegram",
    );
    if (data.ok !== true) {
      throw upstreamError("Telegram rejected the message");
    }
  }
}

async function handleTelegramWebhook(req, res) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expectedSecret || !/^[A-Za-z0-9_-]{1,256}$/.test(expectedSecret)) {
    return res.status(503).json({ error: "Telegram webhook is not configured." });
  }

  if (!isValidWebhookSecret(req.get("x-telegram-bot-api-secret-token"), expectedSecret)) {
    return res.status(401).json({ error: "Invalid webhook secret." });
  }

  const message = req.body?.message;
  if (
    !message ||
    message.from?.is_bot ||
    typeof message.text !== "string" ||
    !Number.isSafeInteger(message.chat?.id) ||
    message.text.trim().length === 0
  ) {
    return res.sendStatus(200);
  }

  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: "Telegram AI integration is not configured." });
  }

  const userId = Number.isSafeInteger(message.from?.id) ? message.from.id : message.chat.id;
  const retryAfter = getRateLimitRetryAfter(req.ip || req.socket.remoteAddress, userId);
  if (retryAfter !== null) {
    res.set("Retry-After", String(retryAfter));
    return res.status(429).json({
      error: "Rate limit exceeded. Try again later.",
      retryAfterSeconds: retryAfter,
    });
  }

  const reply = await generateReply(message.text);
  await sendTelegramMessage(message.chat.id, reply);
  res.sendStatus(200);
}

module.exports = { handleTelegramWebhook };

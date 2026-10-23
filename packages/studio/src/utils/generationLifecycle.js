const SUCCESS_STATUSES = new Set(["completed", "succeeded", "success"]);
const FAILURE_STATUSES = new Set(["failed", "error", "cancelled", "canceled"]);

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function getGenerationErrorDetail(result) {
  if (typeof result?.error === "string") return result.error;
  if (typeof result?.error?.message === "string") return result.error.message;
  if (typeof result?.message === "string") return result.message;
  return "Unknown error";
}

function createGenerationError(result, requestId) {
  const error = new Error(`Generation failed: ${getGenerationErrorDetail(result)}`);
  error.requestId = requestId;
  error.generationResult = result;
  return error;
}

export function appendGenerationRefundNotice(message, error) {
  const cost = error?.generationResult?.cost;
  if (cost?.refunded !== true) return message;

  const credits = cost.amount_credits;
  const notice = Number.isFinite(credits)
    ? `Refunded ${credits} credit${credits === 1 ? "" : "s"}.`
    : "The generation cost was refunded.";
  return `${message} ${notice}`;
}

export function nextPollDelay(attempt, { initial = 2000, max = 30000, factor = 1.5 } = {}) {
  return Math.min(max, Math.round(initial * factor ** (attempt - 1)));
}

export async function pollForGenerationResult({
  baseUrl,
  requestId,
  apiKey,
  maxAttempts = 900,
  interval = 2000,
  maxInterval = 30000,
  onAuthRequired,
  fetchImpl = fetch,
  waitImpl = wait,
}) {
  const pollUrl = `${baseUrl}/api/v1/predictions/${requestId}/result`;

  // Same total wait budget as a fixed-interval loop (maxAttempts × interval), but
  // the gap between polls backs off exponentially from `interval` to `maxInterval`.
  const budgetMs = maxAttempts * interval;
  let waitedMs = 0;

  for (let attempt = 1; waitedMs < budgetMs; attempt++) {
    const delay = Math.min(nextPollDelay(attempt, { initial: interval, max: maxInterval }), budgetMs - waitedMs);
    await waitImpl(delay);
    waitedMs += delay;
    const isLastAttempt = waitedMs >= budgetMs;

    let response;
    try {
      response = await fetchImpl(pollUrl, {
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      });
    } catch (error) {
      if (isLastAttempt) throw error;
      continue;
    }

    if (!response.ok) {
      const detail = await response.text();
      const error = new Error(`Poll Failed: ${response.status} - ${detail.slice(0, 100)}`);
      error.requestId = requestId;

      if (response.status >= 500 && !isLastAttempt) continue;
      onAuthRequired?.(response.status, detail);
      throw error;
    }

    let result;
    try {
      result = await response.json();
    } catch (error) {
      if (isLastAttempt) throw error;
      continue;
    }

    const status = result.status?.toLowerCase();
    if (SUCCESS_STATUSES.has(status)) return result;
    if (FAILURE_STATUSES.has(status)) throw createGenerationError(result, requestId);
  }

  const error = new Error(`Generation timed out after polling. Request ID: ${requestId}`);
  error.requestId = requestId;
  throw error;
}

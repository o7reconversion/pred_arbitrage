const statusEl = document.getElementById("status");
const listEl = document.getElementById("market-list");
const refreshButton = document.getElementById("refresh");
const pairForm = document.getElementById("pair-form");
const leftProviderSelect = document.getElementById("left-provider");
const rightProviderSelect = document.getElementById("right-provider");
const leftIdInput = document.getElementById("left-id");
const rightIdInput = document.getElementById("right-id");
const leftLinkInput = document.getElementById("left-link");
const rightLinkInput = document.getElementById("right-link");
const pairListEl = document.getElementById("pair-list");
const clearPairsButton = document.getElementById("clear-pairs");

const API_HOST = window.location.hostname || "localhost";
const API_BASE = `${window.location.protocol}//${API_HOST}:8000/api/markets`;
const PAIRS_API = `${window.location.protocol}//${API_HOST}:8000/api/pairs`;
const STORAGE_KEY = "monitor.marketPairs";

let trackedPairs = [];

function setStatus(message) {
  statusEl.textContent = message;
}

function providerLabel(provider) {
  return provider === "limitless" ? "Limitless" : "Polymarket";
}

function formatPrice(value) {
  if (value === null || value === undefined) {
    return "-";
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return "-";
  }
  return numeric.toFixed(3);
}

async function loadPairs() {
  try {
    const response = await fetch(PAIRS_API);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (Array.isArray(payload.pairs)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload.pairs));
      return payload.pairs;
    }
  } catch (error) {
    console.warn("Failed to load saved pairs from server", error);
  }

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    return [];
  }
}

function savePairs() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trackedPairs));
  persistPairs();
}

async function persistPairs() {
  try {
    const response = await fetch(PAIRS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairs: trackedPairs })
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    console.warn("Failed to persist pairs on server", error);
  }
}

function parseMarketInput(provider, value) {
  const raw = value.trim();
  if (!raw) {
    return { id: "", link: "" };
  }

  let link = "";
  let id = raw;

  if (raw.startsWith("http")) {
    link = raw;
    try {
      const url = new URL(raw);
      if (provider === "limitless") {
        const marketParam = url.searchParams.get("market");
        if (marketParam) {
          id = marketParam;
        } else {
          const parts = url.pathname.split("/").filter(Boolean);
          id = parts[parts.length - 1] || raw;
        }
      } else {
        const parts = url.pathname.split("/").filter(Boolean);
        const eventIndex = parts.indexOf("event");
        const marketIndex = parts.indexOf("market");
        if (eventIndex >= 0 && parts[eventIndex + 1]) {
          id = parts[eventIndex + 1];
        } else if (marketIndex >= 0 && parts[marketIndex + 1]) {
          id = parts[marketIndex + 1];
        }
      }
    } catch (error) {
      id = raw;
    }
  }

  return { id, link };
}

function applyOptionalLink(provider, parsed, linkValue) {
  const link = linkValue.trim();
  if (provider === "polymarket" && link) {
    return { ...parsed, link };
  }
  return parsed;
}

function renderPairs() {
  pairListEl.innerHTML = "";
  trackedPairs.forEach((pair, index) => {
    const chip = document.createElement("span");
    chip.className = "slug-chip";
    chip.textContent = `${providerLabel(pair.left.provider)}:${pair.left.id} ↔ ${providerLabel(
      pair.right.provider
    )}:${pair.right.id}`;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "移除";
    remove.addEventListener("click", () => {
      trackedPairs = trackedPairs.filter((_, idx) => idx !== index);
      savePairs();
      renderPairs();
      loadMarkets();
    });

    chip.append(remove);
    pairListEl.appendChild(chip);
  });
}

function extractMarketView(market) {
  const outcomes = Array.isArray(market.outcomes) ? market.outcomes : [];
  const bids = Array.isArray(market.outcomeBids) ? market.outcomeBids : [];
  const asks = Array.isArray(market.outcomeAsks) ? market.outcomeAsks : [];
  return { outcomes, bids, asks };
}

function buildMarketCard(market, linkUrl) {
  const { outcomes, bids, asks } = extractMarketView(market);
  const card = document.createElement("div");
  card.className = "market";

  const title = document.createElement("div");
  title.className = "market-title";
  title.textContent = market.question || market.title || market.slug || "未命名市场";

  const meta = document.createElement("div");
  meta.className = "market-meta";
  const metaParts = [];
  if (market.expirationDate) {
    metaParts.push(`结束: ${market.expirationDate}`);
  }
  if (market.endDate) {
    metaParts.push(`结束: ${market.endDate}`);
  }
  metaParts.push(`ID: ${market.id || "-"}`);
  meta.textContent = metaParts.join(" · ");

  const link = document.createElement("a");
  link.className = "market-link";
  link.target = "_blank";
  link.rel = "noopener";
  if (linkUrl) {
    link.href = linkUrl;
    link.textContent = "打开市场";
  } else {
    link.href = "";
    link.textContent = "暂无链接";
    link.classList.add("market-link-disabled");
  }

  const priceRow = document.createElement("div");
  priceRow.className = "price-grid";
  if (outcomes.length === 0) {
    const empty = document.createElement("span");
    empty.className = "market-meta";
    empty.textContent = "暂无价格数据";
    priceRow.append(empty);
  } else {
    const header = document.createElement("div");
    header.className = "price-row price-header";
    header.innerHTML = "<span></span><span>Yes</span><span>No</span>";
    priceRow.append(header);

    const askRow = document.createElement("div");
    askRow.className = "price-row";
    askRow.innerHTML = `<span>Ask</span><span>${formatPrice(asks[0])}</span><span>${formatPrice(
      asks[1]
    )}</span>`;
    priceRow.append(askRow);

    const bidRow = document.createElement("div");
    bidRow.className = "price-row";
    bidRow.innerHTML = `<span>Bid</span><span>${formatPrice(bids[0])}</span><span>${formatPrice(
      bids[1]
    )}</span>`;
    priceRow.append(bidRow);
  }

  const parity = document.createElement("div");
  parity.className = "market-meta";
  if (outcomes.length >= 2) {
    const yesAsk = Number(asks[0]);
    const noAsk = Number(asks[1]);
    if (!Number.isNaN(yesAsk) && !Number.isNaN(noAsk)) {
      const sum = yesAsk + noAsk;
      const edge = 1 - sum;
      if (edge > 0) {
        parity.textContent = `Yes+No Ask=${sum.toFixed(3)}，可执行价差=${edge.toFixed(3)}`;
      } else {
        parity.textContent = `Yes+No Ask=${sum.toFixed(3)}`;
      }
    }
  }

  card.append(title, meta, link, priceRow);
  if (parity.textContent) {
    card.append(parity);
  }
  return card;
}

function buildComparison(leftMarket, rightMarket) {
  const left = extractMarketView(leftMarket);
  const right = extractMarketView(rightMarket);
  const container = document.createElement("div");
  container.className = "pair-metric";

  const lines = [];
  const leftCount = Math.max(left.outcomes.length, 2);
  const rightCount = Math.max(right.outcomes.length, 2);

  for (let i = 0; i < leftCount; i += 1) {
    for (let j = 0; j < rightCount; j += 1) {
      const leftLabel = left.outcomes[i] || `Outcome ${i + 1}`;
      const rightLabel = right.outcomes[j] || `Outcome ${j + 1}`;
      const leftNorm = String(leftLabel).trim().toLowerCase();
      const rightNorm = String(rightLabel).trim().toLowerCase();
      if (leftNorm && leftNorm === rightNorm) {
        continue;
      }
      const leftAsk = Number(left.asks[i]);
      const rightAsk = Number(right.asks[j]);

      if (Number.isNaN(leftAsk) || Number.isNaN(rightAsk)) {
        continue;
      }

      const sum = leftAsk + rightAsk;
      const edge = 1 - sum;
      if (edge > 0) {
        lines.push(`L买${leftLabel} + R买${rightLabel}: 价差=${edge.toFixed(3)}`);
      }
    }
  }

  if (lines.length === 0) {
    container.textContent = "暂无可执行价差";
    return container;
  }

  const title = document.createElement("div");
  title.className = "market-meta";
  title.textContent = "可执行价差：";
  container.append(title);

  lines.forEach((line) => {
    const row = document.createElement("div");
    row.className = "pair-metric-row pair-metric-positive";
    row.textContent = line;
    container.append(row);
  });
  return container;
}

function renderPairCards(pairs, marketMap) {
  listEl.innerHTML = "";

  pairs.forEach((pair) => {
    const leftKey = `${pair.left.provider}:${pair.left.id}`;
    const rightKey = `${pair.right.provider}:${pair.right.id}`;
    const leftMarket = marketMap.get(leftKey);
    const rightMarket = marketMap.get(rightKey);

    const card = document.createElement("div");
    card.className = "pair-card";

    const header = document.createElement("div");
    header.className = "pair-header";
    header.textContent = `${providerLabel(pair.left.provider)} ↔ ${providerLabel(
      pair.right.provider
    )}`;

    const grid = document.createElement("div");
    grid.className = "pair-markets";

    grid.append(
      leftMarket
        ? buildMarketCard(leftMarket, pair.left.link)
        : buildMissingCard(pair.left)
    );
    grid.append(
      rightMarket
        ? buildMarketCard(rightMarket, pair.right.link)
        : buildMissingCard(pair.right)
    );

    card.append(header, grid);

    if (leftMarket && rightMarket) {
      card.append(buildComparison(leftMarket, rightMarket));
    }

    listEl.appendChild(card);
  });
}

function buildMissingCard(side) {
  const card = document.createElement("div");
  card.className = "market";

  const title = document.createElement("div");
  title.className = "market-title";
  title.textContent = `${providerLabel(side.provider)} ${side.id}`;

  const meta = document.createElement("div");
  meta.className = "market-meta";
  meta.textContent = "未找到市场数据";

  card.append(title, meta);
  return card;
}

function marketKey(provider, market) {
  if (provider === "limitless") {
    return String(market.slug || market.id || "");
  }
  return String(market.id || market.slug || "");
}

async function fetchProviderMarkets(provider, ids) {
  if (ids.length === 0) {
    return { markets: [], errors: [] };
  }
  const response = await fetch(
    `${API_BASE}?ids=${encodeURIComponent(ids.join(","))}&provider=${encodeURIComponent(
      provider
    )}`
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function loadMarkets() {
  if (trackedPairs.length === 0) {
    listEl.innerHTML = "";
    setStatus("请先添加市场对");
    return;
  }

  setStatus("正在拉取跨平台市场数据…");

  try {
    const idsByProvider = trackedPairs.reduce((acc, pair) => {
      acc[pair.left.provider] = acc[pair.left.provider] || new Set();
      acc[pair.right.provider] = acc[pair.right.provider] || new Set();
      acc[pair.left.provider].add(pair.left.id);
      acc[pair.right.provider].add(pair.right.id);
      return acc;
    }, {});

    const providers = Object.keys(idsByProvider);
    const results = await Promise.all(
      providers.map((provider) =>
        fetchProviderMarkets(provider, Array.from(idsByProvider[provider]))
          .then((data) => ({ provider, data }))
      )
    );

    const marketMap = new Map();
    let errorCount = 0;
    results.forEach(({ provider, data }) => {
      const markets = Array.isArray(data.markets) ? data.markets : [];
      const errors = Array.isArray(data.errors) ? data.errors : [];
      errorCount += errors.length;
      markets.forEach((market) => {
        const id = marketKey(provider, market);
        if (id) {
          marketMap.set(`${provider}:${id}`, market);
        }
      });
    });

    renderPairCards(trackedPairs, marketMap);
    setStatus(`已更新 ${trackedPairs.length} 个市场对${errorCount ? `，${errorCount} 个市场无结果` : ""}`);
  } catch (error) {
    setStatus(`加载失败: ${error.message}`);
  }
}

pairForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const leftRaw = leftIdInput.value.trim();
  const rightRaw = rightIdInput.value.trim();
  if (!leftRaw || !rightRaw) {
    return;
  }

  trackedPairs.push({
    left: {
      provider: leftProviderSelect.value,
      ...applyOptionalLink(
        leftProviderSelect.value,
        parseMarketInput(leftProviderSelect.value, leftRaw),
        leftLinkInput.value
      )
    },
    right: {
      provider: rightProviderSelect.value,
      ...applyOptionalLink(
        rightProviderSelect.value,
        parseMarketInput(rightProviderSelect.value, rightRaw),
        rightLinkInput.value
      )
    }
  });
  savePairs();
  renderPairs();
  loadMarkets();

  leftIdInput.value = "";
  rightIdInput.value = "";
  leftLinkInput.value = "";
  rightLinkInput.value = "";
});

refreshButton.addEventListener("click", loadMarkets);
clearPairsButton.addEventListener("click", async () => {
  trackedPairs = [];
  savePairs();
  renderPairs();
  loadMarkets();
});

async function init() {
  trackedPairs = await loadPairs();
  renderPairs();
  loadMarkets();
}

init();

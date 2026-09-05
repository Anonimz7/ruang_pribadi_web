/* models/stocks.js — Typed stock models (Dart parity) */

export class StockListItem {
  constructor(data = {}) {
    this.ticker = data.ticker || '';
    this.companyName = data.company_name || '';
    this.sector = data.sector || null;
    this.primarySector = data.primary_sector || null;
    this.subSector = data.sub_sector || null;
    this.labelDelisted = data.label_delisted ?? null;
    this.stockStatus = data.stock_status || null;
    this.statusReason = data.status_reason || null;
    this.statusSetBy = data.status_set_by || null;
    this.statusSetAt = data.status_set_at || null;
  }
  get isDelisted() { return this.labelDelisted === 1; }
  get isBlacklisted() { return this.stockStatus === 'blacklist'; }
  get isWhitelisted() { return this.stockStatus === 'whitelist'; }
}

export class StockProfile extends StockListItem {
  constructor(data = {}) {
    super(data);
    this.coreBusiness = data.core_business || null;
  }
}

export class StockDataPoint {
  constructor(data = {}) {
    this.date = data.date || data.trade_date || '';
    this.close = (data.close ?? 0) * 1;
    this.open = (data.open ?? 0) * 1;
    this.high = (data.high ?? 0) * 1;
    this.low = (data.low ?? 0) * 1;
    this.volume = (data.volume ?? 0) * 1;
    this.value = (data.value ?? 0) * 1;
    this.frequency = (data.frequency ?? 0) * 1;
    this.foreignBuy = (data.foreign_buy ?? 0) * 1;
    this.foreignSell = (data.foreign_sell ?? 0) * 1;
    this.nonRegValue = (data.non_reg_value ?? 0) * 1;
    this.nonRegVolume = (data.non_reg_volume ?? 0) * 1;
    this.nonRegFreq = (data.non_reg_freq ?? 0) * 1;
    this.netForeign = (data.net_foreign ?? 0) * 1;
    this.atv = (data.atv ?? 0) * 1;
    this.biiScore = (data.bii_score ?? 50) * 1;
    this.prevPrice = (data.prev_price ?? 0) * 1;
    this.change = (data.change ?? 0) * 1;
  }
  get rawNetForeign() { return this.foreignBuy - this.foreignSell; }
}

export class StockSummary {
  constructor(data = {}) {
    this.priceChangePct = (data.price_change_pct ?? 0) * 1;
    this.latestPrice = (data.latest_price ?? 0) * 1;
    this.latestBiiScore = (data.latest_bii_score ?? 0) * 1;
    this.totalNetForeign = (data.total_net_foreign ?? 0) * 1;
    this.avgBiiScore = (data.avg_bii_score ?? 0) * 1;
    this.foreignDominationPct = (data.foreign_domination_pct ?? 0) * 1;
    this.totalValue = (data.total_value ?? 0) * 1;
    this.totalVolume = (data.total_volume ?? 0) * 1;
  }
}

export class StockAnalysis extends StockProfile {
  constructor(data = {}) {
    super(data);
    this.periodDays = (data.period_days ?? 90) * 1;
    this.data = (data.data || []).map(d => new StockDataPoint(d));
    this.summary = new StockSummary(data.summary || {});
  }
}

export class StockListResponse {
  constructor(data = {}) {
    this.total = (data.total ?? 0) * 1;
    this.stocks = (data.stocks || []).map(s => new StockListItem(s));
  }
}

export class StockStatusItem extends StockListItem {
  constructor(data = {}) {
    super(data);
  }
}

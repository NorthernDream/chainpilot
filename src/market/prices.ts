/**
 * 价格 / 行情数据源 —— Strategy Agent 触发判断的输入。
 *
 * demo 退路(docs/02 风险点1):等真实市场涨 5% 不现实,所以提供一个**可控**价格源:
 * 脚本/手动注入价格序列,agent 的触发与决策逻辑保持真实。
 * 真实数据源(CEX/oracle)后续可实现同一 PriceFeed 接口接入,不改 agent。
 */

export interface PriceFeed {
  /** 返回某 token 的当前价(报价币,如 USD)。 */
  getPrice(tokenId: string): Promise<number>;
}

/**
 * 可控价格源:手动 set 或按序列推进。demo 用它注入一个跨越止盈/止损阈值的价格。
 */
export class ScriptedPriceFeed implements PriceFeed {
  private current: Map<string, number>;
  private readonly sequences: Map<string, number[]>;

  constructor(initial: Record<string, number> = {}) {
    this.current = new Map(Object.entries(initial));
    this.sequences = new Map();
  }

  async getPrice(tokenId: string): Promise<number> {
    const p = this.current.get(tokenId);
    if (p === undefined) throw new Error(`ScriptedPriceFeed 无 ${tokenId} 价格 —— 先 setPrice`);
    return p;
  }

  /** 直接设定当前价(demo 手动注入触发)。 */
  setPrice(tokenId: string, price: number): void {
    this.current = new Map(this.current).set(tokenId, price);
  }

  /** 预置一个价格序列,每次 advance 推进一步(脚本化 demo)。 */
  loadSequence(tokenId: string, prices: number[]): void {
    this.sequences.set(tokenId, [...prices]);
  }

  /** 推进序列一步,返回新价(序列空则返回当前价)。 */
  advance(tokenId: string): number {
    const seq = this.sequences.get(tokenId);
    if (seq && seq.length) {
      const next = seq.shift() as number;
      this.setPrice(tokenId, next);
      return next;
    }
    return this.current.get(tokenId) ?? NaN;
  }
}

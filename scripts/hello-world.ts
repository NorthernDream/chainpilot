/**
 * CAW 连通性自检 —— H0-4 决策门的"第 4 步"。
 *
 * 跑通 = CAW 路打通,可以开始主线开发。验证:
 *   1. 提交一个带 per-tx-cap policy 的 pact
 *   2. 等 pact active(未配对钱包通常立即 active)
 *   3. 一笔合规转账 → 成功(真实 tx)
 *   4. 一笔超界转账 → 被 CAW policy 拦截(HTTP 403 结构化 denial)= ChainPilot 的核心卖点
 *
 * 前置:已 caw onboard + faucet 到账,.env 填好 AGENT_WALLET_*。见 docs/01。
 * 运行:npm run hello
 */
import { loadCawEnv } from '../src/caw/types.js';
import {
  makeApis,
  waitForPactActive,
  parseDenial,
  resolveSourceAddr,
} from '../src/caw/client.js';
import { buildTransferPact } from '../src/caw/pacts.js';

const CHAIN = 'SETH';
const TOKEN = 'SETH';
const PER_TX_CAP = '0.002';
const ALLOWED = '0.001';
const DENIED = '0.005';

async function main(): Promise<void> {
  const env = loadCawEnv();
  console.log(`[setup] api=${env.apiUrl} wallet=${env.walletId}`);

  const owner = makeApis(env.apiKey, env.apiUrl);

  // 1. 提交 pact(per-tx-cap = 0.002,超过即拒)
  console.log(`[1/4] 提交 pact:允许 ${CHAIN}/${TOKEN} 转账,单笔 > ${PER_TX_CAP} 即拒...`);
  const req = buildTransferPact(env.walletId, {
    chainId: CHAIN,
    tokenId: TOKEN,
    perTxCap: PER_TX_CAP,
  });
  const submitted = (await owner.pacts.submitPact(req)).data.result;
  console.log(`      pact_id=${submitted.pact_id} status=${submitted.status}`);

  // 2. 等 active,拿 pact-scoped key
  console.log('[2/4] 等待 pact active(已配对钱包需 App 审批)...');
  const pactKey = await waitForPactActive(owner.pacts, submitted.pact_id, {
    onStatus: (s) => console.log(`      pact status -> ${s}`),
  });

  // 3. 用 pact-scoped key 做合规转账(这个 API 版本 transfer 必须显式传 src_addr)
  const scoped = makeApis(pactKey, env.apiUrl);
  const srcAddr = await resolveSourceAddr(owner.balance, env.walletId, CHAIN, TOKEN);
  console.log(`[3/4] 合规转账 ${ALLOWED} ${TOKEN} ${srcAddr} -> ${env.destination}`);
  const ok = (
    await scoped.tx.transferTokens(env.walletId, {
      chain_id: CHAIN,
      token_id: TOKEN,
      src_addr: srcAddr,
      dst_addr: env.destination,
      amount: ALLOWED,
    })
  ).data.result;
  console.log(
    `      ✅ ALLOWED tx_id=${ok.id} status=${ok.status} (${ok.status_display ?? '-'}) hash=${ok.transaction_hash ?? '-'}`,
  );

  // 4. 超界转账 → 期望被 CAW policy 拦截
  console.log(`[4/4] 超界转账 ${DENIED} ${TOKEN}(期望被 policy 拦截)...`);
  try {
    await scoped.tx.transferTokens(env.walletId, {
      chain_id: CHAIN,
      token_id: TOKEN,
      src_addr: srcAddr,
      dst_addr: env.destination,
      amount: DENIED,
    });
    console.error('      ❌ 未被拦截 —— policy 未生效,检查 pact spec');
    process.exitCode = 1;
  } catch (error) {
    const d = parseDenial(error);
    if (d?.httpStatus === 403) {
      console.log(
        `      🛡️  DENIED as expected: http=${d.httpStatus} code=${d.code ?? '-'} reason=${d.reason ?? '-'}`,
      );
      if (d.suggestion) console.log(`      suggestion: ${d.suggestion}`);
      console.log('\n✅ CAW 连通自检通过 —— 合规放行 + 超界拦截都生效。可以开始主线开发。');
    } else {
      throw error;
    }
  }
}

main().catch((e) => {
  console.error('\n❌ 自检失败:', e instanceof Error ? e.message : e);
  process.exit(1);
});

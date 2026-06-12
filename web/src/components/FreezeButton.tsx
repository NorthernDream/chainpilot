import { useState } from 'react';
import './freeze-button.css';

interface FreezeButtonProps {
  onConfirm: () => void;
  frozen: boolean;
  disabled: boolean;
}

/** 危险按钮(一键冻结)§6:freeze 描边 + freeze-bg,点击走液态玻璃二次确认。 */
export function FreezeButton({ onConfirm, frozen, disabled }: FreezeButtonProps) {
  const [confirming, setConfirming] = useState(false);

  if (frozen) {
    return (
      <div className="fz fz--done">
        <span className="fz__mark">❚❚</span> 已冻结 · FROZEN
      </div>
    );
  }

  return (
    <>
      <button className="fz" disabled={disabled} onClick={() => setConfirming(true)}>
        <span className="fz__mark">❚❚</span> 一键冻结
      </button>

      {confirming && (
        <div className="fz__overlay" onClick={() => setConfirming(false)}>
          <div className="fz__modal" onClick={(e) => e.stopPropagation()}>
            <span className="eyebrow">确认 · REVOKE PACT</span>
            <h3 className="fz__title">冻结执行权?</h3>
            <p className="fz__desc">
              撤销当前 pact、失效 agent 的 scoped key。agent 将<strong>立即无法发出任何交易</strong>,
              直到你重新设策略。
            </p>
            <div className="fz__actions">
              <button className="fz__cancel" onClick={() => setConfirming(false)}>
                取消
              </button>
              <button
                className="fz__go"
                onClick={() => {
                  setConfirming(false);
                  onConfirm();
                }}
              >
                确认冻结
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

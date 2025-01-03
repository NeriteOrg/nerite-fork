import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { EarnPositionSummary } from "@/src/comps/EarnPositionSummary/EarnPositionSummary";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { usePrice } from "@/src/services/Prices";
import { vCollIndex, vPositionEarn } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";

const FlowIdSchema = v.literal("earnDeposit");

const RequestSchema = v.object({
  flowId: FlowIdSchema,
  backLink: v.union([
    v.null(),
    v.tuple([
      v.string(), // path
      v.string(), // label
    ]),
  ]),
  successLink: v.tuple([
    v.string(), // path
    v.string(), // label
  ]),
  successMessage: v.string(),
  prevEarnPosition: v.union([v.null(), vPositionEarn()]),
  earnPosition: vPositionEarn(),
  collIndex: vCollIndex(),
  claim: v.boolean(),
});

export type Request = v.InferOutput<typeof RequestSchema>;

type Step = "provideToStabilityPool";

const stepNames: Record<Step, string> = {
  provideToStabilityPool: "Add deposit",
};

export const earnDeposit: FlowDeclaration<Request, Step> = {
  title: "Review & Send Transaction",

  Summary({ flow }) {
    const { request } = flow;
    return (
      <EarnPositionSummary
        collIndex={request.collIndex}
        earnPosition={request.earnPosition}
        prevEarnPosition={request.prevEarnPosition}
        txPreviewMode
      />
    );
  },

  Details({ flow }) {
    const { request } = flow;
    const boldPrice = usePrice("USDN");
    const boldAmount = dn.sub(
      request.earnPosition.deposit,
      request.prevEarnPosition?.deposit ?? dn.from(0, 18)
    );
    return (
      <>
        <TransactionDetailsRow
          label='You deposit'
          value={[
            <Amount key='start' suffix=' USDN' value={boldAmount} />,
            <Amount
              key='end'
              prefix='$'
              value={boldPrice && dn.mul(boldAmount, boldPrice)}
            />,
          ]}
        />
      </>
    );
  },

  async getSteps() {
    return ["provideToStabilityPool"];
  },

  getStepName(stepId) {
    return stepNames[stepId];
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },

  async writeContractParams(_stepId, { contracts, request }) {
    const collateral = contracts.collaterals[request.collIndex];
    const boldAmount = dn.sub(
      request.earnPosition.deposit,
      request.prevEarnPosition?.deposit ?? dn.from(0, 18)
    );
    return {
      ...collateral.contracts.StabilityPool,
      functionName: "provideToSP",
      args: [boldAmount[0], request.claim],
    };
  },
};

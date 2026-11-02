import { test } from "node:test";
import assert from "node:assert/strict";
import { submitFeedback } from "../src/lib/submit-feedback.mjs";
const settings = {
  model: "feedback",
  feedbackId: 7,
  context: { uid: 3 },
  session_id: "session",
  sid: "cookie",
};
test("sends the live ERP button context and verifies submitted state", async () => {
  const calls = [];
  await submitFeedback(async (...args) => {
    calls.push(args);
    return calls.length === 1 ? false : [{ state: "submitted" }];
  }, settings);
  assert.equal(calls[0][0], "/dataset/call_button");
  assert.equal(calls[0][1].kwargs.context.from_ui_button, true);
  assert.equal(calls[0][1].context.from_ui_button, true);
  assert.deepEqual(calls[0][1].args, [[7]]);
  assert.deepEqual(calls[1][1].args, [[7], ["state"]]);
  assert.equal(settings.context.from_ui_button, undefined);
});
for (const result of [[{ state: "draft" }], [{ state: "edit" }], []]) {
  test(`rejects unconfirmed submission: ${JSON.stringify(result)}`, async () => {
    let calls = 0;
    await assert.rejects(
      submitFeedback(async () => (++calls === 1 ? true : result), settings),
      /not confirmed/,
    );
  });
}
test("does not report success when ERP rejects the button call", async () => {
  await assert.rejects(
    submitFeedback(async () => {
      throw new Error("ERP unavailable");
    }, settings),
    /ERP unavailable/,
  );
});

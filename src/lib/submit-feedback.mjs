/** Use the ERP button's context and verify the persisted result. */
export async function submitFeedback(
  call,
  { model, feedbackId, context, session_id, sid },
) {
  const submitContext = { ...context, from_ui_button: true };
  await call(
    "/dataset/call_button",
    {
      model,
      method: "button_submit",
      args: [[feedbackId]],
      kwargs: { context: submitContext },
      session_id,
      context: submitContext,
    },
    sid,
  );

  const records = await call(
    "/dataset/call_kw",
    {
      model,
      method: "read",
      args: [[feedbackId], ["state"]],
      kwargs: { context },
      session_id,
      context,
    },
    sid,
  );
  if (records?.[0]?.state !== "submitted") {
    throw new Error(
      "ERP has not confirmed submission. The form remains pending; retry from this app.",
    );
  }
}

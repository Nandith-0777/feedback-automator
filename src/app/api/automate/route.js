import axios from "axios";

function makeStream() {
  const ts = new TransformStream();
  const writer = ts.writable.getWriter();
  const encoder = new TextEncoder();

  const send = async (obj) => {
    const line = JSON.stringify(obj) + "\n";
    await writer.write(encoder.encode(line));
  };

  return { stream: ts.readable, writer, send };
}

async function erpApiCall(path, params, sid) {
  const url = `https://erp.vidyaacademy.ac.in/web${path}`;

  const payload = {
    jsonrpc: "2.0",
    method: "call",
    params,
  };

  const headers = {
    Cookie: `sid=${sid}`,
  };

  try {
    const response = await axios.post(url, payload, { headers });

    if (response.data.error) {
      const error = response.data.error;

      console.error("========== ERP SERVER ERROR ==========");
      console.error("Path:", path);
      console.error(JSON.stringify(error, null, 2));
      console.error("======================================");

      const errorMessage =
        error?.data?.message ||
        error?.data?.debug ||
        error?.message ||
        "Unknown OpenERP Server Error";

      throw new Error(`${path}: ${errorMessage}`);
    }

    return response.data.result;
  } catch (error) {
    if (error.response) {
      console.error(
        "ERP HTTP ERROR:",
        error.response.status,
        error.response.data
      );
    }

    throw error;
  }
}

async function login(username, password) {
  const url = "https://erp.vidyaacademy.ac.in/web/session/authenticate";

  const payload = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      db: "liveone",
      login: username.trim().toUpperCase(),
      password: password,
      base_location: "https://erp.vidyaacademy.ac.in",
      context: {},
    },
  };

  try {
    const response = await axios.post(url, payload);
    const result = response.data;

    if (result.result && result.result.uid) {
      const setCookie = response.headers["set-cookie"];

      if (!setCookie || !setCookie[0]) {
        throw new Error("Login succeeded but no session cookie was returned.");
      }

      const sid = setCookie[0].split(";")[0].split("=")[1];

      const { session_id, uid } = result.result;

      return { sid, session_id, uid };
    } else {
      throw new Error("Incorrect username or password.");
    }
  } catch (error) {
    if (error.message === "Incorrect username or password.") {
      throw error;
    }

    throw new Error("Failed to log in. Please check your credentials.");
  }
}

async function automateFeedback(
  sid,
  session_id,
  uid,
  logs,
  emit,
  feedbackMode,
  rating,
  facultyRatings
) {
  const model = "vict.feedback.student.batch.feedback";

  const topLevelContext = {
    lang: "en_GB",
    tz: "Asia/Kolkata",
    uid,
  };

  const kwArgsContext = {
    ...topLevelContext,
    search_default_group_feedback_id: 1,
    search_default_group_batch: 1,
    search_default_group_semester: 1,
  };

  logs.push("1) Fetching dynamic batch ID...");

  await emit({
    type: "status",
    step: "batch",
    progress: 5,
    message: "Fetching dynamic batch ID...",
  });

  const batchIdResult = await erpApiCall(
    "/dataset/call_kw",
    {
      model,
      method: "read_group",
      args: [],
      kwargs: {
        domain: [["login_id", "=", uid]],
        fields: ["gt_batch_id"],
        groupby: ["gt_batch_id"],
        context: kwArgsContext,
      },
      session_id,
      context: topLevelContext,
    },
    sid
  );

  if (!batchIdResult || batchIdResult.length === 0) {
    throw new Error("Unable to find your batch.");
  }

  const gt_batch_id = batchIdResult[0].gt_batch_id[0];
  const batchName = batchIdResult[0].gt_batch_id[1];

  logs.push(`    Found Batch: ${batchName} (ID: ${gt_batch_id})`);

  await emit({
    type: "status",
    step: "batch",
    progress: 100,
    message: `Found ${batchName}`,
  });

  logs.push("2) Fetching available semesters...");

  await emit({
    type: "status",
    step: "semester",
    progress: 5,
    message: "Fetching semesters...",
  });

  const semestersResult = await erpApiCall(
    "/dataset/call_kw",
    {
      model,
      method: "read_group",
      args: [],
      kwargs: {
        domain: [
          ["gt_batch_id", "=", gt_batch_id],
          ["login_id", "=", uid],
        ],
        fields: ["semester"],
        groupby: ["semester"],
        context: kwArgsContext,
      },
      session_id,
      context: topLevelContext,
    },
    sid
  );

  if (!semestersResult || semestersResult.length === 0) {
    throw new Error("Unable to find available semesters.");
  }

  const latestSemester = semestersResult[semestersResult.length - 1];
  const semesterId = latestSemester.semester[0];

  logs.push(`    Found latest semester: ${latestSemester.semester[1]}`);

  await emit({
    type: "status",
    step: "semester",
    progress: 100,
    message: `Found ${latestSemester.semester[1]}`,
  });

  logs.push("3) Fetching feedback configuration...");

  await emit({
    type: "status",
    step: "config",
    progress: 5,
    message: "Fetching config...",
  });

  const configResult = await erpApiCall(
    "/dataset/call_kw",
    {
      model,
      method: "read_group",
      args: [],
      kwargs: {
        domain: [
          ["semester", "=", semesterId],
          ["gt_batch_id", "=", gt_batch_id],
          ["login_id", "=", uid],
        ],
        fields: ["config_id"],
        groupby: ["config_id"],
        context: kwArgsContext,
      },
      session_id,
      context: topLevelContext,
    },
    sid
  );

  if (!configResult || configResult.length === 0) {
    throw new Error(
      "No feedback configurations found for the latest semester."
    );
  }

  const latestConfig = configResult.reduce((latest, current) => {
    return current.config_id[0] > latest.config_id[0] ? current : latest;
  });

  const configId = latestConfig.config_id[0];
  const configName = latestConfig.config_id[1];

  logs.push(`    Found latest config: ${configName} (ID: ${configId})`);

  await emit({
    type: "status",
    step: "config",
    progress: 100,
    message: `Found: ${configName}`,
  });

  logs.push("4) Fetching all pending feedback forms...");

  await emit({
    type: "status",
    step: "pending",
    progress: 5,
    message: "Finding pending forms...",
  });

  const pendingFeedbacks = await erpApiCall(
    "/dataset/search_read",
    {
      model,
      fields: ["id", "employeename", "course", "state"],
      domain: [
        ["config_id", "=", configId],
        ["state", "=", "draft"],
        ["login_id", "=", uid],
      ],
      context: kwArgsContext,
      session_id,
      limit: 80,
    },
    sid
  );

  const feedbackRecords = pendingFeedbacks.records;

  if (!feedbackRecords.length) {
    logs.push("🎉 No pending feedback forms found. You are all done!");

    await emit({
      type: "status",
      step: "pending",
      progress: 100,
      message: "No pending forms",
    });

    await emit({
      type: "status",
      step: "submit",
      progress: 100,
      completed: 0,
      total: 0,
      message: "Nothing to submit",
    });

    return;
  }

  logs.push(
    `    Found ${feedbackRecords.length} feedback forms to submit.`
  );

  await emit({
    type: "status",
    step: "pending",
    progress: 100,
    message: `Found ${feedbackRecords.length} forms`,
  });

  if (feedbackMode === "custom" && !facultyRatings) {
    const faculties = feedbackRecords.map((record) => ({
      id: record.id,
      name: record.employeename,
      course: Array.isArray(record.course) ? record.course[1] : "",
    }));

    await emit({
      type: "need_ratings",
      faculties,
    });

    return {
      needsRatings: true,
      credentials: { sid, session_id, uid },
      configId,
      gt_batch_id,
      semesterId,
    };
  }

  logs.push("5) Submitting feedback for each teacher...");

  await emit({
    type: "status",
    step: "submit",
    progress: 1,
    total: feedbackRecords.length,
    completed: 0,
    message: `Submitting ${feedbackRecords.length} forms...`,
  });

  let completed = 0;
  let failed = 0;

  for (const record of feedbackRecords) {
    try {
      const { id: feedbackId, employeename, course } = record;
      const courseName = Array.isArray(course) ? course[1] : "";

      logs.push(
        `   -> Submitting for ${employeename} (${courseName})...`
      );

      const formDetails = await erpApiCall(
        "/dataset/call_kw",
        {
          model,
          method: "read",
          args: [[feedbackId], ["questions_line"]],
          kwargs: {
            context: kwArgsContext,
          },
          session_id,
          context: topLevelContext,
        },
        sid
      );

      const questionIds = formDetails[0]?.questions_line || [];

      const markState =
        feedbackMode === "custom"
          ? facultyRatings[feedbackId] || 1
          : rating;

      const ratingLabels = {
        1: "Excellent",
        2: "Very Good",
        3: "Good",
        4: "Fair",
        5: "Poor",
      };

      logs.push(
        `       Rating: ${ratingLabels[markState] || markState}`
      );

      const answersPayload = questionIds.map((qid) => [
        1,
        qid,
        {
          mark_state: markState,
        },
      ]);

      if (answersPayload.length > 0) {
        logs.push(
          `       Writing ${answersPayload.length} question answers...`
        );

        await erpApiCall(
          "/dataset/call_kw",
          {
            model,
            method: "write",
            args: [[feedbackId], { questions_line: answersPayload }],
            kwargs: {
              context: kwArgsContext,
            },
            session_id,
            context: topLevelContext,
          },
          sid
        );

        logs.push("       ✓ Rating written successfully.");
      }

      logs.push("       Submitting feedback form...");

      // IMPORTANT:
      // Pass only the record ID as a positional argument.
      // The context belongs inside kwargs.
      await erpApiCall(
        "/dataset/call_button",
        {
          model,
          method: "button_submit",
          args: [[feedbackId]],
          kwargs: {
            context: kwArgsContext,
          },
          session_id,
          context: topLevelContext,
        },
        sid
      );

      completed += 1;

      logs.push("       ✓ Feedback submitted successfully.");

      const percent = Math.round(
        (completed / feedbackRecords.length) * 100
      );

      await emit({
        type: "status",
        step: "submit",
        progress: percent,
        total: feedbackRecords.length,
        completed,
        message: `Submitted ${employeename} (${courseName})`,
      });
    } catch (err) {
      failed += 1;

      logs.push(
        `   -> ❌ Error submitting for ${record.employeename}: ${err.message}`
      );

      await emit({
        type: "status",
        step: "submit",
        total: feedbackRecords.length,
        completed,
        progress: Math.round(
          ((completed + failed) / feedbackRecords.length) * 100
        ),
        message: `Error with ${record.employeename}: ${err.message}`,
      });
    }
  }

  if (failed === 0) {
    logs.push("✅ All feedback submitted successfully!");
  } else {
    logs.push(
      `⚠️ Submission finished: ${completed} succeeded, ${failed} failed.`
    );
  }

  await emit({
    type: "status",
    step: "submit",
    progress: 100,
    total: feedbackRecords.length,
    completed,
    message:
      failed === 0
        ? "All feedback submitted successfully!"
        : `${completed} succeeded, ${failed} failed.`,
  });
}

export async function POST(request) {
  const { stream, writer, send } = makeStream();

  let body;

  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({
        error: "Invalid JSON",
      }),
      {
        status: 400,
      }
    );
  }

  const {
    username,
    password,
    feedbackMode = "set-all",
    rating = 1,
    facultyRatings = null,
  } = body || {};

  if (!username || !password) {
    return new Response(
      JSON.stringify({
        error: "Username and password are required.",
      }),
      {
        status: 400,
      }
    );
  }

  const logs = [];

  (async () => {
    try {
      await send({
        type: "status",
        step: "login",
        progress: 5,
        message: "Logging in...",
      });

      const credentials = await login(username, password);

      logs.push("✓ Login Successful.");

      await send({
        type: "status",
        step: "login",
        progress: 100,
        message: "Login successful",
      });

      const emit = async (evt) => {
        if (evt.message) {
          await send({
            type: "log",
            message: evt.message,
          });
        }

        await send({
          ...evt,
          message: evt.message,
        });
      };

      const result = await automateFeedback(
        credentials.sid,
        credentials.session_id,
        credentials.uid,
        logs,
        emit,
        feedbackMode,
        rating,
        facultyRatings
      );

      if (result && result.needsRatings) {
        return;
      }

      await send({
        type: "done",
        logs,
      });
    } catch (error) {
      logs.push(`❌ An error occurred: ${error.message}`);

      await send({
        type: "error",
        message: error.message,
        logs,
      });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
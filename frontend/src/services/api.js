const BASE_URL = "http://127.0.0.1:8000";

/* ------------------ CANDIDATE ------------------ */

export async function uploadResume(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${BASE_URL}/candidate/upload-resume`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Resume upload failed");
  }

  return await response.json();
}

export async function checkOaEligibility(email) {
  const response = await fetch(
    `${BASE_URL}/oa/eligibility?email=${encodeURIComponent(email)}`
  );

  if (!response.ok) {
    throw new Error("Failed to check OA eligibility");
  }

  return await response.json();
}

export async function fetchOaQuestions(role, email) {
  const response = await fetch(
    `${BASE_URL}/oa/questions/${role}?email=${encodeURIComponent(email)}`
  );

  if (!response.ok) {
    throw new Error("Failed to load OA questions");
  }

  return await response.json();
}

export async function submitOaAnswers(payload) {
  const response = await fetch(`${BASE_URL}/oa/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("OA submission failed");
  }

  return await response.json();
}

export async function checkInterviewEligibility(email) {
  const response = await fetch(
    `${BASE_URL}/interview/eligibility?email=${encodeURIComponent(email)}`
  );

  if (!response.ok) {
    throw new Error("Failed to check interview eligibility");
  }

  return await response.json();
}

export async function fetchInterviewQuestions(role, email) {
  const response = await fetch(
    `${BASE_URL}/interview/questions/${role}?email=${encodeURIComponent(email)}`
  );

  if (!response.ok) {
    throw new Error("Failed to load interview questions");
  }

  return await response.json();
}

export async function submitInterviewAnswers(payload) {
  const response = await fetch(`${BASE_URL}/interview/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Interview submission failed");
  }

  return await response.json();
}

/* ------------------ HR ------------------ */

export async function fetchAllCandidates() {
  const response = await fetch(`${BASE_URL}/hr/candidates`);

  if (!response.ok) {
    throw new Error("Failed to fetch candidates");
  }

  return await response.json();
}

export async function shortlistCandidates(role, limit) {
  const response = await fetch(
    `${BASE_URL}/hr/shortlist?role=${role}&limit=${limit}`,
    { method: "POST" }
  );

  if (!response.ok) {
    throw new Error("Shortlisting failed");
  }

  return await response.json();
}

export async function finalizeCandidates(role, limit) {
  const response = await fetch(
    `${BASE_URL}/hr/finalize?role=${role}&limit=${limit}`,
    { method: "POST" }
  );

  if (!response.ok) {
    throw new Error("Final selection failed");
  }

  return await response.json();
}

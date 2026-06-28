const BASE_URL = "http://127.0.0.1:8000";

const getAuthHeaders = () => {
  const token = localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const handleUnauthorized = async (response) => {
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authRole");
    localStorage.removeItem("authName");
    localStorage.removeItem("authEmail");
  }
  let message = "Request failed";
  try {
    const data = await response.json();
    message = data.detail || data.error || message;
  } catch {
    // ignore parse errors
  }
  throw new Error(message);
};

const apiFetch = async (url, options = {}) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    await handleUnauthorized(response);
  }
  return response.json();
};

/* ------------------ CANDIDATE ------------------ */

export async function uploadResume(file) {
  const formData = new FormData();
  formData.append("file", file);

  return apiFetch(`${BASE_URL}/candidate/upload-resume`, {
    method: "POST",
    body: formData,
  });
}

export async function uploadJobDescription(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${BASE_URL}/candidate/upload-jd`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("JD upload failed");
  }

  return await response.json();
}

export async function uploadHrJobDescription(role, file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `${BASE_URL}/hr/jd?role=${encodeURIComponent(role)}`,
    {
      method: "POST",
      headers: { ...getAuthHeaders() },
      body: formData,
    }
  );

  if (!response.ok) {
    let message = "JD upload failed";
    try {
      const data = await response.json();
      message = data.detail || data.error || message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return await response.json();
}

export async function fetchHrJobDescription(hrId, role) {
  const response = await fetch(
    `${BASE_URL}/hr/jd?hr_id=${encodeURIComponent(
      hrId
    )}&role=${encodeURIComponent(role)}`
  );

  if (!response.ok) {
    let message = "JD not available";
    try {
      const data = await response.json();
      message = data.detail || data.error || message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return await response.json();
}

/* ------------------ AUTH ------------------ */

export async function registerCandidate(payload) {
  const response = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Registration failed";
    try {
      const data = await response.json();
      message = data.detail || data.error || message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return await response.json();
}

export async function registerHr(payload) {
  const response = await fetch(`${BASE_URL}/auth/register-hr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "HR registration failed";
    try {
      const data = await response.json();
      message = data.detail || data.error || message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return await response.json();
}

export async function loginUser(payload) {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Login failed";
    try {
      const data = await response.json();
      message = data.detail || data.error || message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return await response.json();
}

export async function fetchHrList() {
  const response = await fetch(`${BASE_URL}/hr/list`);

  if (!response.ok) {
    throw new Error("Failed to load HR list");
  }

  return await response.json();
}

export async function fetchHrRoles() {
  const response = await fetch(`${BASE_URL}/hr/roles`);

  if (!response.ok) {
    throw new Error("Failed to load HR roles");
  }

  return await response.json();
}

export async function submitApplication(payload) {
  const response = await fetch(`${BASE_URL}/application/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Submission failed");
  }

  return await response.json();
}

export async function checkOaEligibility(email) {
  const response = await fetch(
    `${BASE_URL}/oa/eligibility?email=${encodeURIComponent(email)}`,
    { headers: { ...getAuthHeaders() } }
  );

  if (!response.ok) {
    throw new Error("Failed to check OA eligibility");
  }

  return await response.json();
}

export async function fetchOaQuestions(role, email) {
  const response = await fetch(
    `${BASE_URL}/oa/questions/${role}?email=${encodeURIComponent(email)}`,
    { headers: { ...getAuthHeaders() } }
  );

  if (!response.ok) {
    throw new Error("Failed to load OA questions");
  }

  return await response.json();
}

export async function submitOaAnswers(payload) {
  const response = await fetch(`${BASE_URL}/oa/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("OA submission failed");
  }

  return await response.json();
}

export async function checkInterviewEligibility(email) {
  const response = await fetch(
    `${BASE_URL}/interview/eligibility?email=${encodeURIComponent(email)}`,
    { headers: { ...getAuthHeaders() } }
  );

  if (!response.ok) {
    throw new Error("Failed to check interview eligibility");
  }

  return await response.json();
}

export async function fetchInterviewQuestions(role, email) {
  const response = await fetch(
    `${BASE_URL}/interview/questions/${role}?email=${encodeURIComponent(email)}`,
    { headers: { ...getAuthHeaders() } }
  );

  if (!response.ok) {
    throw new Error("Failed to load interview questions");
  }

  return await response.json();
}

export async function submitInterviewAnswers(payload) {
  const response = await fetch(`${BASE_URL}/interview/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Interview submission failed");
  }

  return await response.json();
}

export async function getOAQuestions(role, options = {}) {
  const response = await fetch(
    `${BASE_URL}/oa/questions?role=${encodeURIComponent(role)}`,
    { ...options, headers: { ...getAuthHeaders(), ...(options.headers || {}) } }
  );

  if (!response.ok) {
    throw new Error("Failed to load OA questions");
  }

  return await response.json();
}

export async function submitOATest(payload) {
  const response = await fetch(`${BASE_URL}/oa/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("OA submission failed");
  }

  return await response.json();
}

/* ------------------ HR ------------------ */

export async function fetchAllCandidates(role) {
  const query = role ? `?role=${encodeURIComponent(role)}` : "";
  return apiFetch(`${BASE_URL}/hr/candidates${query}`, {
    headers: { ...getAuthHeaders() },
  });
}

export async function getCurrentUser() {
  return apiFetch(`${BASE_URL}/auth/me`, {
    headers: { ...getAuthHeaders() },
  });
}

export async function shortlistCandidates(role, limit) {
  const response = await fetch(
    `${BASE_URL}/hr/shortlist?role=${role}&limit=${limit}`,
    { method: "POST", headers: { ...getAuthHeaders() } }
  );

  if (!response.ok) {
    throw new Error("Shortlisting failed");
  }

  return await response.json();
}

export async function finalizeCandidates(role, limit) {
  const response = await fetch(
    `${BASE_URL}/hr/finalize?role=${role}&limit=${limit}`,
    { method: "POST", headers: { ...getAuthHeaders() } }
  );

  if (!response.ok) {
    throw new Error("Final selection failed");
  }

  return await response.json();
}

export async function previewFinalize(role, limit) {
  const response = await fetch(
    `${BASE_URL}/hr/preview?role=${encodeURIComponent(role)}&limit=${encodeURIComponent(limit)}`,
    { headers: { ...getAuthHeaders() } }
  );

  if (!response.ok) {
    throw new Error("Failed to preview final selection");
  }

  return await response.json();
}

export async function fetchHrMetrics(role) {
  const query = role ? `?role=${encodeURIComponent(role)}` : "";
  const response = await fetch(`${BASE_URL}/hr/metrics${query}`, {
    headers: { ...getAuthHeaders() },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch HR metrics");
  }

  return await response.json();
}

export async function setCandidateDecision(email, decision) {
  const response = await fetch(`${BASE_URL}/hr/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ email, decision }),
  });

  if (!response.ok) {
    throw new Error("Failed to update candidate status");
  }

  return await response.json();
}

export async function checkCandidateStatus(email) {
  const response = await fetch(
    `${BASE_URL}/candidate/check-status?email=${encodeURIComponent(email)}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch candidate status");
  }

  return await response.json();
}

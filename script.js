const API_BASE_URL = window.location.origin && window.location.origin !== "null"
  ? window.location.origin
  : "http://localhost:5000";
let latestScanData = null;
let latestJobs = [];

async function parseApiResponse(response) {
  const raw = await response.text();
  let data = {};

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { error: raw.slice(0, 200) };
    }
  }

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data;
}

function escapeText(value) {
  return String(value || "");
}

function updateJobSearchStatus(message, isError = false) {
  const status = document.getElementById("jobSearchStatus");
  if (!status) {
    return;
  }

  status.textContent = message;
  status.classList.toggle("is-error", isError);
}

function renderJobCards(jobs) {
  const results = document.getElementById("jobResults");
  if (!results) {
    return;
  }

  results.innerHTML = "";

  if (!jobs.length) {
    results.innerHTML = '<div class="job-empty">No matching jobs found. Try a broader role name.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();

  jobs.forEach((job) => {
    const card = document.createElement("article");
    card.className = "job-card";

    const title = document.createElement("h4");
    title.textContent = escapeText(job.title);

    const company = document.createElement("p");
    company.className = "job-company";
    company.textContent = escapeText(job.company_name);

    const meta = document.createElement("div");
    meta.className = "job-meta";

    const items = [job.category, job.job_type, job.candidate_required_location, job.salary]
      .filter(Boolean)
      .slice(0, 4);

    items.forEach((item) => {
      const chip = document.createElement("span");
      chip.className = "job-chip";
      chip.textContent = escapeText(item);
      meta.appendChild(chip);
    });

    const description = document.createElement("p");
    description.className = "job-description";
    const summary = job.description ? job.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
    description.textContent = summary ? `${summary.slice(0, 160)}${summary.length > 160 ? "..." : ""}` : "Remote job posting from Remotive.";

    const link = document.createElement("a");
    link.className = "job-link";
    link.href = job.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "View Job";

    card.appendChild(title);
    card.appendChild(company);
    card.appendChild(meta);
    card.appendChild(description);
    card.appendChild(link);

    fragment.appendChild(card);
  });

  results.appendChild(fragment);
}

async function searchJobs() {
  const input = document.getElementById("jobRoleInput");
  const role = input ? input.value.trim() : "";

  if (!role) {
    updateJobSearchStatus("Enter a role to search for remote jobs.", true);
    return;
  }

  updateJobSearchStatus(`Searching Remotive for ${role} jobs...`);

  const results = document.getElementById("jobResults");
  if (results) {
    results.innerHTML = '<div class="job-empty">Loading jobs...</div>';
  }

  try {
    const response = await fetch(`${API_BASE_URL}/jobs?role=${encodeURIComponent(role)}`);
    const data = await parseApiResponse(response);
    latestJobs = Array.isArray(data.jobs) ? data.jobs : [];

    updateJobSearchStatus(
      latestJobs.length
        ? `Showing ${latestJobs.length} remote jobs for ${data.role}.`
        : `No jobs matched ${data.role}. Try a broader search term.`,
      !latestJobs.length
    );
    renderJobCards(latestJobs);
  } catch (error) {
    console.error(error);
    updateJobSearchStatus(`❌ ${error.message}`, true);
    const results = document.getElementById("jobResults");
    if (results) {
      results.innerHTML = '<div class="job-empty">Unable to load jobs right now.</div>';
    }
  }
}

function initJobSearch() {
  const button = document.getElementById("jobSearchButton");
  const input = document.getElementById("jobRoleInput");

  if (button) {
    button.addEventListener("click", searchJobs);
  }

  if (input) {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        searchJobs();
      }
    });
  }
}

async function getSuggestions() {
  const resumeText = document.getElementById("resumeText").value.trim();
  const output = document.getElementById("suggestionOutput");

  if (!resumeText) {
    alert("Please paste your resume text.");
    return;
  }

  output.textContent = "Connecting to AI for suggestions...";

  try {
    const response = await fetch(`${API_BASE_URL}/suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: resumeText,
        atsScore: latestScanData?.atsScore,
        bestRole: latestScanData?.bestRole,
        missingSkills: latestScanData?.missingSkills || []
      })
    });

    const data = await parseApiResponse(response);

    if (data.suggestions) {
      output.innerHTML = data.suggestions.replace(/\n/g, "<br>");
    } else {
      output.textContent = "AI returned no suggestions.";
    }

  } catch (error) {
    console.error(error);
    output.textContent = `❌ ${error.message}`;
  }
}

function renderScanResult(data) {
  const resultText = document.getElementById("scanResult");
  const matchedSkills = (data.matchedSkills || []).length ? data.matchedSkills.join(", ") : "None";
  const missingSkills = (data.missingSkills || []).length ? data.missingSkills.join(", ") : "None";
  const topMatches = (data.topMatches || [])
    .map((match) => `${match.role} (${match.atsScore}%)`)
    .join(" | ");
  const needsEnhancement = Number(data.atsScore || 0) < 65;
  const suggestionHint = needsEnhancement
    ? '<br /><strong>Action:</strong> Your ATS score is low. Go to "Enhance Your Resume" below and click "Get Suggestions".'
    : '<br /><strong>Action:</strong> Nice score. You can still use "Enhance Your Resume" to polish it further.';

  resultText.innerHTML = `
    <strong>ATS Score:</strong> ${data.atsScore}%<br />
    <strong>Best Role Match:</strong> ${data.bestRole}<br />
    <strong>Matched Skills:</strong> ${matchedSkills}<br />
    <strong>Missing Skills:</strong> ${missingSkills}<br />
    <strong>Top Matches:</strong> ${topMatches || "None"}
    ${suggestionHint}
  `;

  if (needsEnhancement) {
    const enhanceSection = document.getElementById("suggestion");
    if (enhanceSection) {
      enhanceSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}

async function scanResume() {
  const input = document.getElementById("resumeInput");
  const resultText = document.getElementById("scanResult");

  if (input.files.length === 0) {
    alert("Please upload a resume first.");
    return;
  }

  const file = input.files[0];
  const formData = new FormData();
  formData.append("resume", file);

  resultText.textContent = "Analyzing resume for ATS score and role match...";

  try {
    const response = await fetch(`${API_BASE_URL}/scan`, {
      method: "POST",
      body: formData
    });

    const data = await parseApiResponse(response);
    latestScanData = data;

    renderScanResult(data);
  } catch (error) {
    console.error(error);
    resultText.textContent = `❌ ${error.message}`;
  }
}

initJobSearch();


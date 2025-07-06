async function getSuggestions() {
  const resumeText = document.getElementById("resumeText").value.trim();
  const output = document.getElementById("suggestionOutput");

  if (!resumeText) {
    alert("Please paste your resume text.");
    return;
  }

  output.textContent = "Connecting to AI for suggestions...";

  try {
    const response = await fetch("http://localhost:5000/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: resumeText })
    });

    const data = await response.json();

    if (data.suggestions) {
      output.innerHTML = data.suggestions.replace(/\n/g, "<br>");
    } else {
      output.textContent = "AI returned no suggestions.";
    }

  } catch (error) {
    console.error(error);
    output.textContent = "❌ Failed to fetch from backend.";
  }
}

function scanResume() {
  const input = document.getElementById("resumeInput");
  const resultText = document.getElementById("scanResult");

  if (input.files.length === 0) {
    alert("Please upload a resume first.");
    return;
  }

  resultText.textContent = "Analyzing resume with AI...";

  setTimeout(() => {
    resultText.textContent = "✅ Resume scanned. Jobs matched: Software Developer, Data Analyst, Web Designer.";
  }, 2000);
}

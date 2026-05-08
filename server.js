const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const { PDFParse } = require("pdf-parse");
const mammoth = require("mammoth");
const { OpenAI } = require("openai");
const fetch = require("node-fetch");
const path = require("path");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 6 * 1024 * 1024 },
});

const roleProfiles = [
    {
        role: "Frontend Developer",
        keywords: ["html", "css", "javascript", "typescript", "react", "responsive", "ui", "ux", "bootstrap", "api", "git"],
        focusSkills: ["html", "css", "javascript", "react", "responsive design", "ui", "ux"],
    },
    {
        role: "Backend Developer",
        keywords: ["node", "node.js", "express", "api", "rest", "jwt", "authentication", "mongodb", "sql", "database", "docker", "testing"],
        focusSkills: ["node.js", "express", "rest api", "jwt", "authentication", "database"],
    },
    {
        role: "Full Stack Developer",
        keywords: ["html", "css", "javascript", "react", "node", "express", "api", "database", "jwt", "authentication", "git", "testing"],
        focusSkills: ["frontend", "backend", "api", "database", "authentication", "javascript"],
    },
    {
        role: "Data Analyst",
        keywords: ["excel", "sql", "python", "tableau", "power bi", "dashboard", "statistics", "data visualization", "reporting", "analysis"],
        focusSkills: ["sql", "excel", "python", "tableau", "power bi", "dashboard"],
    },
    {
        role: "UI/UX Designer",
        keywords: ["figma", "wireframe", "prototype", "user research", "ui", "ux", "accessibility", "design system", "interaction design", "visual design"],
        focusSkills: ["figma", "wireframe", "prototype", "user research", "accessibility", "ui", "ux"],
    },
    {
        role: "Digital Marketer",
        keywords: ["seo", "sem", "social media", "content marketing", "email marketing", "analytics", "campaign", "conversion", "branding", "copywriting"],
        focusSkills: ["seo", "sem", "content marketing", "analytics", "campaign", "branding"],
    },
    {
        role: "Software Engineer",
        keywords: ["data structures", "algorithms", "problem solving", "oop", "git", "javascript", "python", "java", "testing", "system design"],
        focusSkills: ["data structures", "algorithms", "problem solving", "oop", "system design"],
    },
];

function normalizeText(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9+.#\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function countMatches(text, terms) {
    const normalized = normalizeText(text);
    return terms.filter((term) => normalized.includes(normalizeText(term)));
}

function scoreRole(resumeText, profile) {
    const matchedKeywords = countMatches(resumeText, profile.keywords);
    const matchedFocusSkills = countMatches(resumeText, profile.focusSkills);
    const keywordScore = profile.keywords.length ? matchedKeywords.length / profile.keywords.length : 0;
    const skillScore = profile.focusSkills.length ? matchedFocusSkills.length / profile.focusSkills.length : 0;
    const atsScore = Math.round((keywordScore * 60) + (skillScore * 40));

    return {
        role: profile.role,
        atsScore,
        matchedSkills: Array.from(new Set([...matchedFocusSkills, ...matchedKeywords])),
        missingSkills: profile.focusSkills.filter((skill) => !countMatches(resumeText, [skill]).length),
    };
}

function uniqueList(values) {
    return Array.from(new Set((values || []).filter(Boolean)));
}

function inferSkillsFromText(text) {
    const catalog = [
        "javascript", "typescript", "react", "node.js", "express", "mongodb", "sql", "postgresql",
        "python", "java", "rest api", "jwt", "docker", "aws", "html", "css", "bootstrap",
        "figma", "tableau", "power bi", "excel", "git", "testing", "redis", "graphql",
    ];
    const normalized = normalizeText(text);
    return catalog.filter((item) => normalized.includes(normalizeText(item)));
}

function buildFallbackSuggestions({ resumeText, atsScore, targetRole, missingKeywords }) {
    const score = Number.isFinite(Number(atsScore)) ? Number(atsScore) : null;
    const role = targetRole || "target role";
    const missing = Array.isArray(missingKeywords) ? missingKeywords.filter(Boolean) : [];
    const lines = String(resumeText || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => Boolean(line) && line.length > 3)
        .slice(0, 6);

    const inferredSkills = inferSkillsFromText(resumeText);
    const prioritizedSkills = uniqueList([...inferredSkills, ...missing]).slice(0, 12);
    const verbs = ["Developed", "Designed", "Implemented", "Optimized", "Engineered", "Delivered"];
    const metricPhrases = [
        "improving delivery speed and reliability",
        "strengthening user experience and adoption",
        "reducing rework through cleaner architecture",
        "increasing maintainability across releases",
        "enhancing scalability for production usage",
        "improving quality through structured testing",
    ];
    const bulletStyles = [
        (verb, content, skill, metric) => `- ${verb} ${content} using ${skill}, ${metric}.`,
        (verb, content, skill, metric) => `- ${verb} ${content}; applied ${skill} to deliver measurable business value and ${metric}.`,
        (verb, content, skill, metric) => `- ${verb} ${content} with a focus on ${skill}, resulting in stronger outcomes while ${metric}.`,
        (verb, content, skill, metric) => `- ${verb} ${content}, leveraging ${skill} to align implementation with ${role} expectations and ${metric}.`,
    ];

    const rewritten = lines.map((line, index) => {
        const cleaned = line.replace(/^[-*]\s*/, "");
        const content = cleaned ? `${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}` : "project execution";
        const skill = prioritizedSkills[index % (prioritizedSkills.length || 1)] || "relevant technologies";
        const verb = verbs[index % verbs.length];
        const metric = metricPhrases[index % metricPhrases.length];
        const style = bulletStyles[index % bulletStyles.length];
        return style(verb, content, skill, metric);
    });

    const header = score !== null
        ? `Current ATS score: ${score}%. Prioritize keyword relevance, quantified outcomes, and role alignment.`
        : "Prioritize keyword relevance, quantified outcomes, and role alignment.";

    const roleSummarySkills = prioritizedSkills.slice(0, 5).join(", ") || "core technologies";
    const summary = `Results-driven professional targeting ${role}, with hands-on experience in ${roleSummarySkills} and a track record of translating technical work into measurable outcomes.`;

    const skillsLine = prioritizedSkills.length
        ? `Technical Skills: ${prioritizedSkills.join(", ")}`
        : "Technical Skills: Add role-relevant tools, frameworks, and platforms from your actual experience.";

    const atsNotes = missing.length
        ? `ATS Focus Keywords: ${missing.join(", ")}`
        : "ATS Focus Keywords: Add role-specific terms from the job description naturally across summary and project bullets.";

    return [
        header,
        "",
        "PROFESSIONAL SUMMARY",
        summary,
        "",
        "EXPERIENCE / PROJECTS",
        ...(rewritten.length ? rewritten : ["- Developed role-aligned project deliverables with measurable impact and clear business outcomes."]),
        "",
        "SKILLS",
        skillsLine,
        "",
        "ATS OPTIMIZATION",
        atsNotes,
        "- Include at least one metric in each major project bullet (%, time, cost, users, throughput).",
        "- Keep language specific, concise, and role-relevant.",
    ].join("\n");
}

function buildEnhancerPrompt({ targetRole, missingKeywords, atsScore, resumeText }) {
    const role = targetRole || "Target role not provided";
    const keywords = Array.isArray(missingKeywords) ? missingKeywords.filter(Boolean) : [];
    const scoreValue = Number.isFinite(Number(atsScore)) ? `${Number(atsScore)}` : "Not provided";
    const keywordText = keywords.length ? keywords.join(", ") : "None provided";

    return `You are an expert ATS Resume Optimizer and Professional Resume Writer.

Your task is to improve and rewrite resume content professionally for a specific target role.

IMPORTANT RULES:

* Do NOT repeat phrases across bullets.
* Do NOT append generic text to every line.
* Rewrite each bullet uniquely and intelligently.
* Use strong action verbs.
* Keep content ATS-friendly and realistic.
* Add measurable impact or metrics naturally when possible.
* Include missing keywords naturally without keyword stuffing.
* Keep tone professional and concise.
* Avoid robotic or AI-sounding language.
* Improve grammar, clarity, and readability.
* Focus on achievements, technical contributions, and outcomes.
* Maintain original meaning while improving quality.
* Return ONLY the enhanced content.

TARGET ROLE:
${role}

MISSING KEYWORDS:
${keywordText}

CURRENT ATS SCORE:
${scoreValue}

RESUME CONTENT:
${resumeText}

ENHANCEMENT INSTRUCTIONS BY SECTION:

1. SUMMARY SECTION

* Create a strong professional summary.
* Mention technologies, strengths, and career focus.
* Keep it concise and impactful.

2. EXPERIENCE / PROJECTS

* Start with action verbs like Developed, Built, Designed, Implemented, Optimized, Engineered.
* Mention technologies used.
* Add business or user impact when possible.
* Make each bullet different in structure.

3. SKILLS SECTION

* Organize skills clearly.
* Prioritize relevant skills for the target role.

4. ATS OPTIMIZATION

* Naturally integrate missing keywords.
* Improve keyword relevance for the target role.

GOOD EXAMPLE:

Input:
"Built web applications using React."

Output:
"Developed responsive React.js web applications with optimized UI components and improved user experience."

Input:
"Worked on APIs."

Output:
"Designed and implemented RESTful APIs for scalable full-stack applications using Node.js and Express.js."

Now enhance the provided resume professionally.`;
}

async function extractResumeText(file) {
    const extension = path.extname(file.originalname || "").toLowerCase();

    if (extension === ".pdf" || file.mimetype === "application/pdf") {
        const parser = new PDFParse({ data: file.buffer });
        try {
            const parsed = await parser.getText();
            return parsed.text || "";
        } finally {
            await parser.destroy();
        }
    }

    if (extension === ".docx" || file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const parsed = await mammoth.extractRawText({ buffer: file.buffer });
        return parsed.value || "";
    }

    if (extension === ".txt" || file.mimetype === "text/plain") {
        return file.buffer.toString("utf8");
    }

    throw new Error("Please upload a PDF, DOCX, or TXT resume for ATS scoring.");
}

const openai = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000", 
        "X-Title": "Resume Enhancer",
    },
});

app.post("/suggest", async (req, res) => {
    const {
        text,
        resumeText,
        atsScore,
        bestRole,
        targetRole,
        missingSkills,
        missingKeywords,
    } = req.body;

    const content = resumeText || text;
    const role = targetRole || bestRole || "target role";
    const keywords = Array.isArray(missingKeywords)
        ? missingKeywords
        : (Array.isArray(missingSkills) ? missingSkills : []);

    if (!content) {
        return res.status(400).json({ error: "Resume text is required." });
    }

    try {
        const prompt = buildEnhancerPrompt({
            targetRole: role,
            missingKeywords: keywords,
            atsScore,
            resumeText: content,
        });

        const response = await openai.chat.completions.create({
            model: "mistralai/mistral-7b-instruct", 
            temperature: 0.7,
            top_p: 0.9,
            frequency_penalty: 0.35,
            presence_penalty: 0.25,
            messages: [
                {
                    role: "system",
                    content: "You are an expert ATS Resume Optimizer and Professional Resume Writer.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
        });

        const output = response.choices[0].message.content;
        res.json({ suggestions: output });
    } catch (err) {
        console.error("OpenRouter error:", err.message);
        const fallback = buildFallbackSuggestions({
            resumeText: content,
            atsScore,
            targetRole: role,
            missingKeywords: keywords,
        });
        res.json({
            suggestions: fallback,
            source: "fallback",
            note: "AI provider unavailable. Generated local ATS-focused suggestions.",
        });
    }
});

app.post("/scan", upload.single("resume"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Please upload a resume file." });
    }

    try {
        const resumeText = await extractResumeText(req.file);
        const cleanedText = normalizeText(resumeText);

        if (!cleanedText) {
            return res.status(422).json({ error: "Could not read any text from the uploaded resume." });
        }

        const rankedRoles = roleProfiles
            .map((profile) => scoreRole(cleanedText, profile))
            .sort((left, right) => right.atsScore - left.atsScore);

        const bestMatch = rankedRoles[0] || { role: "General Resume", atsScore: 0, matchedSkills: [], missingSkills: [] };

        res.json({
            atsScore: bestMatch.atsScore,
            bestRole: bestMatch.role,
            matchedSkills: bestMatch.matchedSkills,
            missingSkills: bestMatch.missingSkills,
            topMatches: rankedRoles.slice(0, 3),
        });
    } catch (err) {
        console.error("Resume scan error:", err.message);
        res.status(400).json({ error: err.message || "Failed to analyze resume." });
    }
});

function getJobSearchText(job) {
    return normalizeText([
        job.title,
        job.company_name,
        job.category,
        (job.tags || []).join(" "),
        job.job_type,
        job.candidate_required_location,
        job.salary,
        job.description,
    ].join(" "));
}

function scoreJobMatch(job, terms) {
    const jobText = getJobSearchText(job);
    const title = normalizeText(job.title);
    const category = normalizeText(job.category);
    const tagText = normalizeText((job.tags || []).join(" "));

    return terms.reduce((score, term) => {
        if (!term) {
            return score;
        }

        if (title.includes(term)) {
            return score + 8;
        }

        if (category.includes(term)) {
            return score + 5;
        }

        if (tagText.includes(term)) {
            return score + 4;
        }

        if (jobText.includes(term)) {
            return score + 2;
        }

        return score;
    }, 0);
}

app.get("/jobs", async (req, res) => {
    const role = String(req.query.role || "").trim();

    if (!role) {
        return res.status(400).json({ error: "Please enter a role to search for." });
    }

    try {
        const apiUrl = new URL("https://remotive.com/api/remote-jobs");
        apiUrl.searchParams.set("search", role);

        const response = await fetch(apiUrl.toString(), {
            headers: {
                Accept: "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`Remotive request failed with status ${response.status}`);
        }

        const data = await response.json();
        const jobs = Array.isArray(data.jobs) ? data.jobs : [];
        const searchTerms = normalizeText(role).split(" ").filter((term) => term.length > 1);

        const rankedJobs = jobs
            .map((job) => ({
                ...job,
                relevanceScore: scoreJobMatch(job, searchTerms),
            }))
            .filter((job) => searchTerms.length === 0 || job.relevanceScore > 0)
            .sort((left, right) => right.relevanceScore - left.relevanceScore || new Date(right.publication_date) - new Date(left.publication_date))
            .slice(0, 12)
            .map(({ relevanceScore, ...job }) => job);

        res.json({
            role,
            total: rankedJobs.length,
            jobs: rankedJobs,
            source: "remotive",
        });
    } catch (err) {
        console.error("Job search error:", err.message);
        res.status(500).json({ error: err.message || "Failed to fetch jobs." });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 OpenRouter server running at http://localhost:${PORT}`);
});

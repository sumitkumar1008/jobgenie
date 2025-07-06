const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { OpenAI } = require("openai");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000", 
        "X-Title": "Resume Enhancer",
    },
});

app.post("/suggest", async (req, res) => {
    const { text } = req.body;

    if (!text) {
        return res.status(400).json({ error: "Resume text is required." });
    }

    try {
        const response = await openai.chat.completions.create({
            model: "mistralai/mistral-7b-instruct", 
            messages: [
                {
                    role: "system",
                    content: "You are a professional resume writing assistant.",
                },
                {
                    role: "user",
                    content: `Improve these resume bullet points to sound more professional and impactful:\n\n${text}`,
                },
            ],
        });

        const output = response.choices[0].message.content;
        res.json({ suggestions: output });
    } catch (err) {
        console.error("OpenRouter error:", err.message);
        res.status(500).json({ error: "Failed to enhance resume." });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 OpenRouter server running at http://localhost:${PORT}`);
});

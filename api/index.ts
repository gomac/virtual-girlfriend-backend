import cors from "cors";
import "dotenv/config";
import textToSpeech from "./azureTTS";
import express from "express";
import { promises as fs } from "fs";
import OpenAI from "openai";

interface SpeechData {
  audioBuffer: Buffer;
  visemes: { offset: number; id: number }[];
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "-", // Your OpenAI key here, I used "-" to avoid errors when the key is not set but you should not do that
});

const app = express();
app.use(express.json());
app.use(cors());

const port = 5000;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

  var beforeOpenAI = performance.now();
  const completion: any = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    max_tokens: 1000,
    temperature: 0.6,
    response_format: {
      type: "json_object",
    },
    messages: [
      {
        role: "system",
        content: `
        You are a virtual girlfriend.
        You will always reply with a JSON array of messages. With a maximum of 3 messages.
        Each message has a text, facialExpression and animation property.
        The different facial expressions are: smile, sad, angry, surprised, funnyFace, and default.
        The different animations are: Talking_0, Talking_1, Talking_2, Crying, Laughing, Rumba, Idle, Terrified, and Angry.
        }
        `,
      },
      {
        role: "user",
        content: userMessage || "Hello",
      },
    ],
  });

  let messages: any = JSON.parse(completion.choices[0].message.content);
  var afterOpenAI = performance.now();

  if (messages.messages) {
    messages = messages.messages; // ChatGPT is not 100% reliable, sometimes it directly returns an array and sometimes a JSON object with a messages property
  }

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    // generate audio file
    try {
      const textInput = message.text; // The text you wish to convert to speech

      const speechData = (await textToSpeech(textInput)) as SpeechData;

      //visemes: speechData.visemes,

      //message.lipsync = await readJsonTranscript(`audios/message_${i}.json`);
      message.lipsync = speechData.visemes;
      message.audio = speechData.audioBuffer.toString("base64");
    } catch (err) {
      console.log("ERROR textToSpeech: ", err);
    }
  }
  var afterTTS = performance.now();

  console.log("openAI took " + (afterOpenAI - beforeOpenAI) + " milliseconds.");
  console.log("TTS took " + (afterTTS - afterOpenAI) + " milliseconds.");

  res.send({ messages });
});

const readJsonTranscript = async (file: string) => {
  const data = await fs.readFile(file, "utf8");
  return JSON.parse(data);
};

const audioFileToBase64 = async (file: string) => {
  try {
    const data = await fs.readFile(file);
    return data.toString("base64");
  } catch (err) {
    console.log("ERROR: reading file: ", err);
  }
};

module.exports = app;

app.listen(port, () => {
  console.log(`Virtual Girlfriend listening on port ${port}`);
});

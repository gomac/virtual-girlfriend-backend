import { exec } from "child_process";
import cors from "cors";
import dotenv from "dotenv";
import ElevenLabs from "elevenlabs-node";
import express from "express";
import { promises as fs } from "fs";
//import os from "os";
import * as path from "path";
import OpenAI from "openai";
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "-", // Your OpenAI API key here, I used "-" to avoid errors when the key is not set but you should not do that
});

const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;
const voiceID = "21m00Tcm4TlvDq8ikWAM";

const elevenOptions = {
  apiKey: elevenLabsApiKey, // Your API key from Elevenlabs
  voiceId: voiceID, // A Voice ID from Elevenlabs
};
const voice = new ElevenLabs(elevenOptions);

const app = express();
app.use(express.json());
app.use(cors());
const port = 3000;
const dir = "audios";

function createDirectories(pathname) {
  const __dirname = path.resolve();
  pathname = pathname.replace(/^\.*\/|\/?[^\/]+\.[a-z]+|\/$/g, ""); // Remove leading directory markers, and remove ending /file-name.extension
  fs.mkdir(pathname, { recursive: true }, (e) => {
    console.log("inside createDirectories mkdir");
    if (e) {
      console.error(dir, "createDirectories already exists: ", e);
    } else {
      console.log("SUCCESS");
    }
  });
}

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/voices", async (req, res) => {
  console.log("get voices");
  res.send(await voice.getVoices(elevenLabsApiKey));
});

/* const execCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(error);
      resolve(stdout);
    });
  });
}; */

/* const lipSyncMessage = async (message) => {
  const time = new Date().getTime();
  console.log(`Starting newconversion for message ${message}`);
  await execCommand(
    `ffmpeg -y -i audios/message_${message}.mp3 audios/message_${message}.wav`
    // -y to overwrite the file
  );

  // See if the file exists
  if (await fs.readFile(`audios/message_${message}.wav`)) {
    console.log("Wave file exists");
  } else {
    console.log("Wave file does not exist");
  }

  console.log(`Conversion done in ${new Date().getTime() - time}ms`);
  if (os.platform() == "darwin") {
    await execCommand(
      `./macBin/rhubarb -f json  -r phonetic -o audios/message_${message}.json audios/message_${message}.wav`
    );
  } else {
    await execCommand(
      `./linBin/rhubarb -f json  -r phonetic -o audios/message_${message}.json audios/message_${message}.wav`
    );
  }

  // -r phonetic is faster but less accurate
  console.log(`Lip sync done in ${new Date().getTime() - time}ms`);
}; */

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

  if (!userMessage) {
    res.send({
      messages: [
        {
          text: "Hey dear... How was your day?",
          audio: await audioFileToBase64("audios/intro_0.wav"),
          lipsync: await readJsonTranscript("audios/intro_0.json"),
          facialExpression: "smile",
          animation: "Talking_1",
        },
        {
          text: "I missed you so much... Please don't go for so long!",
          audio: await audioFileToBase64("audios/intro_1.wav"),
          lipsync: await readJsonTranscript("audios/intro_1.json"),
          facialExpression: "sad",
          animation: "Crying",
        },
      ],
    });
    return;
  }
  if (!elevenLabsApiKey || openai.apiKey === "-") {
    res.send({
      messages: [
        {
          text: "Please my dear, don't forget to add your API keys!",
          audio: await audioFileToBase64("audios/api_0.wav"),
          lipsync: await readJsonTranscript("audios/api_0.json"),
          facialExpression: "angry",
          animation: "Angry",
        },
        {
          text: "You don't want to ruin Wawa Sensei with a crazy ChatGPT and ElevenLabs bill, right?",
          audio: await audioFileToBase64("audios/api_1.wav"),
          lipsync: await readJsonTranscript("audios/api_1.json"),
          facialExpression: "smile",
          animation: "Laughing",
        },
      ],
    });
    return;
  }

  const completion = await openai.chat.completions.create({
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
        Each message has a text, facialExpression, animation and property.
        The different facial expressions are: smile, sad, angry, surprised, funnyFace, and default.
        The different animations are: Talking_0, Talking_1, Talking_2, Crying, Laughing, Rumba, Idle, Terrified, and Angry.
        `,
      },
      {
        role: "user",
        content: userMessage || "Hello",
      },
    ],
  });
  console.log("Calling openAI");
  let messages = JSON.parse(completion.choices[0].message.content);
  console.log("Received response from openAI openAI");
  if (messages.messages) {
    messages = messages.messages; // ChatGPT is not 100% reliable, sometimes it directly returns an array and sometimes a JSON object with a messages property
  }
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    // generate audio file
    try {
      console.log("Calling createDirectories");
      createDirectories(dir);

      const fileName = `audios/message_${i}.mp3`; // The name of your audio file
      console.log("filename is: ", fileName);
      const textInput = message.text; // The text you wish to convert to speech
      console.log("elevenbuddy: ", elevenLabsApiKey);
      const response = await voice.textToSpeech({
        voiceID,
        fileName,
        textInput,
        similarityBoost: 0,
      });

      console.log("text to create audio: ", textInput);
      // generate lipsync
      //await lipSyncMessage(i);
      message.audio = await audioFileToBase64(fileName);
      message.lipsync = await readJsonTranscript(`audios/message_${i}.json`);
    } catch (err) {
      console.log("ERROR textToSpeech: ", err);
    }
  }
  res.send({ messages });
});

const readJsonTranscript = async (file) => {
  const data = await fs.readFile(file, "utf8");
  return JSON.parse(data);
};

const audioFileToBase64 = async (file) => {
  try {
    const data = await fs.readFile(file);
    return data.toString("base64");
  } catch (err) {
    console.log("ERROR: reading file: ", err);
  }
};

app.listen(port, () => {
  console.log(`Virtual Girlfriend listening on port ${port}`);
});

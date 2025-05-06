require('dotenv').config();
const Groq = require('groq-sdk');
const fs = require('fs');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const speechFilePath = "./public/speech.wav";
const model = "playai-tts"; // Modelo correto para TTS
const voice = "Fritz-PlayAI"; // Verifique a voz desejada
const text = "Olá! Seja bem-vindo à Clínica Saúde e Bem-Estar 🌿. Como posso te ajudar hoje?"; // Texto em português
const responseFormat = "wav";

async function main() {
  try {
    const response = await groq.audio.speech.create({
      model: model,
      voice: voice,
      input: text,
      response_format: responseFormat
    });
    
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.promises.writeFile(speechFilePath, buffer);
    console.log("Arquivo de fala gerado com sucesso!");
  } catch (error) {
    console.error("Erro ao gerar a fala:", error);
  }
}

main();
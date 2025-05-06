require('dotenv').config();
const fs = require('fs');
const Groq = require('groq-sdk');

const treinamento = require('./treinamento');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function main() {
  const completion = await groq.chat.completions
    .create({
      messages: [
        {
          role: "user",
          content: treinamento+"as mensagens do usuario: php ou java",
        },
      ],
      model: "llama-3.3-70b-versatile",
    })
  console.log(completion.choices[0].message.content);
}

main();
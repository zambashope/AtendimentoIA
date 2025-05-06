const fs = require('fs');
const qrcode = require('qrcode-terminal');
const { Client } = require('whatsapp-web.js');
const Groq = require('groq-sdk');
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const whatsapp = new Client();
const DB_PATH = './db.json';
const treinamento = require('./treinamento');



// Carrega o histórico do JSON
const loadDB = () => {
  console.log('🔄 Carregando histórico do banco de dados...');
  if (!fs.existsSync(DB_PATH)) {
    console.log('📁 Banco de dados não encontrado. Criando novo...');
    return {};
  }
  const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  console.log('✅ Histórico carregado com sucesso.');
  return data;
};

// Salva o histórico no JSON
const saveDB = (db) => {
  console.log('💾 Salvando histórico no banco de dados...');
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  console.log('✅ Histórico salvo.');
};

// Cria a resposta da IA com base no histórico
const getGroqChatCompletion = async (userHistory) => {
  console.log('🧠 Enviando histórico para a IA...');
  const messages = [
    {
      role: "system",
      content: treinamento
    },
    ...userHistory.map(msg => ({
      role: msg.from === 'user' ? 'user' : 'assistant',
      content: msg.message
    }))
  ];

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages,
      model: "llama3-70b-8192"
    });
    const response = chatCompletion.choices[0]?.message?.content || "Desculpe, não consegui entender.";
    console.log('✅ Resposta da IA recebida:', response);
    return response;
  } catch (error) {
    console.error('❌ Erro ao obter resposta da IA:', error);
    return "Desculpe, ocorreu um erro ao tentar responder.";
  }
};

// Inicializa o QR code do WhatsApp
whatsapp.on('qr', qr => {
  console.log('📱 Escaneie o QR Code para conectar no WhatsApp:');
  qrcode.generate(qr, { small: true });
});

// Pronto para uso
whatsapp.on('ready', () => {
  console.log('🤖 Bot de atendimento da Clínica está online!');
});

// Mensagens recebidas
whatsapp.on('message_create', async msg => {
  if (msg.fromMe) return;

  const userId = msg.from;
  console.log(`📩 Mensagem recebida de ${userId}:`, msg.body);

  const db = loadDB();

  if (!db[userId]) {
    console.log(`👤 Novo usuário detectado: ${userId}`);
    db[userId] = [];

    const welcomeMessage = "Olá! Seja bem-vindo à Clínica Saúde e Bem-Estar 🌿. Como posso te ajudar hoje?";
    console.log(`📤 Enviando mensagem de boas-vindas para ${userId}`);
    await whatsapp.sendMessage(userId, welcomeMessage);

    db[userId].push({ from: 'bot', message: welcomeMessage });
  }

  db[userId].push({ from: 'user', message: msg.body });

  console.log('🧠 Gerando resposta da IA...');
  const aiResponse = await getGroqChatCompletion(db[userId]);

  console.log(`📤 Enviando resposta para ${userId}:`, aiResponse);
  await whatsapp.sendMessage(userId, aiResponse);

  db[userId].push({ from: 'bot', message: aiResponse });

  saveDB(db);
});

whatsapp.initialize();

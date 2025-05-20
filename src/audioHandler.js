// audioHandler.js
const fs = require('fs').promises;
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

const saveAudioMessage = async (message) => {
  try {
    if (!message.hasMedia || message.type !== 'ptt') return null;

    const media = await message.downloadMedia();
    if (!media) return null;

    const senderId = message.from.replace('@c.us', '');
    const timestamp = message.timestamp || Date.now();
    const filename = `audio_${senderId}_${timestamp}.ogg`;
    const filePath = path.join(__dirname, 'audios', filename);

    await fs.mkdir(path.join(__dirname, 'audios'), { recursive: true });
    await fs.writeFile(filePath, Buffer.from(media.data, 'base64'));

    console.log(`✅ Áudio salvo: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error('❌ Erro ao salvar áudio:', error);
    return null;
  }
};

const transcreverAudio = async (audioPath) => {
  try {
    const form = new FormData();
    form.append('file', await fs.readFile(audioPath), {
      filename: path.basename(audioPath),
      contentType: 'audio/ogg',
    });
    form.append('model', 'whisper-large-v3-turbo');
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'word');
    form.append('timestamp_granularities[]', 'segment');
    form.append('language', 'pt');
    form.append('temperature', '0');

    const response = await axios.post(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        maxContentLength: 25 * 1024 * 1024,
      }
    );

    console.log('✅ Transcrição concluída:', response.data.text);
    return response.data.text;
  } catch (error) {
    console.error('❌ Erro na transcrição:', error.response?.data || error.message);
    return null;
  }
};

const cleanupAudio = async (audioPath) => {
  try {
    await fs.unlink(audioPath);
    console.log(`🗑️ Áudio deletado: ${audioPath}`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao deletar áudio:', error.message);
    return false;
  }
};

module.exports = { saveAudioMessage, transcreverAudio, cleanupAudio };
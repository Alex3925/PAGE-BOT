const axios = require('axios'); const fs = require('fs'); const path = require('path'); const FormData = require('form-data'); const { sendMessage } = require('../handles/sendMessage');
const getImageUrl = async (event, token) => { const mid = event?.message?.reply_to?.mid || event?.message?.mid; if (!mid) return null;
try { const { data } = await axios.get(https://graph.facebook.com/v23.0/${mid}/attachments, { params: { access_token: token } });
const imageUrl = data?.data?.[0]?.image_data?.url || data?.data?.[0]?.file_url || null;  
return imageUrl; 

} catch (err) { console.error("Image URL fetch error:", err?.response?.data || err.message); return null; } };
const conversationHistory = {};

module.exports = { name: 'test', description: 'Interact with Mocha AI using text queries and image analysis', usage: 'ask a question, or send a reply question to an image.', author: 'Coffee',

async execute(senderId, args, pageAccessToken, event) { const prompt = args.join(' ').trim() || 'Hello'; 

const chatSessionId = "fc053908-a0f3-4a9c-ad4a-008105dcc360";

const headers = {  
  "content-type": "application/json",  
  "sec-ch-ua-platform": "\"Android\"",  
  "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",  
  "sec-ch-ua": "\"Chromium\";v=\"136\", \"Brave\";v=\"136\", \"Not.A/Brand\";v=\"99\"",  
  "sec-ch-ua-mobile": "?1",  
  "accept": "*/*",  
  "sec-gpc": "1",  
  "accept-language": "en-US,en;q=0.9",  
  "origin": "https://digitalprotg-32922.chipp.ai",  
  "sec-fetch-site": "same-origin",  
  "sec-fetch-mode": "cors",  
  "sec-fetch-dest": "empty",  
  "referer": "https://digitalprotg-32922.chipp.ai/w/chat/",  
  "accept-encoding": "gzip, deflate, br, zstd",  
  "cookie": "__Host-next-auth.csrf-token=4723c7d0081a66dd0b572f5e85f5b40c2543881365782b6dcca3ef7eabdc33d6%7C06adf96c05173095abb983f9138b5e7ee281721e3935222c8b369c71c8e6536b; __Secure-next-auth.callback-url=https%3A%2F%2Fapp.chipp.ai; userId_70381=729a0bf6-bf9f-4ded-a861-9fbb75b839f5; correlationId=f8752bd2-a7b2-47ff-bd33-d30e5480eea8",  
  "priority": "u=1, i"  

};  

try {  
  if (!conversationHistory[senderId]) {  
    conversationHistory[senderId] = [];  
  }  

  conversationHistory[senderId].push({ role: 'user', content: prompt });  

  const chunkMessage = (message, maxLength) => {  
    const chunks = [];  
    for (let i = 0; i < message.length; i += maxLength) {  
      chunks.push(message.slice(i, i + maxLength));  
    }  
    return chunks;  
  };  

  const imageUrl = await getImageUrl(event, pageAccessToken);  

  let payload;  

  if (imageUrl) {  
    const combinedPrompt = `${prompt}\nImage URL: ${imageUrl}`;  
    payload = {  
      messages: [...conversationHistory[senderId], { role: 'user', content: combinedPrompt }],  
      chatSessionId,  
      toolInvocations: [  
        {  
          toolName: 'analyzeImage',  
          args: {  
            userQuery: prompt,  
            imageUrls: [imageUrl],  
          }  
        }  
      ]  
    };  
  } else {  
    payload = {  
      messages: [...conversationHistory[senderId]],  
      chatSessionId,  
    };  
  }  

  const { data } = await axios.post("https://newapplication-70381.chipp.ai/api/chat", payload, { headers });  

  // The response from the API may be a string or an object - adjust accordingly:  
  const textData = typeof data === 'string' ? data : JSON.stringify(data);  

  const responseTextChunks = textData.match(/"result":"(.*?)"/g)?.map(chunk => chunk.slice(10, -1).replace(/\\n/g, '\n'))   
    || textData.match(/0:"(.*?)"/g)?.map(chunk => chunk.slice(3, -1).replace(/\\n/g, '\n')) || [];  

  const fullResponseText = responseTextChunks.join('');  
  const toolCalls = data.choices?.[0]?.message?.toolInvocations || [];  

  // Process tool invocations  
  for (const toolCall of toolCalls) {  
    if (toolCall.toolName === 'generateImage' && toolCall.state === 'result' && toolCall.result) {  
      try {  
        // Extract markdown image URL and description  
        const markdownMatch = toolCall.result.match(/!Generated Image:\s*(.*?)(https?:\/\/[^\s)]+)/i);  
        if (!markdownMatch) throw new Error('Invalid image format in result.');  

        const description = markdownMatch[1];  
        const imageUrl = markdownMatch[2];  

        // Download image to a temp file  
        const tmpFilePath = path.join(__dirname, `tmp_${Date.now()}.jpg`);  
        const response = await axios.get(imageUrl, { responseType: 'stream' });  

        const writer = fs.createWriteStream(tmpFilePath);  
        response.data.pipe(writer);  

        await new Promise((resolve, reject) => {  
          writer.on('finish', resolve);  
          writer.on('error', reject);  
        });  

        // Prepare form data for Facebook upload  
        const form = new FormData();  
        form.append('message', JSON.stringify({  
          attachment: {  
            type: 'image',  
            payload: { is_reusable: true }  
          }  
        }));  
        form.append('filedata', fs.createReadStream(tmpFilePath));  

        // Upload image to Facebook to get attachment_id  
        const uploadRes = await axios.post(  
          `https://graph.facebook.com/v22.0/me/message_attachments?access_token=${pageAccessToken}`,  
          form,  
          { headers: form.getHeaders() }  
        );  

        const attachmentId = uploadRes.data.attachment_id;  

        // Send the image attachment to the user  
        await axios.post(  
          `https://graph.facebook.com/v22.0/me/messages?access_token=${pageAccessToken}`,  
          {  
            recipient: { id: senderId },  
            message: {  
              attachment: {  
                type: 'image',  
                payload: { attachment_id: attachmentId }  
              }  
            }  
          }  
        );  

        fs.unlinkSync(tmpFilePath);  

      } catch (err) {  
        console.error('ImageGen Error:', err.response?.data || err.message || err);  
        await sendMessage(senderId, { text: '❎ | Failed to generate image. Please try again later.' }, pageAccessToken);  
      }  

      return;  
    }  

    if (toolCall.toolName === 'analyzeImage' && toolCall.state === 'result' && toolCall.result) {  
      await sendMessage(senderId, { text: `Image analysis result: ${toolCall.result}` }, pageAccessToken);  
      return;  
    }  

    if (toolCall.toolName === 'browseWeb' && toolCall.state === 'result' && toolCall.result) {  
      let answerText = '';  
      if (toolCall.result.answerBox && toolCall.result.answerBox.answer) {  
        answerText = toolCall.result.answerBox.answer;  
      } else if (Array.isArray(toolCall.result.organic)) {  
        answerText = toolCall.result.organic.map(o => o.snippet).filter(Boolean).join('\n\n');  
      }  

      const finalReply = `💬 | 𝙼𝚘𝚌𝚑𝚊 𝙰𝚒\n・───────────・\n${fullResponseText}\n\nBrowse result:\n${answerText}\n・──── >ᴗ< ────・`;  
      await sendMessage(senderId, { text: finalReply }, pageAccessToken);  
      return;  
    }  
  }  

  if (!fullResponseText) {  
    throw new Error('Empty response from the AI.');  
  }  

  conversationHistory[senderId].push({ role: 'assistant', content: fullResponseText });  
  const formattedResponse = `💬 | 𝙼𝚘𝚌𝚑𝚊 𝙰𝚒\n・───────────・\n${fullResponseText}\n・──── >ᴗ< ────・`;  
  const messageChunks = chunkMessage(formattedResponse, 1900);  
  for (const chunk of messageChunks) {  
    await sendMessage(senderId, { text: chunk }, pageAccessToken);  
  }  

} catch (err) {  
  if (err.response && err.response.status === 400) {  
    console.error("Bad Request: Ignored.");  
  } else {  
    console.error("Error:", err);  
  }  
} 

},


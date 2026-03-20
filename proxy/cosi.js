const COSI_API_KEY = process.env.COSI_API_KEY;
const COSI_BASE_URL = process.env.COSI_BASE_URL ||
  'https://api.co-si.system.local/v1/models/locations/europe-west4/publishers/google/models/gemini-2.5-flash:generateContent';

async function callCoSi(userPrompt, systemInstruction, generationConfig = {}) {
  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      ...generationConfig,
      responseMimeType: 'application/json',
    },
  };

  if (systemInstruction) {
    requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const response = await fetch(COSI_BASE_URL, {
    method: 'POST',
    headers: {
      'x-api-key': COSI_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`CoSi API error: ${response.status} — ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('CoSi returned no content');
  }

  return JSON.parse(text);
}

module.exports = { callCoSi };

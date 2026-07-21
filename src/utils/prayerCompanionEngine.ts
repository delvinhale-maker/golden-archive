export type SessionType =
  | 'morning'
  | 'midday'
  | 'warfare-hour'
  | 'evening'
  | 'night-watch'
  | 'urgent'
  | 'intercession';

export interface PrayerSection {
  id: string;
  title: string;
  content: string;
  voiceStyle: string;
}

export interface GeneratedPrayer {
  greeting: string;
  sections: PrayerSection[];
  closing_declaration: string;
  scripture_anchor: string;
  full_prayer_text: string;
}

export const generatePrayerSession = async (
  firstName: string,
  mountain: string,
  gifts: string[],
  assignmentText: string,
  streak: number,
  challengeDay: number,
  seasonName: string,
  sessionType: SessionType,
  prayerRequest?: string
): Promise<GeneratedPrayer | null> => {
  const gift = gifts?.[0] || 'your gifts';
  const prompt = `
Generate a personalized Kingdom prayer for
${firstName} using Myles Munroe's 7-part
Prayer Template of Jesus.

Profile:
- Name: ${firstName}
- Mountain: ${mountain}
- Gift: ${gift}
- Assignment: ${assignmentText || 'discovering their Kingdom assignment'}
- Season: ${seasonName}
- Challenge Day: ${challengeDay} of 30
- Streak: ${streak} days
- Session Type: ${sessionType}
${prayerRequest
  ? `- Specific Request: ${prayerRequest}`
  : ''}

Use ${firstName}'s name naturally at key
moments — opening, personal sections,
declarations. Not every sentence.

Return ONLY valid JSON no markdown:
{
  "greeting": "Personal opening using ${firstName}",
  "sections": [
    {
      "id": "relationship",
      "title": "Our Father",
      "content": "Prayer text here...",
      "voiceStyle": "companion"
    },
    {
      "id": "worship",
      "title": "Hallowed Be Your Name",
      "content": "Prayer text here...",
      "voiceStyle": "scripture"
    },
    {
      "id": "kingdom",
      "title": "Your Kingdom Come",
      "content": "Prayer text here...",
      "voiceStyle": "companion"
    },
    {
      "id": "alignment",
      "title": "Your Will Be Done",
      "content": "Prayer text here...",
      "voiceStyle": "companion"
    },
    {
      "id": "petition",
      "title": "Daily Bread",
      "content": "Prayer text here...",
      "voiceStyle": "personal"
    },
    {
      "id": "forgiveness",
      "title": "Forgive As We Forgive",
      "content": "Prayer text here...",
      "voiceStyle": "personal"
    },
    {
      "id": "authority",
      "title": "Deliver Us From Evil",
      "content": "Bold declaration here...",
      "voiceStyle": "declaration"
    }
  ],
  "closing_declaration": "Final bold declaration with ${firstName}",
  "scripture_anchor": "Reference only e.g. Philippians 4:6",
  "full_prayer_text": "Complete prayer as one flowing text"
}
`;

  try {
    const response = await fetch(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: prompt
          }]
        })
      }
    );

    const data = await response.json();
    const text = data.content
      .map((i: any) => i.text || '')
      .join('');
    const clean = text
      .replace(/```json|```/g, '')
      .trim();

    return JSON.parse(clean);
  } catch (err) {
    console.error('Prayer generation failed:', err);
    return null;
  }
};

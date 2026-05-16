const NOTION_TOKEN     = process.env.NOTION_TOKEN;
const NOTION_DB_ID     = process.env.NOTION_DATABASE_ID;
const IMGBB_API_KEY    = process.env.IMGBB_API_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    name, email, whatsapp, goal, otherGoal,
    styleRefs, brandColors, specificNeeds, paymentScreenshot
  } = req.body;

  if (!name || !email || !goal) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Upload screenshot to ImgBB
    let screenshotUrl = null;
    if (paymentScreenshot && IMGBB_API_KEY) {
      const imgbbRes = await fetch(
        `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            image: paymentScreenshot,
            name:  `order-${Date.now()}`
          })
        }
      );
      const imgbbData = await imgbbRes.json();
      screenshotUrl = imgbbData?.data?.url ?? null;
    }

    // 2. Create Notion page
    const notionBody = {
      parent: { database_id: NOTION_DB_ID },
      properties: {
        'Name':    { title: [{ text: { content: name } }] },
        'Email':   { email },
        'WhatsApp':{ phone_number: whatsapp },
        'Goal':    { select: { name: goal } },
        'Status':  { select: { name: 'New 🆕' } },
      }
    };

    if (otherGoal)      notionBody.properties['Other Goal']        = { rich_text: [{ text: { content: otherGoal } }] };
    if (styleRefs)      notionBody.properties['Style References']  = { rich_text: [{ text: { content: styleRefs } }] };
    if (brandColors)    notionBody.properties['Brand Colors']      = { rich_text: [{ text: { content: brandColors } }] };
    if (specificNeeds)  notionBody.properties['Specific Needs']    = { rich_text: [{ text: { content: specificNeeds } }] };
    if (screenshotUrl)  notionBody.properties['Payment Screenshot']= { url: screenshotUrl };

    const notionRes = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization':   `Bearer ${NOTION_TOKEN}`,
        'Content-Type':    'application/json',
        'Notion-Version':  '2022-06-28'
      },
      body: JSON.stringify(notionBody)
    });

    if (!notionRes.ok) {
      const err = await notionRes.text();
      console.error('Notion error:', err);
      return res.status(500).json({ error: 'Failed to log to Notion' });
    }

    return res.status(200).json({ success: true, screenshotUrl });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

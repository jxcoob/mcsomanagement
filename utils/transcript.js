/**
 * Generates an HTML transcript from a Discord text channel's messages.
 */
async function generateTranscript(channel) {
  const messages = [];
  let before = undefined;

  // Fetch all messages (Discord returns 100 max per request)
  while (true) {
    const fetched = await channel.messages.fetch({ limit: 100, before });
    if (fetched.size === 0) break;
    messages.push(...fetched.values());
    before = fetched.last().id;
    if (fetched.size < 100) break;
  }

  // Oldest first
  messages.reverse();

  const rows = messages.map((msg) => {
    const time = msg.createdAt.toISOString();
    const author = msg.author.tag;
    const content = escapeHtml(msg.content || '(no text)');
    const attachments = msg.attachments.size
      ? `<div class="meta">Attachments: ${[...msg.attachments.values()]
          .map(a => escapeHtml(a.url))
          .join(', ')}</div>`
      : '';

    return `<div class="msg"><div class="meta">${time} | ${escapeHtml(author)}</div><div class="content">${content}</div>${attachments}</div>`;
  });

  const html = `<!DOCTYPE html>
<html><head><meta charset='utf-8'><title>Ticket Transcript</title>
<style>body{font-family:system-ui;padding:1rem;background:#1e1e1e;color:#ddd;} .msg{margin:0.5rem 0;padding:0.5rem;background:#2d2d2d;border-radius:4px;} .meta{font-size:0.85em;color:#888;} .content{margin-top:0.25rem;}</style>
</head><body>
${rows.join('\n')}
</body></html>`;

  return Buffer.from(html, 'utf8');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { generateTranscript };

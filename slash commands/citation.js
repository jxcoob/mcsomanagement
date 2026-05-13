const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const PDFDocument = require('pdfkit');
const { createCanvas } = require('@napi-rs/canvas');
const axios = require('axios');

const LOG_CHANNEL_ID = '1498131740202369127';
const ALLOWED_ROLES  = ['1498131737450905795'];

// ── Utilities ────────────────────────────────────────────────────────────────

function generateTicketNo() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
}

async function getRobloxUser(username) {
    const res = await axios.post('https://users.roblox.com/v1/usernames/users', {
        usernames: [username],
        excludeBannedUsers: false,
    });
    const user = res.data?.data?.[0];
    if (!user) throw new Error(`No Roblox user found for: ${username}`);
    return { id: user.id, name: user.name };
}

function extractNicknameUsername(nickname) {
    if (!nickname) return null;
    const match = nickname.match(/^[A-Za-z]-\d+ \| (.+)$/);
    return match ? match[1].trim() : null;
}

// ── Canvas helpers ────────────────────────────────────────────────────────────

function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && current) {
            lines.push(current);
            current = word;
        } else {
            current = test;
        }
    }
    if (current) lines.push(current);
    return lines;
}

function drawWrapped(ctx, text, x, y, maxWidth, lineHeight) {
    for (const rawLine of text.split('\n')) {
        for (const line of wrapText(ctx, rawLine, maxWidth)) {
            ctx.fillText(line, x, y);
            y += lineHeight;
        }
    }
    return y;
}

function wrappedHeight(ctx, text, maxWidth, lineHeight) {
    let h = 0;
    for (const rawLine of text.split('\n')) {
        h += wrapText(ctx, rawLine, maxWidth).length * lineHeight;
    }
    return h;
}

// ── PNG builder — layout mirrors the PDF tables exactly ───────────────────────

function buildCitationImage(fields) {
    const SCALE = 2;
    const PW    = 850;
    const PH    = 1300; // tall working canvas; trimmed at end
    const canvas = createCanvas(PW * SCALE, PH * SCALE);
    const ctx    = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);

    const ML  = 50;
    const CW  = PW - ML * 2;   // 750
    const PX  = 8;              // cell horizontal padding
    const PY  = 7;              // cell vertical padding
    const LBL = 9;              // label font size
    const VAL = 12;             // value font size
    const VLH = 16;             // value line height
    const GAP = 7;              // gap between tables

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PW, PH);
    ctx.fillStyle = '#000000';

    let y = 50;

    function strokeBox(x, ry, w, h) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, ry + 0.5, w, h);
    }

    function vDivider(x, ry, h) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, ry);
        ctx.lineTo(x + 0.5, ry + h);
        ctx.stroke();
    }

    function cellHeight(value, w) {
        ctx.font = `${VAL}px sans-serif`;
        const th = wrappedHeight(ctx, value, w - PX * 2, VLH);
        return Math.max(44, PY + LBL + 4 + th + PY);
    }

    function drawCell(label, value, x, ry, w) {
        ctx.font = `bold ${LBL}px sans-serif`;
        ctx.fillText(label, x + PX, ry + PY + LBL);
        ctx.font = `${VAL}px sans-serif`;
        drawWrapped(ctx, value, x + PX, ry + PY + LBL + 4 + VAL, w - PX * 2, VLH);
    }

    // ── Header ────────────────────────────────────────────────────────────────

    ctx.textAlign = 'center';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText("Missoula County Sheriff's Office", PW / 2, y + 20);
    y += 34;
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('MONTANA STATE CITATION TICKET', PW / 2, y + 13);
    y += 26;
    ctx.textAlign = 'left';

    // ── Table 1: TICKET NO. | DATE OF ISSUE | TIME ────────────────────────────

    const col3 = Math.floor(CW / 3);
    const t1H  = 44;
    strokeBox(ML, y, CW, t1H);
    vDivider(ML + col3,     y, t1H);
    vDivider(ML + col3 * 2, y, t1H);
    drawCell('TICKET NO.',    fields.ticketNo,    ML,             y, col3);
    drawCell('DATE OF ISSUE', fields.dateOfIssue, ML + col3,      y, col3);
    drawCell('TIME',          fields.timeOfIssue, ML + col3 * 2,  y, CW - col3 * 2);
    y += t1H + GAP;

    // ── Table 2: OFFENDER | IDENTIFICATION NO. ────────────────────────────────

    const col2 = Math.floor(CW / 2);
    const t2H  = 44;
    strokeBox(ML, y, CW, t2H);
    vDivider(ML + col2, y, t2H);
    drawCell('OFFENDER',           fields.robloxUsername,   ML,        y, col2);
    drawCell('IDENTIFICATION NO.', String(fields.robloxId), ML + col2, y, CW - col2);
    y += t2H + GAP;

    // ── Table 3: ASSOCIATED VEHICLE ───────────────────────────────────────────

    const t3H = cellHeight(fields.vehicle, CW);
    strokeBox(ML, y, CW, t3H);
    drawCell('ASSOCIATED VEHICLE', fields.vehicle, ML, y, CW);
    y += t3H + GAP;

    // ── Table 4: CHARGES ──────────────────────────────────────────────────────

    const t4H = cellHeight(fields.charges, CW);
    strokeBox(ML, y, CW, t4H);
    drawCell('CHARGES', fields.charges, ML, y, CW);
    y += t4H + GAP;

    // ── Table 5: FINE | ISSUED BY + BADGE NO. ────────────────────────────────

    const fineVal = fields.fine === '0' ? 'N/A' : `$${fields.fine}`;
    const t5H = 82;
    strokeBox(ML, y, CW, t5H);
    vDivider(ML + col2, y, t5H);

    // Left: FINE label + large value
    ctx.font = `bold ${LBL}px sans-serif`;
    ctx.fillText('FINE', ML + PX, y + PY + LBL);
    ctx.font = 'bold 27px sans-serif';
    ctx.fillText(fineVal, ML + PX, y + PY + LBL + 6 + 27);

    // Right: ISSUED BY
    const rX = ML + col2 + PX;
    ctx.font = `bold ${LBL}px sans-serif`;
    ctx.fillText('ISSUED BY', rX, y + PY + LBL);
    ctx.font = `${VAL}px sans-serif`;
    ctx.fillText(fields.issuerTag, rX, y + PY + LBL + 4 + VAL);

    // Right: BADGE NO.
    const badgeTopY = y + PY + LBL + 4 + VAL + 10;
    ctx.font = `bold ${LBL}px sans-serif`;
    ctx.fillText('BADGE NO.', rX, badgeTopY + LBL);
    ctx.font = `${VAL}px sans-serif`;
    ctx.fillText(String(fields.issuerId), rX, badgeTopY + LBL + 4 + VAL);

    y += t5H + 18;

    // ── Notice paragraphs ─────────────────────────────────────────────────────

    const BW  = CW;
    const BLH = 14;

    function noticeHeader(text) {
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(text, ML, y + 10);
        y += 17;
    }

    function noticeBody(text) {
        ctx.font = '9.5px sans-serif';
        y = drawWrapped(ctx, text, ML, y + 9.5, BW, BLH);
        y += 7;
    }

    function noticeBullet(text) {
        ctx.font = '9.5px sans-serif';
        ctx.fillText('\u2022', ML + 9, y + 9.5);
        y = drawWrapped(ctx, text, ML + 20, y + 9.5, BW - 20, BLH);
        y += 5;
    }

    noticeHeader('NOTICE:');
    noticeBody('The offender has been cited for the violation(s) listed above. The offender is required by law to respond to this citation by 30 days from the date of issue.');

    noticeHeader('PAYMENT (If applicable) -');
    noticeBody('You may either pay the fine listed by one of two options:');
    noticeBullet('Through the Missoula County Sheriff\u2019s Office online system. MCSO Official Site');
    noticeBullet('In person, visiting the Missoula County Sheriff\u2019s Office Station, located at 908, Maple Street, Missoula County, MT');
    y += 4;

    noticeHeader('CONTEST VIA COURT -');
    noticeBody('If you wish to contest this violation, you are required to file a written request for a court hearing within 14 days of the date of issue.');

    // FAILURE TO RESPOND — bold label inline with normal sentence
    const failLabel = 'FAILURE TO RESPOND \u2013 ';
    ctx.font = 'bold 9.5px sans-serif';
    const failLabelW = ctx.measureText(failLabel).width;
    ctx.fillText(failLabel, ML, y + 9.5);
    ctx.font = '9.5px sans-serif';
    const failBody = 'Failure to pay the fine (if applicable) within 30 days of the date of issue or request a hearing within 14 days of the date of issue will result in additional charges, license suspension, or issuance of a warrant.';
    const firstLineMax = BW - failLabelW;
    const words = failBody.split(' ');
    let firstLine = '';
    let restStart = words.length;
    for (let i = 0; i < words.length; i++) {
        const test = firstLine ? `${firstLine} ${words[i]}` : words[i];
        if (ctx.measureText(test).width > firstLineMax) { restStart = i; break; }
        firstLine = test;
    }
    ctx.fillText(firstLine, ML + failLabelW, y + 9.5);
    y += BLH + 2;
    if (restStart < words.length) {
        y = drawWrapped(ctx, words.slice(restStart).join(' '), ML, y + 2, BW, BLH);
    }

    // Trim canvas to content and return
    const finalH = y + 30;
    const out    = createCanvas(PW * SCALE, finalH * SCALE);
    const octx   = out.getContext('2d');
    octx.drawImage(canvas, 0, 0);
    return out.toBuffer('image/png');
}

// ── PDF builder ───────────────────────────────────────────────────────────────

function buildPdf(fields) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        const doc = new PDFDocument({ size: 'LETTER', margin: 0 });
        doc.on('data', c => chunks.push(c));
        doc.on('end',  () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const ML = 50, MR = 562;
        const CW = MR - ML; // 512
        const PX = 6;
        const PY = 5;

        let y = 50;

        function drawRect(x, ry, w, h) { doc.rect(x, ry, w, h).stroke(); }
        function vline(x, ry, h) { doc.moveTo(x, ry).lineTo(x, ry + h).stroke(); }

        function cellContent(label, value, x, ry, w, opts = {}) {
            const { labelSize = 8, valueSize = 10 } = opts;
            doc.font('Helvetica-Bold').fontSize(labelSize)
                .text(label, x + PX, ry + PY, { width: w - PX * 2, lineBreak: false });
            doc.font('Helvetica').fontSize(valueSize)
                .text(value, x + PX, ry + PY + labelSize + 3, { width: w - PX * 2 });
        }

        function measureH(text, w, fontSize) {
            const cpl = Math.floor((w - PX * 2) / (fontSize * 0.55));
            const lines = text.split('\n').reduce((a, l) => a + Math.max(1, Math.ceil(l.length / cpl)), 0);
            return lines * (fontSize * 1.3);
        }

        const col3 = Math.floor(CW / 3);
        const col2 = Math.floor(CW / 2);
        const GAP  = 6;

        // Header
        doc.font('Helvetica-Bold').fontSize(13)
            .text("Missoula County Sheriff's Office", ML, y, { width: CW, align: 'center' });
        y += 17;
        doc.font('Helvetica-Bold').fontSize(11)
            .text('MONTANA STATE CITATION TICKET', ML, y, { width: CW, align: 'center' });
        y += 18;

        // Table 1
        const t1H = 36;
        drawRect(ML, y, CW, t1H);
        vline(ML + col3, y, t1H); vline(ML + col3 * 2, y, t1H);
        cellContent('TICKET NO.',    fields.ticketNo,    ML,             y, col3);
        cellContent('DATE OF ISSUE', fields.dateOfIssue, ML + col3,      y, col3);
        cellContent('TIME',          fields.timeOfIssue, ML + col3 * 2,  y, CW - col3 * 2);
        y += t1H + GAP;

        // Table 2
        const t2H = 36;
        drawRect(ML, y, CW, t2H);
        vline(ML + col2, y, t2H);
        cellContent('OFFENDER',           fields.robloxUsername,   ML,        y, col2);
        cellContent('IDENTIFICATION NO.', String(fields.robloxId), ML + col2, y, CW - col2);
        y += t2H + GAP;

        // Table 3
        const t3H = Math.max(36, PY + 8 + 3 + measureH(fields.vehicle, CW, 10) + PY);
        drawRect(ML, y, CW, t3H);
        cellContent('ASSOCIATED VEHICLE', fields.vehicle, ML, y, CW);
        y += t3H + GAP;

        // Table 4
        const t4H = Math.max(36, PY + 8 + 3 + measureH(fields.charges, CW, 10) + PY);
        drawRect(ML, y, CW, t4H);
        cellContent('CHARGES', fields.charges, ML, y, CW);
        y += t4H + GAP;

        // Table 5
        const fineVal = fields.fine === '0' ? 'N/A' : `$${fields.fine}`;
        const t5H = 74;
        drawRect(ML, y, CW, t5H);
        vline(ML + col2, y, t5H);

        doc.font('Helvetica-Bold').fontSize(8)
            .text('FINE', ML + PX, y + PY, { width: col2 - PX * 2, lineBreak: false });
        doc.font('Helvetica').fontSize(22)
            .text(fineVal, ML + PX, y + PY + 11, { width: col2 - PX * 2 });

        doc.font('Helvetica-Bold').fontSize(8)
            .text('ISSUED BY', ML + col2 + PX, y + PY, { width: col2 - PX * 2, lineBreak: false });
        doc.font('Helvetica').fontSize(10)
            .text(fields.issuerTag, ML + col2 + PX, y + PY + 11, { width: col2 - PX * 2 });

        doc.font('Helvetica-Bold').fontSize(8)
            .text('BADGE NO.', ML + col2 + PX, y + PY + 38, { width: col2 - PX * 2, lineBreak: false });
        doc.font('Helvetica').fontSize(10)
            .text(String(fields.issuerId), ML + col2 + PX, y + PY + 51, { width: col2 - PX * 2 });

        y += t5H + 14;

        // Notice paragraphs
        const BO = { width: CW, align: 'left' };

        doc.font('Helvetica-Bold').fontSize(10).text('NOTICE:', ML, y, BO);
        y = doc.y + 2;
        doc.font('Helvetica').fontSize(10)
            .text('The offender has been cited for the violation(s) listed above. The offender is required by law to respond to this citation by 30 days from the date of issue.', ML, y, BO);
        y = doc.y + 8;

        doc.font('Helvetica-Bold').fontSize(10).text('PAYMENT (If applicable) -', ML, y, BO);
        y = doc.y + 2;
        doc.font('Helvetica').fontSize(10).text('You may either pay the fine listed by one of two options:', ML, y, BO);
        y = doc.y + 3;
        doc.font('Helvetica').fontSize(10)
            .text('\u2022  Through the Missoula County Sheriff\u2019s Office online system. MCSO Official Site', ML + 8, y, BO);
        y = doc.y + 3;
        doc.font('Helvetica').fontSize(10)
            .text('\u2022  In person, visiting the Missoula County Sheriff\u2019s Office Station, located at 908, Maple Street, Missoula County, MT', ML + 8, y, BO);
        y = doc.y + 8;

        doc.font('Helvetica-Bold').fontSize(10).text('CONTEST VIA COURT -', ML, y, BO);
        y = doc.y + 2;
        doc.font('Helvetica').fontSize(10)
            .text('If you wish to contest this violation, you are required to file a written request for a court hearing within 14 days of the date of issue.', ML, y, BO);
        y = doc.y + 8;

        doc.font('Helvetica-Bold').fontSize(10)
            .text('FAILURE TO RESPOND \u2013 ', ML, y, { continued: true });
        doc.font('Helvetica').fontSize(10)
            .text('Failure to pay the fine (if applicable) within 30 days of the date of issue or request a hearing within 14 days of the date of issue will result in additional charges, license suspension, or issuance of a warrant.', { width: CW, align: 'left' });

        doc.end();
    });
}

// ── Discord command ───────────────────────────────────────────────────────────

module.exports = {
    data: new SlashCommandBuilder()
        .setName('log')
        .setDescription('Logging commands')
        .addSubcommand(sub =>
            sub
                .setName('citation')
                .setDescription('Issue a citation ticket')
                .addStringOption(opt =>
                    opt.setName('roblox_username')
                        .setDescription("The offender's Roblox username")
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('vehicle')
                        .setDescription('Associated vehicle. Format: (Vehicle Name) - (Year) | (Type) | Color: | Plate:')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('charges')
                        .setDescription('Charges separated by commas')
                        .setRequired(true)
                )
                .addNumberOption(opt =>
                    opt.setName('fine')
                        .setDescription('Fine amount in dollars. Enter 0 if none.')
                        .setRequired(true)
                        .setMinValue(0)
                )
        ),

    async execute(interaction) {
        const hasRole = ALLOWED_ROLES.some(id => interaction.member.roles.cache.has(id));
        if (!hasRole) {
            return interaction.reply({
                content: 'You do not have permission to use this command.',
                flags: MessageFlags.Ephemeral,
            });
        }

        if (interaction.options.getSubcommand() !== 'citation') return;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const robloxUsernameInput = interaction.options.getString('roblox_username');
        const vehicleRaw          = interaction.options.getString('vehicle');
        const chargesRaw          = interaction.options.getString('charges');
        const fineRaw             = interaction.options.getNumber('fine');
        const issuer              = interaction.user;

        let robloxId, robloxUsername;
        try {
            const result   = await getRobloxUser(robloxUsernameInput);
            robloxId       = result.id;
            robloxUsername = result.name;
        } catch {
            return interaction.editReply({
                content: `Could not find Roblox user **${robloxUsernameInput}**. Check the username and try again.`,
            });
        }

        const ticketNo    = generateTicketNo();
        const now         = new Date();
        const dateOfIssue = now.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
        const timeOfIssue = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        const chargesList = chargesRaw.split(',').map((c, i) => `${i + 1}. ${c.trim()}`).join('\n');

        const docFields = {
            ticketNo,
            dateOfIssue,
            timeOfIssue,
            robloxUsername,
            robloxId,
            vehicle:   vehicleRaw,
            charges:   chargesList,
            fine:      fineRaw.toString(),
            issuerTag: `@${issuer.username}`,
            issuerId:  String(issuer.id),
        };

        let pngBuffer;
        try {
            pngBuffer = buildCitationImage(docFields);
        } catch (err) {
            console.error('[citation] PNG error:', err);
            return interaction.editReply({ content: 'Failed to render citation image.' });
        }

        let pdfBuffer;
        try {
            pdfBuffer = await buildPdf(docFields);
        } catch (err) {
            console.error('[citation] PDF error:', err);
            return interaction.editReply({ content: 'Failed to generate citation PDF.' });
        }

        // type 11 (File) is NOT allowed inside a Container in Components V2,
        // so the PDF is sent as a plain second message directly below.
        function buildComponents(tNo) {
            return [
                {
                    type: 17,
                    components: [
                        { type: 10, content: '**Citation Issued**' },
                        {
                            type: 12,
                            items: [{ media: { url: `attachment://Citation_${tNo}.png` } }],
                        },
                    ],
                },
            ];
        }

        try {
            const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
            await logChannel.send({
                flags:      MessageFlags.IsComponentsV2,
                components: buildComponents(ticketNo),
                files:      [{ attachment: pngBuffer, name: `Citation_${ticketNo}.png` }],
            });
            await logChannel.send({
                files: [{ attachment: pdfBuffer, name: `Citation_${ticketNo}.pdf` }],
            });
        } catch (err) {
            console.error('[citation] Send error:', err);
            return interaction.editReply({ content: 'Failed to post the citation to the log channel.' });
        }

        try {
            await interaction.guild.members.fetch();
            const matches = interaction.guild.members.cache.filter(m => {
                const extracted = extractNicknameUsername(m.nickname);
                return extracted && extracted.toLowerCase() === robloxUsername.toLowerCase();
            });

            if (matches.size === 1) {
                try {
                    const member = matches.first();
                    await member.send({
                        flags:      MessageFlags.IsComponentsV2,
                        components: buildComponents(ticketNo),
                        files:      [{ attachment: pngBuffer, name: `Citation_${ticketNo}.png` }],
                    });
                    await member.send({
                        files: [{ attachment: pdfBuffer, name: `Citation_${ticketNo}.pdf` }],
                    });
                } catch {
                    // DMs closed — skip silently
                }
            }
        } catch (err) {
            console.error('[citation] DM error:', err);
        }

        return interaction.editReply({
            content: `Citation **${ticketNo}** issued against **${robloxUsername}** (Roblox ID: \`${robloxId}\`) and logged in <#${LOG_CHANNEL_ID}>.`,
        });
    },
};

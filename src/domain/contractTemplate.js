// Pure contract document builder. No I/O, no fonts — returns a pdfmake docDefinition.
// Deterministic: the effective date is passed in (never Date.now() here).
// Legal boilerplate is transcribed verbatim from the owner's template
// (docs/superpowers/specs/contract-template-verbatim.md). Do not paraphrase.

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Round to at most 2 decimals, dropping trailing zeros (e.g. 15, 16.67).
const round2 = (n) => Math.round(n * 100) / 100;

const dash = (v) => (typeof v === "string" && v.trim() ? v.trim() : "—");

// Human-readable date: accepts "YYYY-MM-DD"; falls back to the raw value or a label.
const humanDate = (iso, fallback = "to be confirmed") => {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || fallback;
  const MONTHS = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const [y, m, d] = iso.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return iso;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
};

const joinAliases = (artists) => {
  const names = (artists || []).map((a) => dash(a.alias)).filter((n) => n !== "—");
  if (names.length === 0) return "Artist";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};

// The release form collects each collaborator's `split_percent` as their share of the
// ARTIST side, summing to 100 across collaborators. The label always takes 50% of the
// master; artists split the remaining 50% proportionally, so an artist's share of the
// whole = split_percent * 0.5. The royalty table therefore totals 100% (label 50 + artists 50).
export const summarizeRoyalty = (artists = []) => {
  const artistRows = artists.map((a) => {
    const share = num(a.splitPercent);
    return { alias: a.alias, share, percent: round2(share * 0.5) };
  });
  const artistsTotal = round2(artistRows.reduce((sum, r) => sum + r.share, 0));
  return { labelPercent: 50, artistRows, artistsTotal, balanced: artistsTotal === 100 };
};

// ── Verbatim legal clauses ──────────────────────────────────────────────────
// Each clause: a heading + a list of paragraphs. Numbering is embedded in the
// text to reproduce the source document exactly (incl. its two "5." headings).
const CLAUSES = [
  {
    heading: "1. TERRITORY",
    paras: ['1. As used herein, the "Territory" shall mean the world.'],
  },
  {
    heading: "2. LICENSE PERIOD",
    paras: [
      '1. "License Period" shall mean the period commencing on the date hereof and expiring on: two (2) years after the date of the initial release of the last Master (as defined below) delivered hereunder; and (ii) the date on which all Expenses (as defined below) are recouped by Label (the "Initial License Period"). The License Period shall automatically extend for additional consecutive one (1) year periods (each an "Extension") thereafter unless either party delivers notice in writing not less than sixty (60) days prior to the expiry of the Initial License Period or the then-current Extension (if applicable).',
    ],
  },
  {
    heading: "3. GRANT OF RIGHTS",
    paras: [
      "1. Artist hereby grants to Label an exclusive license, in the Territory during the License period to (and the nonexclusive right during the Sell-Off Period) to manufacture, sell, distribute, market, publicly perform, and otherwise exploit the Masters in all manner and media now in existence or hereinafter devised, including without limitation via digital transmissions, physical singles, albums, or audio-visual records.",
      "2. Label's exclusive rights include, without limitation, the right to itself or via a third party:",
      { indent: 1, text: "1. the exclusive right to manufacture, distribute, lease, and sell in the Territory Records derived from the Masters in any and all formats;" },
      { indent: 1, text: "2. the exclusive right to advertise, promote and market such Records in the Territory;" },
      { indent: 1, text: "3. the exclusive right to publicly perform and broadcast, and to authorize others to publicly perform and broadcast, the Masters in the Territory;" },
      { indent: 1, text: '4. the exclusive right to synchronize, and to authorize others to synchronize, the Masters with motion pictures, television programs, and other audiovisual works which are produced in the Territory for exploitation throughout the world (each, a "Master Use License"). The term of any non-exclusive Master Use License may extend beyond the License Period;' },
      { indent: 1, text: '5. the exclusive right to distribute and sell Records derived from the Masters by means of digital transmission or so-called "electronic transmission"; and' },
      { indent: 1, text: "6. the exclusive right to couple, and to authorize others to couple, the Masters with masters by other artists for inclusion so-called 'compilation' records, including without limitation, consumer compilation Records, promotional Records, non-retail jukebox compilations, sampler-type Records and programs for us on public transportation carriers and facilities (each a \"Compilation Record\")." },
      { indent: 1, text: "7. the exclusive right to distribute and exploit the Masters on so-called streaming services and or websites such as but not limited to www.soundcloud.com, www.spotify.com, www.pandora.com, www.deezer.com, play.google.com, www.apple.com/itunes in the Territory." },
      { indent: 1, text: "8. the exclusive right to license the Masters alone or in conjunction with other master recordings for use on podcasts." },
      "For the avoidance of doubt, the Artist shall be granted the right to host the Master on the Artist's owned social channels and across such websites which the Artist directly owns. If and to the extent that Artist directly receives any income from the exploitation of any Records, Artist shall immediately turn over to Label all income derived therefrom for accounting and, if applicable, payment of Royalties hereunder. Label shall have the same audit rights with respect to such income as Artist has of Label pursuant to section 5.3 below.",
      "3. Label shall have the right, in the Territory during the License Period and the Sell-Off Period, to use, and authorize others to use: the names, approved likenesses, approved photographs and approved biographies of Artist and each other person performing in or rendering services in connection with Masters in the form approved by the Artist, solely for the purpose of advertising, promoting and marketing the Masters and for general goodwill advertising for the benefit of Label's music business activities provided that no such shall directly endorse the goods or services of a third party. Artist's approval shall only be required once per photo, image or bio to be used and shall be deemed given if no response to the contrary is provided by Artist within five (5) business days of Label's approval request.",
      "4. Label shall have the right, in the Territory during the License Period and the Sell-Off Period, to use, and authorize others to use, any artwork created by or on behalf of Artist for use on the packaging of and in connection with any Records embodying one or more of the Masters.",
      "5. Label shall, with the prior written consent of Artist in each case, have the exclusive right, in the Territory during the License Period, to 're-mix' (as such term is commonly understood in the music industry) the Masters and to combine the Masters (or any part thereof) (or any one of them) and to authorize others to do so (each such remixed Master a \"Remix\"). In the event that a Remix is created hereunder, such Remix shall be deemed to be a 'Master' hereunder and subject to the terms hereof.",
      "6. Artist agrees that Artist shall not record, re-record, use, exploit or release for commercial sale, broadcast or communication in the Territory any Master and/or any Composition (in whole or in part) that is embodied in a Master delivered under this Agreement during the License Period.",
      "7. Notwithstanding anything to the contrary herein, the parties acknowledge and agree that Label shall continue to have the right in perpetuity to distribute, and to authorize others to distribute, worldwide in all media now or hereafter known, any and all Compilation Records created hereunder prior to the expiry of the License Period and to receive revenues in respect thereof provided that Artist receives the applicable Royalty associated therewith.",
    ],
  },
  {
    heading: "4. ROYALTIES",
    paras: [
      'With respect to the exploitation of Masters hereunder, Label will pay Artist a royalty (the "Royalty") equal to: (i) fifty percent (50%) of "Net Proceeds" (as defined below). In the event that Artist wishes for Label to divide the Artist\'s royalty among more than one person. The Royalty shall be inclusive of all payments due to Artist in connection with any publishing royalties for Artist\'s share of the Controlled Compositions as set out in section 6 below.',
    ],
  },
  {
    heading: "5. ACCOUNTING",
    paras: [
      "1. No less frequently than within ninety (90) days following the end of each fiscal quarter period during the License Period and the Sell-Off Period, Label shall furnish Artist with a written statement in Label's standard accounting format setting forth the computation of royalties for the applicable monthly periods. Each such statement shall be accompanied by payment of all Royalties payable, if any. All statements shall be provided in digital form via Label's accounting system and Artist shall be provided with access thereto.",
      "2. Sales by Label's sub-licensees, distributors and/or partners, if any, shall be deemed to take place in the calendar quarter in which Label receives (or is credited) payment therefore from such sub-licensee. Label shall use reasonable commercial efforts to obtain prompt and accurate accounting and payment from its licensees, which shall be no less frequent than twice per annum.",
      "3. Label shall keep true and correct records and books of account relating to the sale of Records, and all other exploitations of Masters hereunder and other activities relevant to the calculation of royalties payable hereunder. All Royalty statements and all other accounts rendered by Label to Artist shall be binding upon Artist and not subject to objection by Artist for any reason unless specific objection, in writing stating the basis thereof is given to Artist within eighteen (18) months following Artist's receipt of such statement. Artist shall be foreclosed from maintaining any action, claim or proceeding against Label in any forum or tribunal unless commenced within twenty four (24) months following Artist's receipt of such statement. Artists shall have the right to appoint a chartered or certified public accountant (or a firm of chartered or certified public accountants) to examine and make copies of Label's books and records insofar as they pertain to this Agreement. Such chartered or certified public accountant will act only under a confidentiality agreement which provides that any information derived from such audit or examination will not be released, divulged or published to any person, firm or corporation other than Artist, Artist's attorneys, Artist's advisors, to a judicial or administrative body in connection with any proceeding relating to this Agreement, or by mandate of law. Such examination shall take place at Label's offices where such books and records are normally maintained during normal business hours, on reasonable advance notice, not more than once in any calendar year and at Artist's sole cost and expense.",
    ],
  },
  {
    heading: "5. TRADE-MARKS",
    paras: [
      "Artist grants to Label the exclusive right, during the License Period, to use Artist's name and approved likeness, image and biography in connection with the sale, marketing and promotion of the Masters and Records made therefrom including on websites.",
      'Artist acknowledges and agrees that Label\'s name and logo shall appear on the back cover of all Records made, and the metadata of all Masters exploited via "electronic transmission", pursuant hereto and all advertising relating to the Masters and/or such Records.',
    ],
  },
  {
    heading: "6. REPRESENTATIONS AND WARRANTIES",
    paras: [
      "Artist hereby represents, warrants and covenants that:",
      { indent: 1, text: "1. Artist has all necessary rights, power and authority to enter into this Agreement, to perform all of the obligations to be performed by Artist hereunder and to grant to Label all of the rights granted hereunder;" },
      { indent: 1, text: "2. this Agreement does not breach or conflict with any other agreement to which Artist is a party, and Artist will not enter into any agreement or obligation which conflicts herewith;" },
      { indent: 1, text: "3. Artist is not a party to any agreement pursuant to which Artist has granted to any third party any rights in or to the Masters or which otherwise restrict the rights Artist grants to Label herein;" },
      { indent: 1, text: "4. the Masters, the Compositions, Artist's name and any other audio, video or other materials delivered and contributed by Artist pursuant to this Agreement are wholly original and do not violate any laws or any rights of any party, including any copyright, trade-mark, right of privacy or other proprietary right of any party;" },
      { indent: 1, text: "5. other than as specifically set out herein, Label shall not be obligated to pay royalties or any other sums to any third parties in connection with the exercise of its rights hereunder;" },
      { indent: 1, text: "6. Artist has secured all necessary rights from all third parties including without limitation all publishing licenses from any third parties who may hold an interest in the Compositions, to allow Label the full exercise of its rights hereunder; and" },
      { indent: 1, text: "7. all information delivered by the Artist will be true, accurate and complete." },
      'Artist hereby indemnifies and holds harmless Label and its licensees and assigns, and its and their shareholders, officers, directors, principals, employees and agents (the "Indemnified Parties") from and against any and all losses, costs (including reasonable legal fees), expenses, liabilities and damages arising out of any claim in respect of any breach or alleged breach by Artist of this Agreement or any representation, warranty, covenant, or promise made hereunder as determined by a court of competent jurisdiction. Artist will reimburse the Indemnified Parties on demand for any payment made at any time after the date hereof in respect of any liability or claim in respect of which the Indemnified Parties are entitled to be indemnified. Upon the making or filing of any such claim, action or demand, Label shall be entitled to withhold from any amounts payable under this Agreement such amounts as are reasonably related to the potential liability in issue. In the event that any such claim does not result in litigation being commenced against the Indemnified Party within one (1) year from the date such claim is initially received by the Indemnified Party, then any monies withheld pursuant to the preceding sentence shall be released to Artist, provided that if any such claim is litigated after one (1) year from the date it was initially made, the Indemnified Party may thereafter withhold monies payable under this Agreement in accordance with the preceding sentence. Artist shall be notified of any such claim, action or demand and shall have the right, at its own expense, to participate in the defense hereof with counsel of its own choosing; provided, however, that the Indemnified Party\'s decision in connection with the defense or settlement of any such claim, action or demand shall be final. Label will not withhold any monies pursuant to this section provided that Artist posts a surety bond from a surety which is satisfactory to Label in its sole discretion and provided that the surety bond is in a type and amount satisfactory to Label in its sole discretion.',
    ],
  },
  {
    heading: "7. SELL OFF PERIOD",
    paras: [
      'Upon the expiration or earlier termination of the License Period, Label shall have the non-exclusive right for a period of six (6) months to sell its inventory of physical Records on hand as of the date of the expiration or termination of the Agreement (the "Sell-Off Period"). Label shall not, in anticipation of the Sell-Off Period, manufacture quantities of physical Records in excess of the quantity it reasonably anticipates selling prior to the termination of the Agreement. All sales of Records during the Sell-Off Period shall be in accordance with the terms and conditions of this Agreement. Without limiting the foregoing, such sales shall be in Label\'s normal course of business and at the same prices in effect prior to the termination of the Agreement, and Label shall continue to credit Artist\'s royalty account with royalties in accordance with the terms and conditions of this Agreement. For the avoidance of doubt there shall be no such Sell Off Period in respect of digital files, save as expressly provided herein, in respect of which take down notices shall be immediately put into effect and the Label shall have no rights with respect thereto or to the monies generated therefrom.',
    ],
  },
  {
    heading: "8. DEFINITIONS",
    paras: [
      "For the purposes of this Agreement, the following definitions shall apply:",
      '1. "Album" means a Record embodying ten (10) or more Masters and having a playing time of at least forty (40) minutes',
      '2. "Controlled Composition" shall mean a musical composition or other selection embodied on the Masters, written or composed by the Artist, any producer of the Masters, or any other persons engaged by Artist in connection with the production of Masters, in whole or in part (to the extent of that part only), alone or in collaboration with others, or which is owned or controlled, in whole or in part, directly or indirectly, by the Artist or any person, firm or corporation in which the Artist has a direct or indirect interest.',
      '3. "EP" means a Record embodying four (4) or more, but less than ten (10), Masters and having a playing time of at least fifteen (15) minutes',
      '4. "Expenses" shall mean all expenses properly paid or properly incurred by Label in respect of the production, distribution or other exploitation of the Masters of Records derived therefrom, or otherwise in connection with the terms of this Agreement. Without limiting the generality of the foregoing, Expenses will include the following which have been incurred in accordance with the terms of this Agreement: (A) all marketing, promotion and publicity costs incurred in connection with Records and/or the Masters; (B) all costs incurred in manufacturing and distributing Records; (C) except as otherwise expressly provided to the contrary herein, all mechanical royalties, sums paid for synchronization and other licenses to use Masters, so-called "samples" and other material, "per use" or other payments made to unions or guilds, taxes and all other payments due to third parties in connection with the acquisition or exploitation or rights in the Masters; (D) all costs incurred in \'mastering\' the Masters; (E) all artwork costs paid or incurred by Label in connection with the acquisition, creation, design and preparation of artwork; (F) all costs incurred in creating a Remix (if applicable); (G) all costs incurred in the production of any so-called "music videos" or other audio visual assets embodying the Masters; and (H) all costs incurred in the collection of Gross Revenues including without limitation reasonable outside legal fees.',
      '5. "Gross Revenues" shall mean all gross receipts (including advances specifically related to the Masters) actually received by Label in the Territory and specifically derived from the exploitation of Masters, including without limitation Gross Streaming Revenues and Gross UGC Revenues. Notwithstanding anything to the contrary in this Agreement, any and all revenues earned and received by Label from YouTube channels owned or administered by Label or its affiliates shall not form part of Gross Revenues and will be solely retained by Label for its own account.',
      '6. "Gross Streaming Revenues" shall mean gross receipts actually received by Label in the Territory and specifically derived from the sale and/or other exploitation of Records derived from Masters (including without limitation royalties or fees) solely via Streaming Sources. For SoundExchange or other revenue collected by a society for which the so-called "maker share" and "performer share" are paid out separately (eg. Neighbouring Rights), as between Artist and Label, Label will be entitled to collect and retain for its own account one hundred percent (100%) of the "maker\'s share" and Artist will be entitled to collect and retain for its own account one hundred percent (100%) of the "performer share".',
      '7. "Gross UGC Revenues" shall mean gross amounts attributable to Records derived from Masters actually received by Label in the Territory and solely derived from YouTube\'s so-called \'AudioID\' \'ContentID\' and/or \'VideoID\' program.',
      '8. "Net Proceeds" shall mean the amount, if any, by which Gross Revenues exceeds Expenses.',
      '9. "Record" - any form of reproduction, distribution, transmission or communication of Masters (whether or not distributed, transmitted or communicated primarily for personal use, home use, institutional (e.g., library or school) use, jukebox use, or use in means of transportation, including any computer-assisted media (e.g., CDROM, DVD Audio, CD Extra, Enhanced CD) or use as a so-called "ring tone" or "ring tune".',
      '10. "Streaming Sources" shall mean exploitation of Records via so-called \'streaming services\' which provide for the transmission of Records over the internet (on a free or subscription basis) in a manner that allows continuous listening of the Record on a device capable of facilitating such listening (including without limitation a computer or mobile device) in a substantially linear form substantially simultaneously with the transmission of the Record over the internet (eg. Spotify, Google Play, Apple Music, Pandora, Deezer or similar services).',
    ],
  },
  {
    heading: "9. GENERAL TERMS",
    paras: [
      "9.1 Entire Agreement. This Agreement sets out the entire agreement between the parties and supersedes and replaces all prior agreements, discussions and understandings whether written or oral.",
      "9.2 Assignment. Artist shall not assign any of its rights or obligations under this Agreement without the prior written consent of Label except an assignment to a wholly-owned loan-out company and in which case such loan-out corporation shall become a party to this Agreement and Artist shall execute an inducement letter in a form satisfactory to Label. Label may assign any or all of this Agreement or any of its rights and/or obligations hereunder to any party.",
      "9.3 Enurement. This Agreement shall ensure to the benefit of and shall be binding upon and enforceable against the parties and their respective heirs, executors, successors and permitted assigns.",
      "9.4 Amendment. No amendment or waiver of any provision of this Agreement shall be binding upon either party unless consented to in writing by such part.",
      "9.5 Force Majeure. Neither party will be responsible to the other for any failure or delay in its performance under this Agreement occasioned by any causes beyond its control including, without limitation, any acts or omissions of the other party, acts of civil or military authority, fires, epidemics, floods, earthquakes, riots, wars, international trade embargoes, insurrections or acts of God. If any such delay occurs, any applicable time period is automatically extended for a period equal to the time lost, provided that the party affected makes reasonable efforts to correct the reason for delay and gives to the other party prompt notice of the delay.",
      "9.6 Confidentiality. The parties hereto agree to keep the terms and conditions of this Agreement confidential except that each party may disclose this Agreement as required by any law or court order, or to its legal and financial advisors provided such advisors agree to keep all information and this Agreement confidential.",
      "9.7 Services Unique. The services rendered by Artist and the rights and privileges granted to Label hereunder are understood and agreed to be of a special, unique, unusual, extraordinary and intellectual character, which gives them a peculiar value, the loss of which cannot be adequately remedied in an action at law for damages. In the event of an actual or threatened breach of any of the provisions of this Agreement by Artist, Label shall have the right to seek a restraining order, injunction or other appropriate equitable relief to prevent such a breach or threatened breach of this Agreement.",
      "9.8 Remedies. In the event of a breach or alleged breach by Label or its licensees or assigns under this Agreement, Artist shall give Label written notice thereof detailing the breach or alleged breach. In the event that such has not been cured within 30 days of written notice from Artist (or where cure is not possible within 30 days, then if Label has not commenced to cure such breach or alleged breach within 30 days), Artist's remedies shall be restricted to the right to recover actual damages in an action at law. In no event will such breach or alleged breach entitle Artist to rescind this Agreement or any of the rights granted hereunder or to enjoin or to restrain the use, distribution, exhibition or exploitation of the Masters or publishing rights granted hereunder, and Artist hereby expressly waives any right to seek injunctive or equitable relief.",
      "9.9 Severance. Each provision of this Agreement is separate from every other provision and should any provision herein be declared invalid, illegal or unenforceable, such declaration shall in no way affect the validity or enforceability of the remaining provisions herein.",
      "9.10 Counterparts. This Agreement may be executed in any number of counterparts and delivered by facsimile or electronic scan, each of which shall be deemed to be an original and all of which together shall constitute one and the same instrument.",
      "9.11 Independent Legal Advice. Artist acknowledges that he has been represented by and has relied upon legal counsel of his own choosing in the negotiation of this Agreement and has had its contents fully explained by such counsel, or that Artist has been advised of his right to seek such advice and counsel and has knowingly waived such right, and has read this Agreement, and is fully aware of and understands all of its terms and the legal consequences thereof.",
    ],
  },
];

const clauseParagraph = (p) => {
  if (typeof p === "string") {
    return { text: p, margin: [0, 0, 0, 6], alignment: "justify" };
  }
  const leftIndent = 18 * (p.indent || 0);
  return { text: p.text, margin: [leftIndent, 0, 0, 6], alignment: "justify" };
};

const partyBlock = (a) => ({
  stack: [
    { text: "ARTIST", bold: true },
    { text: `Alias: ${dash(a.alias)}` },
    { text: `Email: ${dash(a.email)}` },
    { text: `Full Name: ${dash(a.legalName)}` },
    { text: `Nationality: ${dash(a.nationality)}` },
  ],
  margin: [0, 0, 0, 10],
});

const SIGN_WIDTH = 150; // signature display width (pt)
const SIGN_LINE_WIDTH = 200; // signature rule width (pt) — fits a half-page column
const SIGN_COLUMN_GAP = 28; // gap between the two signature columns (pt)
// Blank-signature top margin, tuned so a manual-signature block is as tall as the
// embedded-image block: image contributes ~8 + ~75 (image height at SIGN_WIDTH) + 2;
// the spacer's own line adds ~12.5, so 70 + 12.5 + 2 ≈ the image's ~85.
const SIGN_SPACE_MARGIN = 70;

const signatureBlock = (title, name, signatureImage, signingTagIndex) => {
  // Leave equal room to sign in every block: embed the owner's signature image when
  // supplied, an invisible BoldSign text-tag when generating the e-sign variant, or
  // otherwise reserve matching blank vertical space above the line.
  let signingSpace;
  if (signatureImage) {
    signingSpace = { image: signatureImage, width: SIGN_WIDTH, margin: [0, 8, 0, 2] };
  } else if (signingTagIndex) {
    signingSpace = {
      text: `{{sign|${signingTagIndex}|*|Signature|artist_${signingTagIndex}}}`,
      color: "#FFFFFF",
      fontSize: 6,
      margin: [0, SIGN_SPACE_MARGIN, 0, 2],
    };
  } else {
    signingSpace = { text: " ", margin: [0, SIGN_SPACE_MARGIN, 0, 2] };
  }
  return {
    stack: [
      { text: title, bold: true, margin: [0, 12, 0, 0] },
      ...(name ? [{ text: name }] : []),
      signingSpace,
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: SIGN_LINE_WIDTH, y2: 0, lineWidth: 0.7, lineColor: "#333333" }] },
      { text: "Signature", fontSize: 8, color: "#888888", margin: [0, 4, 0, 0] },
    ],
    margin: [0, 0, 0, 12],
  };
};

// pdfmake mutates the document definition in place during rendering, so any node
// object reused across renders (or reused multiple times within one document) gets
// corrupted — a module-level constant divider caused "otherArray.forEach is not a
// function" on the second request. Always return a fresh object per use.
const makeDivider = () => ({
  canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: "#999999" }],
  margin: [0, 12, 0, 12],
});

export const buildContractDoc = (data, { signingTags = false } = {}) => {
  const label = data.label || {};
  const artists = data.artists || [];
  const royalty = summarizeRoyalty(artists);
  const effectiveHuman = humanDate(data.effectiveDate, "");
  const releaseHuman = humanDate(data.expectedReleaseDate);

  const royaltyTableBody = [
    [{ text: "Revenue Share Participants", bold: true }, { text: "Split %", bold: true }],
    [dash(label.name), `${royalty.labelPercent} %`],
    ...royalty.artistRows.map((r) => [dash(r.alias), `${r.percent} %`]),
  ];

  const content = [
    { text: dash(label.name).toUpperCase(), style: "brand" },
    { text: "OFFICIAL RELEASE CONTRACT", style: "title" },
    {
      text: `The official release contract (hereinafter referred to as "Contract") is made on ${effectiveHuman}, at ${dash(label.name)}.`,
      margin: [0, 0, 0, 12],
      alignment: "justify",
    },

    // Parties
    { text: dash(label.name).toUpperCase(), bold: true },
    { text: `Owner: ${dash(label.owner)}` },
    { text: `Email: ${dash(label.email)}`, margin: [0, 0, 0, 10] },
    ...artists.map(partyBlock),
    { text: "TRACK", bold: true },
    { text: `Title: ${dash(data.trackTitle)}` },
    { text: `Expected Release Date: ${releaseHuman}`, margin: [0, 0, 0, 6] },

    makeDivider(),

    // Recital
    {
      text: `LABEL ("${dash(label.name)}") is delighted to have this opportunity to work with ${joinAliases(artists)} to distribute and exploit certain sound recordings and audiovisual works owned or controlled by Artist as further detailed herein.`,
      margin: [0, 0, 0, 6],
      alignment: "justify",
    },
    {
      text: 'The agreement is conditional upon Artist controlling all rights, title, and interest in and to the recordings of the musical composition (the "Composition") embodied as audio-only or audiovisual recordings hereto (the "Master") for the Territory (as defined below), including without limitation all copyrights, free and clear of any claims, encumbrances or rights of any other person.',
      margin: [0, 0, 0, 6],
      alignment: "justify",
    },
    {
      text: "In consideration for the respective covenants, agreements, representations, warranties, and indemnities of the parties contained herein and for other good and valuable consideration (the receipt and sufficiency of which are hereby acknowledged by each party), the parties agree as follows:",
      margin: [0, 0, 0, 10],
      alignment: "justify",
    },
  ];

  // Numbered clauses
  for (const clause of CLAUSES) {
    content.push({ text: clause.heading, style: "h2" });
    for (const p of clause.paras) content.push(clauseParagraph(p));
  }

  // Royalty info
  content.push(makeDivider());
  content.push({ text: "ROYALTY INFO", style: "h2" });
  content.push({ text: `Title: ${dash(data.trackTitle)}`, margin: [0, 0, 0, 6] });
  content.push({
    table: { headerRows: 1, widths: ["*", "auto"], body: royaltyTableBody },
    layout: "lightHorizontalLines",
  });
  if (!royalty.balanced) {
    content.push({
      text: `Note: Artist splits total ${royalty.artistsTotal}% — expected 100%. Verify before signing.`,
      italics: true,
      color: "#b45309",
      margin: [0, 6, 0, 0],
    });
  }

  // Signatures — two-column grid: owner first (with embedded signature), then each
  // artist fills left→right, top→bottom. Each row is unbreakable so a block's name,
  // signing space, line and caption never split across a page boundary.
  content.push(makeDivider());
  content.push({ text: "IN WITNESS WHEREOF, this Agreement is signed, by:", margin: [0, 0, 0, 8] });

  const signCells = [
    signatureBlock(dash(label.name).toUpperCase(), dash(label.owner), label.signatureImage),
    ...artists.map((a, i) =>
      signatureBlock(dash(a.alias), dash(a.legalName), undefined, signingTags ? i + 1 : undefined),
    ),
  ];
  for (let i = 0; i < signCells.length; i += 2) {
    const left = { ...signCells[i], width: "*" };
    const right = signCells[i + 1] ? { ...signCells[i + 1], width: "*" } : { text: "", width: "*" };
    content.push({ unbreakable: true, columnGap: SIGN_COLUMN_GAP, columns: [left, right] });
  }

  return {
    content,
    defaultStyle: { font: "Roboto", fontSize: 10, lineHeight: 1.25 },
    styles: {
      brand: { fontSize: 12, bold: true, color: "#666666", margin: [0, 0, 0, 2] },
      title: { fontSize: 18, bold: true, margin: [0, 0, 0, 14] },
      h2: { fontSize: 12, bold: true, margin: [0, 12, 0, 6] },
    },
    pageMargins: [50, 50, 50, 60],
  };
};

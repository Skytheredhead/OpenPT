# Quiz Import Guide

## Imported Sources

- Source PDF: `/Users/skylarenns/Downloads/sem3 final.pdf`
- Destination bank: `ccna/sem-03/final`
- Quiz label: `CCNA / Semester 3 / Final exam`
- Imported count: 197 unique questions

- Source PDF: `/Users/skylarenns/Downloads/sem 1 mod 1-3.pdf`
- Destination bank: `ccna/sem-01/m-1-3`
- Quiz label: `CCNA / Semester 1 / Modules 1-3 Quiz`
- Imported count: 28 questions

- Source PDF: `/Users/skylarenns/Downloads/sem 1 mod 4-7.pdf`
- Destination bank: `ccna/sem-01/m-4-7`
- Quiz label: `CCNA / Semester 1 / Modules 4-7 Quiz`
- Imported count: 45 questions

- Source PDF: `/Users/skylarenns/Downloads/sem 1 mod 8-10.pdf`
- Destination bank: `ccna/sem-01/m-8-10`
- Quiz label: `CCNA / Semester 1 / Modules 8-10 Quiz`
- Imported count: 38 questions

- Source PDF: `/Users/skylarenns/Downloads/sem 1 mod 11-13.pdf`
- Destination bank: `ccna/sem-01/m-11-13`
- Quiz label: `CCNA / Semester 1 / Modules 11-13 Quiz`
- Imported count: 40 questions

- Source PDF: `/Users/skylarenns/Downloads/sem1 mod 16-17.pdf`
- Destination bank: `ccna/sem-01/m-16-17`
- Quiz label: `CCNA / Semester 1 / Modules 16-17 Quiz`
- Imported count: 35 questions

- Source PDF: `/Users/skylarenns/Downloads/sem1 final.pdf`
- Destination bank: `ccna/sem-01/final`
- Quiz label: `CCNA / Semester 1 / Final exam`
- Imported count: 161 questions
- Answer cross-check: `https://itexamanswers.net/ccna-1-v7-0-final-exam-answers-full-introduction-to-networks.html`

- Source PDF: `/Users/skylarenns/Downloads/sem2 mod 1-4.pdf`
- Destination bank: `ccna/sem-02/m-1-4`
- Quiz label: `CCNA / Semester 2 / Modules 1-4 Quiz`
- Imported count: 42 questions

- Source PDF: `/Users/skylarenns/Downloads/sem2 mod 5-6.pdf`
- Destination bank: `ccna/sem-02/m-5-6`
- Quiz label: `CCNA / Semester 2 / Modules 5-6 Quiz`
- Imported count: 35 questions

- Source PDF: `/Users/skylarenns/Downloads/sem 2 mod 7-9.pdf`
- Destination bank: `ccna/sem-02/m-7-9`
- Quiz label: `CCNA / Semester 2 / Modules 7-9 Quiz`
- Imported count: 34 questions

- Source PDF: `/Users/skylarenns/Downloads/sem 2 mod 10-13.pdf`
- Destination bank: `ccna/sem-02/m-10-13`
- Quiz label: `CCNA / Semester 2 / Modules 10-13 Quiz`
- Imported count: 60 questions

- Source PDF: `/Users/skylarenns/Downloads/sem 2 mod 14-16.pdf`
- Destination bank: `ccna/sem-02/m-14-16`
- Quiz label: `CCNA / Semester 2 / Modules 14-16 Quiz`
- Imported count: 48 questions

- Source PDFs: `/Users/skylarenns/Downloads/sem2 final pt 1.pdf` and `/Users/skylarenns/Downloads/sem2 final pt 2.pdf`
- Destination bank: `ccna/sem-02/final`
- Quiz label: `CCNA / Semester 2 / Final exam`
- Imported count: 127 questions

- Source PDF: `/Users/skylarenns/Downloads/sem 3 mod 1-2.pdf`
- Destination bank: `ccna/sem-03/m-1-2`
- Quiz label: `CCNA / Semester 3 / Modules 1-2 Quiz`
- Imported count: 46 questions

- Source PDF: `/Users/skylarenns/Downloads/sem3 mod 3-5.pdf`
- Destination bank: `ccna/sem-03/m-3-5`
- Quiz label: `CCNA / Semester 3 / Modules 3-5 Quiz`
- Imported count: 61 questions

- Source PDF: `/Users/skylarenns/Downloads/sem 3 mod 6-8.pdf`
- Destination bank: `ccna/sem-03/m-6-8`
- Quiz label: `CCNA / Semester 3 / Modules 6-8 Quiz`
- Imported count: 48 questions

- Source PDF: `/Users/skylarenns/Downloads/sem3 mod 9-12.pdf`
- Destination bank: `ccna/sem-03/m-9-12`
- Quiz label: `CCNA / Semester 3 / Modules 9-12 Quiz`
- Imported count: 58 questions

- Source PDF: `/Users/skylarenns/Downloads/sem3 mod 13-14.pdf`
- Destination bank: `ccna/sem-03/m-13-14`
- Quiz label: `CCNA / Semester 3 / Modules 13-14 Quiz`
- Imported count: 34 questions

## What Was Imported

The PDFs are OneNote exports where most slide/question content is embedded as page images. I rendered the PDF pages and used OCR plus visual review to identify the quiz-style items. In the Semester 3 final import, meaningful content ends around page 123, and pages 124-245 are effectively blank aside from the OneNote frame/footer. The Semester 3 final bank keeps the 197 unique quiz items from the source rather than every repeated occurrence in the PDF. In the Modules 1-3 import, pages 36-69 contain no meaningful slide content beyond the OneNote frame/footer, so the import uses pages 2-35. In the Modules 4-7 import, meaningful content ends around page 53, and pages 54-105 are effectively blank aside from the OneNote frame/footer. In the Modules 8-10 import, meaningful content ends around page 47, and pages 48-95 are effectively blank aside from the OneNote frame/footer. In the Modules 11-13 import, meaningful content ends around page 53, and pages 54-107 are effectively blank aside from the OneNote frame/footer. In the Modules 16-17 import, meaningful content ends around page 44, and pages 45-87 are effectively blank aside from the OneNote frame/footer. In the Semester 1 final import, meaningful content ends around page 93, and pages 94-185 are effectively blank aside from the OneNote frame/footer.

The Semester 2 Modules 1-4 PDF follows the same OneNote-image pattern. Meaningful content appears on pages 1-57; pages 58-115 are effectively blank aside from the OneNote frame/footer. Normal PDF text extraction only sees the wrapper text, so render pages to images before OCR. On this machine, Tesseract 5.5.2 could not read PNG inputs from `/tmp` reliably, but the same rendered pages worked when copied under the repo `tmp/` directory and passed to Tesseract with relative paths. Several slide answer markers were ambiguous after OCR, so the import uses visible marks where clear and otherwise uses the adjacent "What Did I Learn" summary slides and standard CCNA behavior.

The Semester 2 Modules 5-6 PDF is also a OneNote-image export. Meaningful content appears on pages 1-41; pages 42-83 are effectively blank aside from the OneNote frame/footer. This import includes the readable STP and EtherChannel quiz-style questions. A few exhibit-dependent questions were skipped where OCR could not preserve the diagram or command output well enough to keep the prompt fair.

The Semester 2 Modules 7-9 PDF is also a OneNote-image export. Meaningful content appears on pages 1-42; pages 43-85 are effectively blank aside from the OneNote frame/footer. The import includes readable DHCPv4, SLAAC/DHCPv6, and FHRP quiz-style questions. Some exhibit-dependent questions were reworded into text-only prompts when the relevant answer intent was clear from adjacent slides; diagram questions with missing topology details should remain skipped unless visually reviewed.

The Semester 2 Modules 10-13 PDF is also a OneNote-image export. Meaningful content appears on pages 1-57; pages 58-115 are effectively blank aside from the OneNote frame/footer. The import includes readable LAN security, switch security, WLAN concepts, and WLAN configuration questions. Several questions with heavily degraded exhibit/PT details were skipped; some wireless and security questions were reworded to preserve the concept without depending on unreadable screenshot fragments.

The Semester 2 Modules 14-16 PDF is also a OneNote-image export. Meaningful content appears on pages 1-41; pages 42-83 are effectively blank aside from the OneNote frame/footer. The import includes readable routing concepts, IPv4/IPv6 static route, floating static route, and static/default route troubleshooting questions. Exhibit questions were converted to text prompts when the routing table or route facts were readable; topology fragments that were too degraded were skipped or simplified only when the answer intent was clear.

The Semester 2 final is split across two OneNote-image PDFs. Part 1 has meaningful content on pages 1-74; pages 75-147 are effectively blank aside from the OneNote frame/footer. Part 2 has meaningful content on pages 1-21; pages 22-41 are effectively blank aside from the OneNote frame/footer. The combined final bank imports both parts into `ccna/sem-02/final`. It keeps clear multiple-choice and choose-many final review items, including some repeated concepts from module quizzes, and skips heavily degraded diagram-only fragments where the topology could not be preserved fairly.

The Semester 3 Modules 1-2 PDF follows the same OneNote-image pattern. Meaningful content appears on pages 1-25; pages 26-47 are effectively blank aside from the OneNote frame/footer. The import uses rendered pages under `tmp/pdfs/sem3-mod1-2-pages` and Tesseract OCR under `tmp/pdfs/sem3-mod1-2-ocr`. Several OSPF exhibit questions were converted into text prompts with the relevant router IDs, priorities, timers, or costs instead of screenshot exhibits so the answer remains fair without image artifacts.

The Semester 3 Modules 3-5 PDF is also a OneNote-image export. Meaningful content appears on pages 1-34; pages 35-67 are effectively blank aside from the OneNote frame/footer. The import uses rendered pages under `tmp/pdfs/sem3-mod3-5-pages` and Tesseract OCR under `tmp/pdfs/sem3-mod3-5-ocr`. ACL exhibit questions were imported only when the relevant addresses, interfaces, directions, or ACE sequence details were readable; a few degraded topology-only items were converted into text prompts with the necessary facts.

The Semester 3 Modules 6-8 PDF is also a OneNote-image export. Meaningful content appears on pages 1-36; pages 37-73 are effectively blank aside from the OneNote frame/footer. The import uses rendered pages under `tmp/pdfs/sem3-mod6-8-pages` and Tesseract OCR under `tmp/pdfs/sem3-mod6-8-ocr`. NAT and WAN exhibit questions were converted to text prompts when the relevant translations, addresses, or WAN scenario facts were readable; one degraded Packet Tracer troubleshooting item was skipped rather than guessed.

The Semester 3 Modules 9-12 PDF is also a OneNote-image export. Meaningful content appears on pages 1-53; pages 54-107 are effectively blank aside from the OneNote frame/footer. The import uses rendered pages under `tmp/pdfs/sem3-mod9-12-pages` and Tesseract OCR under `tmp/pdfs/sem3-mod9-12-ocr`. QoS, network management, design, and troubleshooting questions were imported when the prompt and answer intent were readable. A few degraded exhibit questions were converted to text prompts only when the visible slide content made the answer clear.

The Semester 3 Modules 13-14 PDF is also a OneNote-image export. Meaningful content appears on pages 1-31; pages 32-63 are effectively blank aside from the OneNote frame/footer. The import uses rendered pages under `tmp/pdfs/sem3-mod13-14-pages` and Tesseract OCR under `tmp/pdfs/sem3-mod13-14-ocr`. Cloud, virtualization, SDN, controller, API, and configuration-management questions were imported when readable. A few automation questions with missing answer text were included only where the standard Cisco concept made the intended answer unambiguous; the incomplete IBN assurance item was skipped.

The imported bank includes:

- Multiple-choice questions with visible selected answers from the PDF.
- Starred review questions whose answers are determined by the adjacent slide content.
- Matching activities imported with structured `pairs` metadata and rendered as two-column click-to-connect matchup boards in the quiz UI.
- Structured topology exhibits for questions where a diagram determines the answer.
- Structured CLI/output exhibits for command-line questions where output determines the answer.

## App Wiring

- Semester 3 final bank data lives in `quiz/questions-data.js`, with a readable JSON mirror in `quiz/questions-ccna3.json`.
- Semester 3 Modules 1-2, Modules 3-5, Modules 6-8, Modules 9-12, and Modules 13-14 bank data lives in `quiz/questions-sem3-mod1-2.js`, `quiz/questions-sem3-mod3-5.js`, `quiz/questions-sem3-mod6-8.js`, `quiz/questions-sem3-mod9-12.js`, and `quiz/questions-sem3-mod13-14.js`.
- Semester 1 bank data lives in `quiz/questions-sem1-mod1-3.js`, `quiz/questions-sem1-mod4-7.js`, `quiz/questions-sem1-mod8-10.js`, `quiz/questions-sem1-mod11-13.js`, `quiz/questions-sem1-mod16-17.js`, and `quiz/questions-sem1-final.js`.
- Semester 2 Modules 1-4, Modules 5-6, Modules 7-9, Modules 10-13, Modules 14-16, and final bank data lives in `quiz/questions-sem2-mod1-4.js`, `quiz/questions-sem2-mod5-6.js`, `quiz/questions-sem2-mod7-9.js`, `quiz/questions-sem2-mod10-13.js`, `quiz/questions-sem2-mod14-16.js`, and `quiz/questions-sem2-final.js`.
- `quiz/index.html` loads the original Semester 3 final bank first, then appends the Semester 3, Semester 1, and Semester 2 module banks.
- `quiz/questions.jsx` now preserves bank metadata and optional structured exhibits.
- `quiz/home.jsx` exposes the imported Semester 1 quizzes including `Semester 1 -> Final exam`, the imported Semester 2 module quizzes plus `Semester 2 -> Final exam`, and all imported Semester 3 module quizzes through `Semester 3 -> Modules 13-14 Quiz`.
- `quiz/app.jsx` filters the quiz pool by the selected bank instead of launching every question globally.
- `quiz/quiz.jsx` renders structured exhibits below the question and above the answers.

## Multiple-Choice Convention

## Fast Import Workflow

For future OneNote image-only exports, first check whether the PDF has embedded text:

```sh
mdls -name kMDItemNumberOfPages -name kMDItemTextContent "$PDF"
```

If `kMDItemTextContent` is `null`, render and OCR. `pdftoppm` is useful when installed, but PyMuPDF works well in this repo:

```sh
mkdir -p tmp/pdf-renders/<slug> tmp/pdf-ocr/<slug>
python3 - <<'PY'
import fitz
from pathlib import Path
pdf = Path('/absolute/path/to/source.pdf')
out = Path('tmp/pdf-renders/<slug>')
doc = fitz.open(pdf)
for i, page in enumerate(doc, start=1):
    page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False).save(out / f'page_{i:03d}.png')
PY
for f in tmp/pdf-renders/<slug>/page_*.png; do
  base=$(basename "$f" .png)
  tesseract "$f" "tmp/pdf-ocr/<slug>/$base" --psm 6 >/dev/null 2>&1
done
```

To find the meaningful page range quickly:

```sh
for f in tmp/pdf-ocr/<slug>/page_*.txt; do
  n=$(wc -w < "$f")
  printf "%4d %s\n" "$n" "$f"
done | awk '$1>15'
```

Contact sheets are the fastest way to review dozens of rendered pages and spot continuation pages, diagrams, and blank OneNote frames. Make 12-page sheets from `tmp/pdf-renders/<slug>/page_*.png` with Pillow thumbnails and inspect those before opening individual pages.

If the PDF does not visibly mark answers, search exact question text online and prefer answer keys with machine-readable markers. The ITExamAnswers pages currently mark correct options with either `class="correct_answer"` or red answer spans such as `style="color: #ff0000"`. Parse those markers for answer indexes instead of guessing from rendered color manually.

Watch for answer-key variants. Some final-review questions reuse the same stem with alternate option sets, especially Ethernet MAC/LLC questions. If the source PDF shows an alternate option set, import that variant as its own item or override the parsed answer-key default.

After adding a new question-bank file, restart any already-running local static server. A server process that started before the file existed may serve the app fallback HTML for that new `.js` path until restarted.

Multiple-choice imports use the same compact shape as the existing quiz banks:

```js
{
  s: 4,
  q: 'Which two factors are used when choosing a network medium? (Choose two.)',
  o: [
    'the distance the medium can carry a signal reliably',
    'the environment where the medium will be installed',
    'the cost of every endpoint device',
  ],
  a: [0, 1],
  m: true,
}
```

- `q` is the lightly reworded question prompt.
- `o` is the lightly reworded answer option list.
- `a` stores zero-based indexes into `o`, not letters from the PDF.
- Single-answer questions omit `m` or leave it false.
- Choose-two, choose-three, and matching questions set `m: true` so the UI allows multiple selections before submit.
- Keep the option count and correct-answer intent from the source PDF unless an option is obviously duplicated or unreadable.
- When the PDF visibly marks the answer, use that. When it does not, infer from the adjacent module content or verify before importing.
- For matching questions, every `[term, description]` entry in `pairs` must have an exact matching option string in `o` formatted as `term -> description`; otherwise the click-to-connect UI cannot store that match.

## Future Semester 1 Module Imports

Semester 1 Modules 1-3 already has its own bank. If a source PDF is labeled Modules 4-7, import it as `ccna/sem-01/m-4-7` and replace the placeholder library slot that used to say Modules 1-7; do not merge it into Modules 1-3.

Likewise, if a source PDF is labeled Modules 8-10, import it as `ccna/sem-01/m-8-10` and replace any broader placeholder such as Modules 8-13 rather than merging unrelated future modules.

If a source PDF is labeled Modules 11-13, import it as `ccna/sem-01/m-11-13` and add it as its own library slot between Modules 8-10 and Modules 14-17.

If a source PDF is labeled Modules 16-17, import it as `ccna/sem-01/m-16-17` and add it as its own library slot rather than labeling it as the broader Modules 14-17 placeholder.

If a source PDF is a Semester 1 final review or final exam, import it as `ccna/sem-01/final` and label it `Final exam`. Do not merge final-review questions into module banks, even when the final repeats module questions.

Some OneNote/PDF exports do not visibly mark the correct answers. In that case, infer the answer from the adjacent module review content and normal CCNA/Cisco networking behavior. If the answer is not crystal clear, especially for Packet Tracer or unusually worded Cisco items, verify it with a web lookup before importing.

## Exhibit Convention

Do not import diagram screenshots for network exhibits. Use structured data instead:

```js
exhibit: {
  type: 'topology',
  nodes: [
    { id: 'r1', kind: 'router', label: 'R1', x: 25, y: 35 },
    { id: 'pc1', kind: 'pc', label: 'PC1', x: 65, y: 35 },
  ],
  links: [
    { from: 'r1', to: 'pc1', type: 'ethernet', label: 'G0/0' },
  ],
}
```

`kind` should match simulator glyphs from `device-glyphs.jsx` when possible: `router`, `l2switch`, `l3switch`, `pc`, `server`, `laptop`, `printer`, `phone`, `ap`, `cloud`, `internet`, and related simulator device types.

Do not include titles inside topology diagrams. The question text already gives the context, and diagram titles can add visual clutter or imply details that were not present in the source PDF.

For command-output exhibits, use:

```js
code: [
  'Switch(config)# line console 0',
  'Switch(config-line)# password example',
]
```

## Diagram QA

Things that can go wrong during quiz imports:

- A topology can be over-simplified during rewording. Do not collapse routed diagrams into a same-LAN diagram; preserve routers, switches, default gateways, interface labels, and any MAC/IP labels that determine the answer.
- The question text can drift away from the exhibit. After rewording, re-check the answer against the diagram. If the source asks about a frame leaving a host toward a remote network, the destination MAC is usually the next-hop gateway, not the final remote host.
- OneNote exports often split a question and its diagram across adjacent PDF pages. If a question appears on page `N`, inspect pages `N - 1`, `N`, and `N + 1` before deciding the exhibit is missing or simple.
- Long link labels can overlap nodes in the rendered quiz. Keep link labels short, such as `G0/0`, `Fa0/0`, or `S0/0/0`, and put longer IP/MAC details on node labels with explicit line breaks.
- Diagram titles should be omitted. If a title feels necessary to understand the diagram, that usually means the structured nodes, links, or question text need to be improved instead.

Before considering a diagram import done, render at least five exhibit questions in the quiz tab and compare them to the corresponding PDF pages. Confirm the node count, device roles, left-to-right/top-to-bottom layout, link/interface labels, answer index, and visible label spacing.

## Rewording Notes

Questions and options were lightly reworded to avoid a verbatim copy while preserving the networking concept and the correct-answer intent. Exact Cisco IOS commands, mode names, protocol names, and addressing terms were kept as-is where changing them would make the question incorrect.

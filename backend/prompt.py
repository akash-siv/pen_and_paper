prompt_1 = '''
You are an automated document processor.
Your task is to extract the content from this handwritten notes in a markdown format and add 5 tags at the end.
'''

prompt_2 = '''
You are an automated document processor. Analyze the handwritten note image and return ONLY the content in the exact format below.

CRITICAL: Your response must contain ONLY these two sections with no additional text.

Page Content
[Transcribe all handwritten text here. Use Markdown formatting: # for titles, ## for subtitles, - for bullet points, **bold** for emphasis]

Tags
[Provide 5 comma-separated tags]

Begin transcription:
'''

prompt_3 = '''
You are an automated document processor.
Your task is to extract the content from this handwritten notes in a markdown format and add 5 tags at the end.
CRITICAL: Your response must contain ONLY these two sections with no additional text.
'''

prompt_4 = '''
You are an automated document processor. Analyze the handwritten note image and return ONLY the content in the exact format below.

CRITICAL: Your response must contain ONLY these two sections with no additional text.

Page Content
[Transcribe all handwritten text here. Use Markdown formatting.]

Tags
[Provide 5 comma-separated tags]

Begin transcription:
'''

prompt_5 = '''
You are an automated document processor. Analyze the handwritten note image and return ONLY the content in the exact format below.

CRITICAL: Your response must contain ONLY these two sections with no additional text.

Page Content
[Transcribe all handwritten text here. Use Markdown formatting: # for titles, ## for subtitles, - for bullet points, bold for emphasis]

Preserve all line breaks and indentation exactly as much as possible.

If the image contains code files or code snippets, wrap each code file or snippet in a fenced code block. If a filename is known or can be inferred, put a bold filename header immediately above the fenced block, e.g. **Filename: example.py**, then the code fence with a language tag if known (```python). Preserve all whitespace, indentation, punctuation, and characters exactly. If there are multiple code files/snippets, separate them and label each with its filename or a distinct label.

If the image contains diagrams, wiring diagrams, charts, tables, or other non-text visuals, attempt to preserve their layout and relationships using a preformatted fenced code block (triple backticks) and ASCII-art approximation. Begin such a block with a one-line label like Diagram: Wiring diagram (attempted preservation) or Chart: Flow diagram (attempted preservation). Transcribe all labels, connector names, numbers, and annotations exactly. If a faithful ASCII rendering is not possible, include a single-line placeholder inside the Page Content where the diagram appears: [DIAGRAM — see image; attempted ASCII/description below] followed immediately by:

a short plain-text description (one or two sentences) of what the diagram depicts, and

an attempted ASCII-art or labeled list that preserves component names and connections.

Do not change, summarize, or add content beyond faithfully transcribing text, code, and diagram labels. Mark any unclear or illegible characters with [UNCLEAR] inline where they appear.

Use Markdown headings and bullet styles as requested (#, ##, -, bold) to reflect the visual structure of the handwritten note (titles, subtitles, lists, emphasis).

Maintain the order and pagination of the original note. If multiple pages are provided, include a page separator heading like --- Page 2 --- and continue the exact same transcription rules for each page.

Tags
[Provide 5 comma-separated tags]

Begin transcription:
'''

prompt_6 = '''
You are an automated document processor.
Your task is to extract the content from this handwritten notes in a markdown format and add 5 tags at the end.
Output Should be in this format:
[Page Content]
[Tags]
'''

prompt_7 = '''
You are an automated document processor.
Your task is to extract the content from these handwritten notes in Markdown format and then add exactly 5 comma-separated tags on a final line.

IMPORTANT:
- Do NOT add any introductory line, summary, or commentary.
- Do NOT write "Here's the markdown representation..." or any other lead-in.
- Output must start immediately with the Markdown content (for example a header like "# Title" or "## Section").
- The only extra content after the markdown should be a single line with the 5 tags.
- Do not include any other text, explanations, or delimiters.
'''

prompt_8 = '''
You are an automated document processor. Return ONLY valid JSON and nothing else.
The JSON must be exactly: {"page_content": "<markdown string>", "tags": ["tag1","tag2",...]}
Do not add any extra commentary, notes, or code fences.
'''



prompt_9 = '''
You are an automated document processor. 
Your task is to extract the content from this handwritten notes in a markdown format Return ONLY valid JSON and nothing else.
add the date of the content if any else "NONE" in format DD-MM-YYYY.
The JSON must be exactly: {"page_content": "<markdown string>", "tags": ["tag1","tag2",...], "date": "date of the content"}
Do not add any extra commentary, notes, or code fences.
'''

prompt_10 = '''
1. Transcribe the full handwritten content into the value "page_content" using Markdown formatting:
   - Use `#` for titles, `##` for subtitles, `-` for bullet lists, and `**bold**` for emphasis where appropriate.
   - Preserve line breaks and paragraphs.
   - Do not invent content. If a word or region is unreadable, write "[illegible]" in its place.

2. Create `tags` — a JSON array of 3–7 short tags (single words or short phrases) that summarize the main topics of the content.

Output JSON schema (exact keys required):
{
  "page_content": "<MARKDOWN string>",
  "tags": ["tag1", "tag2", "tag3"]
}

Return only the JSON object and nothing else.
'''

prompt_11 = '''

'''

# 🖊️ Pen and Paper  
### Transform handwritten notes into searchable, conversational knowledge.  

> From ink to insight — powered by OCR, Meilisearch, Google AI, and ElevenLabs.

---

## 🚀 Overview  
**Pen and Paper** is a full-stack application that digitizes handwritten notes, indexes them for semantic search, and enables users to *chat* with their own handwritten content.  

It uses **OCR (Optical Character Recognition)** to extract text from uploaded images or PDFs, then builds a **RAG (Retrieval-Augmented Generation)** pipeline with **Meilisearch** and **Google Generative AI**.  
To make it even more interactive, it integrates **ElevenLabs TTS/STT** for natural voice responses and speech input.

---

## 🧠 Inspiration  
Most great ideas start with a pen and paper — in classrooms, meetings, or brainstorming sessions.  
But once written, they’re often forgotten or unsearchable.  
**Pen and Paper** bridges the gap between analog creativity and digital intelligence by turning handwritten notes into structured, searchable, and conversational data.

---

## 💡 Features  
- 📝 **OCR for Handwriting** — Uses Google Gemma3 4b to extract text from handwritten pages.  
- 🔍 **Instant Search** — Meilisearch provides lightning-fast document indexing and retrieval.  
- 🗣️ **Conversational AI** — Ask natural questions; responses are grounded in your own notes.  
- 🔊 **Voice Interaction** — ElevenLabs TTS/STT for lifelike speech output and voice queries.  
- 🔐 **Multi-tenant Authentication** — Users only access their own data, protected by JWT.  
- 🧩 **Modular Architecture** — Easily replace APIs with local models for self-hosted setups.  

---

## 🏗️ Tech Stack  

### Backend  
- **FastAPI** — API, authentication, file handling, image preprocessing and pipeline orchestration  
- **Google Gemma3 4b** — OCR for handwritten text  
- **Meilisearch** — Document indexing and retrieval  
- **Google Gemma3 4b** — Contextual question answering (RAG)  
- **ElevenLabs API** — Text-to-Speech (TTS) and Speech-to-Text (STT)  
- **Supabase** — Secure file storage, user management and blob storage  

### Frontend  
- **React + Vite** — Clean, responsive UI   

---

## ⚙️ How It Works  

1. **User uploads handwritten notes** (images or PDFs).  
2. **FastAPI backend** sends them to the **Google Gemma3 4b** for OCR.  
3. Extracted text is indexed in **Meilisearch** under the user’s unique namespace.  
4. When a query is made:  
   - Relevant context is fetched from Meilisearch.  
   - Context and query are passed to **Gemma LLM** for RAG-based response.  
   - Optionally, ElevenLabs converts the answer into speech.  
5. **React frontend** displays both the text and the voice response.  

---

## 🧩 Architecture  

```text
+-------------+        +----------------+       +------------------+
|  React UI   | <----> |   FastAPI API  | <-->  |  Meilisearch DB  |
| (Frontend)  |        | (Backend)      |       +------------------+
+-------------+        |   |    |       |       +------------------+
                       |   |    |       | <-->  | Google Vision API |
                       |   |    |       | <-->  | Google Generative |
                       |   |    |       | <-->  | ElevenLabs API    |
                       +----------------+       +------------------+

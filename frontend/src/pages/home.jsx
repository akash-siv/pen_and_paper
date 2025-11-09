import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import Cookies from 'js-cookie';
import toast, { Toaster } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileText,
  Upload,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Loader2,
  RefreshCw,
  Eye,
  BookOpen,
  Move,
  FolderOpen,
  Trash2,
  Clock,
  HardDrive,
  X,
  Folder,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  LogOut,
  File,
  FileEdit,
  Mic,
  MicOff,
  Feather
} from "lucide-react";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

// IndexedDB utilities
const DB_NAME = 'PDFReaderDB';
const DB_VERSION = 1;
const STORE_NAME = 'pdfs';

const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('dateAdded', 'dateAdded', { unique: false });
      }
    };
  });
};

const savePDFToDB = async (file) => {
  try {
    // First, read the file data before opening the transaction
    const arrayBuffer = await file.arrayBuffer();
    
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const pdfData = {
      id: Date.now().toString(),
      name: file.name,
      size: file.size,
      type: file.type,
      dateAdded: new Date().toISOString(),
      data: arrayBuffer
    };
    
    return new Promise((resolve, reject) => {
      const request = store.add(pdfData);
      
      request.onsuccess = () => {
        resolve(pdfData);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
      
      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error('Error saving PDF to IndexedDB:', error);
    throw error;
  }
};

const getPDFsFromDB = async () => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error getting PDFs from IndexedDB:', error);
    return [];
  }
};

const deletePDFFromDB = async (id) => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    await store.delete(id);
  } catch (error) {
    console.error('Error deleting PDF from IndexedDB:', error);
    throw error;
  }
};

const Home = () => {
  const navigate = useNavigate();
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1.2);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [viewPosition, setViewPosition] = useState({ x: 0, y: 0 });
  const [storedPDFs, setStoredPDFs] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [markdownContent, setMarkdownContent] = useState('');
  const [currentMarkdownFile, setCurrentMarkdownFile] = useState(null);
  const [viewMode, setViewMode] = useState('pdf'); // 'pdf' or 'markdown'
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState([]);
  const [isGlobalSearching, setIsGlobalSearching] = useState(false);
  const [showGlobalSearchResults, setShowGlobalSearchResults] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const renderTaskRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Logout function
  const handleLogout = () => {
    console.log('🚪 Logging out...');
    
    // Don't clear IndexedDB - just hide PDFs based on user authentication
    // This allows users to keep their PDFs when they log back in
    
    // Delete access token from cookies
    Cookies.remove('access_token');
    // Clear session storage
    sessionStorage.clear();
    console.log('✅ Access token removed, redirecting to login...');
    console.log('💾 PDFs kept in local storage (hidden from other users)');
    toast.success('Logged out successfully');
    // Redirect to login page
    navigate('/login');
  };

  // Load stored PDFs on component mount and download books from server
  useEffect(() => {
    loadStoredPDFs();
    downloadBooksFromServer();
  }, []);

  const downloadBooksFromServer = async () => {
    try {
      const bookIdsStr = sessionStorage.getItem("book_ids");
      const accessToken = Cookies.get('access_token');
      
      if (!bookIdsStr || !accessToken) {
        console.log('No book IDs or access token found. Skipping download.');
        return;
      }

      const bookIds = JSON.parse(bookIdsStr);
      
      if (!Array.isArray(bookIds) || bookIds.length === 0) {
        console.log('No books to download.');
        return;
      }

      console.log(`\n📥 DOWNLOADING ${bookIds.length} BOOKS FROM SERVER`);
      
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
      
      for (const bookId of bookIds) {
        try {
          // Check if book already exists in local storage
          const existingPDFs = await getPDFsFromDB();
          const alreadyExists = existingPDFs.some(pdf => pdf.book_id === bookId);
          
          if (alreadyExists) {
            console.log(`📄 Book ${bookId} already exists locally. Skipping.`);
            continue;
          }

          console.log(`\n📥 Downloading book: ${bookId}`);
          console.log(`Endpoint: ${apiBaseUrl}/documents/download`);
          console.log(`Method: POST`);
          
          const requestPayload = {
            book_ids: [bookId],
            target_path: null
          };
          console.log(`📤 REQUEST PAYLOAD:`, JSON.stringify(requestPayload, null, 2));
          
          const response = await fetch(`${apiBaseUrl}/documents/download`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestPayload),
          });

          console.log(`Response Status: ${response.status} ${response.statusText}`);
          console.log(`Response Headers:`, {
            'content-type': response.headers.get('content-type'),
            'content-length': response.headers.get('content-length'),
            'content-disposition': response.headers.get('content-disposition')
          });

          if (response.ok) {
            const contentType = response.headers.get('content-type');
            
            // Check if response is JSON with base64 data
            if (contentType && contentType.includes('application/json')) {
              console.log(`📦 Received JSON response, checking for base64 data...`);
              const jsonData = await response.json();
              
              // Check if response has base64-encoded files
              if (jsonData.files && Array.isArray(jsonData.files) && jsonData.files.length > 0) {
                console.log(`📚 Found ${jsonData.files.length} files in response`);
                
                // Find the PDF file for this book_id
                const pdfFile = jsonData.files.find(
                  file => file.book_id === bookId && file.mime === 'application/pdf'
                );
                
                if (pdfFile && pdfFile.b64) {
                  console.log(`✅ Found PDF file: ${pdfFile.filename}`);
                  console.log(`📄 File size: ${(pdfFile.size_bytes / (1024 * 1024)).toFixed(2)} MB`);
                  
                  // Decode base64 to binary
                  console.log('🔄 Decoding base64 data...');
                  const binaryString = atob(pdfFile.b64);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  const arrayBuffer = bytes.buffer;
                  
                  console.log(`✅ Decoded ${(arrayBuffer.byteLength / (1024 * 1024)).toFixed(2)} MB of PDF data`);
                  
                  // Ensure .pdf extension
                  let filename = pdfFile.filename;
                  if (!filename.endsWith('.pdf')) {
                    filename += '.pdf';
                  }
                  
                  // Save to IndexedDB with book_id
                  console.log(`💾 Saving to IndexedDB...`);
                  const db = await openDB();
                  const transaction = db.transaction([STORE_NAME], 'readwrite');
                  const store = transaction.objectStore(STORE_NAME);
                  
                  const pdfData = {
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    name: filename,
                    size: arrayBuffer.byteLength,
                    type: 'application/pdf',
                    dateAdded: new Date().toISOString(),
                    data: arrayBuffer,
                    book_id: bookId
                  };
                  
                  await new Promise((resolve, reject) => {
                    const request = store.add(pdfData);
                    request.onsuccess = () => {
                      console.log(`✅ Successfully saved to IndexedDB`);
                      resolve();
                    };
                    request.onerror = () => {
                      console.error(`❌ IndexedDB error:`, request.error);
                      reject(request.error);
                    };
                  });

                  console.log(`✅ Downloaded and saved: ${filename} (${bookId})`);
                  toast.success(`Downloaded: ${filename}`);
                } else {
                  console.log('❌ No PDF file found in response for book_id:', bookId);
                  toast.error(`PDF file not found for book ${bookId}`);
                }
              } else {
                console.log('❌ Unexpected JSON response format:', jsonData);
                toast.error(`Unexpected server response format for book ${bookId}`);
              }
            } else {
              // Handle blob response (original code)
              console.log(`✅ Response OK, downloading blob...`);
              const blob = await response.blob();
              console.log(`📦 Blob received: ${blob.size} bytes, type: ${blob.type}`);
              
              // Get filename from Content-Disposition header or use book_id
              let filename = `${bookId}.pdf`;
              const contentDisposition = response.headers.get('Content-Disposition');
              if (contentDisposition) {
                console.log(`Content-Disposition: ${contentDisposition}`);
                const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
                if (filenameMatch) {
                  filename = filenameMatch[1];
                }
              }
              console.log(`📄 Filename: ${filename}`);

              // Convert blob to ArrayBuffer directly
              console.log(`💾 Converting blob to ArrayBuffer...`);
              const arrayBuffer = await blob.arrayBuffer();
              console.log(`📂 ArrayBuffer created: ${arrayBuffer.byteLength} bytes`);
              
              // Save to IndexedDB with book_id
              console.log(`💾 Saving to IndexedDB...`);
              const db = await openDB();
              const transaction = db.transaction([STORE_NAME], 'readwrite');
              const store = transaction.objectStore(STORE_NAME);
              
              const pdfData = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                name: filename,
                size: blob.size,
                type: blob.type || 'application/pdf',
                dateAdded: new Date().toISOString(),
                data: arrayBuffer,
                book_id: bookId
              };
              
              await new Promise((resolve, reject) => {
                const request = store.add(pdfData);
                request.onsuccess = () => {
                  console.log(`✅ Successfully saved to IndexedDB`);
                  resolve();
                };
                request.onerror = () => {
                  console.error(`❌ IndexedDB error:`, request.error);
                  reject(request.error);
                };
              });

              console.log(`✅ Downloaded and saved: ${filename} (${bookId})`);
              toast.success(`Downloaded: ${filename}`);
            }
          } else {
            console.error(`❌ Response not OK: ${response.status}`);
            const errorText = await response.text();
            console.error(`Error response body:`, errorText);
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch (e) {
              errorData = { message: errorText };
            }
            console.error(`❌ Failed to download book ${bookId}:`, errorData);
            toast.error(`Failed to download book ${bookId}: ${response.status}`);
          }
        } catch (error) {
          console.error(`❌ Error downloading book ${bookId}:`, error);
          toast.error(`Error downloading book ${bookId}`);
        }
      }
      
      // Reload stored PDFs after downloading
      await loadStoredPDFs();
      console.log('\n✅ ALL BOOKS DOWNLOADED');
      
    } catch (error) {
      console.error('Error in downloadBooksFromServer:', error);
    }
  };

  const loadStoredPDFs = async () => {
    try {
      const pdfs = await getPDFsFromDB();
      
      // Get user's book IDs from session storage
      const bookIdsStr = sessionStorage.getItem("book_ids");
      const userBookIds = bookIdsStr ? JSON.parse(bookIdsStr) : [];
      
      console.log('👤 User\'s book IDs:', userBookIds);
      console.log('📚 Total PDFs in IndexedDB:', pdfs.length);
      
      // Filter PDFs to only show those that belong to the current user
      // Don't delete unauthorized PDFs, just hide them
      const userPDFs = pdfs.filter(pdf => {
        if (pdf.book_id && userBookIds.includes(pdf.book_id)) {
          // This PDF belongs to the current user
          return true;
        } else if (pdf.book_id) {
          // This PDF has a book_id but doesn't belong to current user - hide it
          console.log(`�️ Hiding PDF from other user: ${pdf.name} (book_id: ${pdf.book_id})`);
          return false;
        } else {
          // This PDF doesn't have a book_id (legacy PDF) - hide it for security
          console.log(`�️ Hiding PDF without book_id: ${pdf.name}`);
          return false;
        }
      });
      
      const sortedPDFs = userPDFs.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
      setStoredPDFs(sortedPDFs);
      
      const hiddenCount = pdfs.length - userPDFs.length;
      console.log('✅ Showing user\'s PDFs:', sortedPDFs.length);
      if (hiddenCount > 0) {
        console.log(`👁️ Hidden PDFs from other users: ${hiddenCount}`);
      }
      
      // Log storage info to console
      setTimeout(() => logStorageInfo(), 100); // Small delay to ensure state is updated
    } catch (error) {
      console.error('Error loading stored PDFs:', error);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setLoading(true);
      setError(null);
      
      try {
        // Upload to backend endpoint first to get book_id
        const uploadResult = await uploadPDFToBackend(file);
        
        if (uploadResult && uploadResult.book_id) {
          // Save to IndexedDB locally with book_id
          await savePDFToDBWithBookId(file, uploadResult.book_id);
          console.log(`\n✅ PDF SAVED LOCALLY: "${file.name}"`);
          console.log(`Size: ${(file.size / (1024 * 1024)).toFixed(2)} MB`);
          console.log(`Type: ${file.type}`);
          console.log(`Book ID: ${uploadResult.book_id}`);
          
          toast.success(`PDF uploaded successfully: ${file.name}`);
        } else {
          // Fallback: save without book_id
          await savePDFToDB(file);
          toast.warning('PDF saved locally but upload failed');
        }
        
        await loadStoredPDFs();
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
        renderPage(pdf, 1);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError('Failed to load PDF file');
        toast.error('Failed to upload PDF');
      } finally {
        setLoading(false);
      }
    } else {
      alert('Please select a valid PDF file');
      toast.error('Please select a valid PDF file');
    }
  };

  const savePDFToDBWithBookId = async (file, bookId) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      const db = await openDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const pdfData = {
        id: Date.now().toString(),
        name: file.name,
        size: file.size,
        type: file.type,
        dateAdded: new Date().toISOString(),
        data: arrayBuffer,
        book_id: bookId // Store book_id from backend
      };
      
      return new Promise((resolve, reject) => {
        const request = store.add(pdfData);
        
        request.onsuccess = () => {
          resolve(pdfData);
        };
        
        request.onerror = () => {
          reject(request.error);
        };
        
        transaction.onerror = () => {
          reject(transaction.error);
        };
      });
    } catch (error) {
      console.error('Error saving PDF to IndexedDB:', error);
      throw error;
    }
  };

  const uploadPDFToBackend = async (file) => {
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
      const accessToken = Cookies.get('access_token');
      
      if (!accessToken) {
        console.warn('⚠️ No access token found. User may need to login.');
        toast.error('Please login to upload PDFs to the server');
        return null;
      }

      // Create FormData to send the file
      const formData = new FormData();
      formData.append('file', file);

      console.log(`\n📤 UPLOADING TO SERVER: "${file.name}"`);
      console.log(`Endpoint: ${apiBaseUrl}/documents/upload`);
      console.log(`File size: ${(file.size / (1024 * 1024)).toFixed(2)} MB`);

      const response = await fetch(`${apiBaseUrl}/documents/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const responseData = await response.json();

      if (response.ok) {
        console.log('\n✅ UPLOAD SUCCESS!');
        console.log('Response Status:', response.status);
        console.log('Response Data:', JSON.stringify(responseData, null, 2));
        
        // Log specific fields from response
        if (responseData.book_id) {
          console.log('Book ID:', responseData.book_id);
        }
        if (responseData.document_id) {
          console.log('Document ID:', responseData.document_id);
        }
        if (responseData.filename) {
          console.log('Filename:', responseData.filename);
        }
        if (responseData.message) {
          console.log('Message:', responseData.message);
        }
        
        return responseData; // Return full response to get book_id
      } else {
        console.error('\n❌ UPLOAD FAILED!');
        console.error('Response Status:', response.status);
        console.error('Response Data:', JSON.stringify(responseData, null, 2));
        toast.error(responseData.message || 'Failed to upload PDF to server');
        return null;
      }
    } catch (error) {
      console.error('\n❌ UPLOAD ERROR:', error);
      console.error('Error details:', error.message);
      toast.error('Network error while uploading PDF');
      return null;
    }
  };

  const loadStoredPDF = async (storedPDF) => {
    try {
      setLoading(true);
      setError(null);
      
      // Security check: Verify the PDF belongs to the current user
      const bookIdsStr = sessionStorage.getItem("book_ids");
      const userBookIds = bookIdsStr ? JSON.parse(bookIdsStr) : [];
      
      if (!storedPDF.book_id || !userBookIds.includes(storedPDF.book_id)) {
        console.error('🚫 Unauthorized access attempt: PDF does not belong to current user');
        toast.error('You do not have permission to view this PDF');
        setLoading(false);
        return;
      }
      
      // Switch to PDF view mode when loading a PDF
      setViewMode('pdf');
      setCurrentMarkdownFile(null);
      
      // Clone the ArrayBuffer to avoid detached buffer issues
      const clonedData = storedPDF.data.slice(0);
      
      // Create a file-like object instead of using File constructor
      const fileObject = {
        name: storedPDF.name,
        size: storedPDF.size,
        type: storedPDF.type,
        lastModified: new Date(storedPDF.dateAdded).getTime(),
        arrayBuffer: () => Promise.resolve(clonedData)
      };
      setPdfFile(fileObject);
      
      const pdf = await pdfjsLib.getDocument({ data: clonedData }).promise;
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
      renderPage(pdf, 1);
    } catch (err) {
      console.error('Error loading stored PDF:', err);
      setError('Failed to load stored PDF file');
    } finally {
      setLoading(false);
    }
  };

  const deleteStoredPDF = async (id) => {
    try {
      const pdfToDelete = storedPDFs.find(pdf => pdf.id === id);
      
      // Security check: Verify the PDF belongs to the current user
      if (pdfToDelete) {
        const bookIdsStr = sessionStorage.getItem("book_ids");
        const userBookIds = bookIdsStr ? JSON.parse(bookIdsStr) : [];
        
        if (!pdfToDelete.book_id || !userBookIds.includes(pdfToDelete.book_id)) {
          console.error('🚫 Unauthorized delete attempt: PDF does not belong to current user');
          toast.error('You do not have permission to delete this PDF');
          return;
        }
      }
      
      await deletePDFFromDB(id);
      
      if (pdfToDelete) {
        console.log(`\n🗑️ PDF DELETED: "${pdfToDelete.name}"`);
        console.log(`Freed: ${(pdfToDelete.size / (1024 * 1024)).toFixed(2)} MB`);
      }
      
      await loadStoredPDFs();
    } catch (error) {
      console.error('Error deleting PDF:', error);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toggleFolder = (pdfId) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(pdfId)) {
      newExpanded.delete(pdfId);
    } else {
      newExpanded.add(pdfId);
    }
    setExpandedFolders(newExpanded);
  };

  const getFileNameWithoutExtension = (fileName) => {
    return fileName.replace(/\.[^/.]+$/, "");
  };

  const handleMarkdownClick = (pdf) => {
    // Security check: Verify the PDF belongs to the current user
    const bookIdsStr = sessionStorage.getItem("book_ids");
    const userBookIds = bookIdsStr ? JSON.parse(bookIdsStr) : [];
    
    if (!pdf.book_id || !userBookIds.includes(pdf.book_id)) {
      console.error('🚫 Unauthorized access attempt: Markdown does not belong to current user');
      toast.error('You do not have permission to view this markdown file');
      return;
    }
    
    const baseFileName = getFileNameWithoutExtension(pdf.name);
    const fakeMarkdownContent = `# ${baseFileName} - Notes

## Document Summary
This is a markdown file for **${pdf.name}**. You can add your notes, thoughts, and annotations here.

## Key Points
- Document uploaded on: ${formatDate(pdf.dateAdded)}
- File size: ${formatFileSize(pdf.size)}
- Pages: This information would be available after processing

## My Notes
*Add your personal notes and insights about this document here...*

### Important Sections
- [ ] Introduction
- [ ] Main Content
- [ ] Conclusion

### Questions & Ideas
1. What are the main takeaways?
2. How does this relate to other documents?
3. Action items from this document?

---

**Created:** ${new Date().toLocaleDateString()}
**Last Modified:** ${new Date().toLocaleDateString()}

> This is a sample markdown file. In a real implementation, this content would be stored and editable.`;
    
    setMarkdownContent(fakeMarkdownContent);
    setCurrentMarkdownFile(`${baseFileName}.md`);
    setViewMode('markdown');
  };

  const switchToPdfView = () => {
    setViewMode('pdf');
    setCurrentMarkdownFile(null);
  };

  const startVoiceRecording = async () => {
    try {
      console.log('🎙️ Requesting microphone access...');
      
      // Check if browser supports mediaDevices
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('❌ Browser does not support audio recording');
        toast.error('Your browser does not support audio recording');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('✅ Microphone access granted');
      
      const mediaRecorder = new MediaRecorder(stream);
      console.log('✅ MediaRecorder created');
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        console.log('📊 Audio data available:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('⏹️ Recording stopped, total chunks:', audioChunksRef.current.length);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log('📦 Audio blob created:', audioBlob.size, 'bytes');
        await sendAudioToSTT(audioBlob);
        
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
        console.log('🔒 Microphone released');
      };

      mediaRecorder.start();
      console.log('▶️ MediaRecorder started');
      
      setIsRecording(true);
      setShowVoiceModal(true);
      console.log('✅ Voice recording started successfully');
      toast.success('Recording started - speak now!');
    } catch (error) {
      console.error('❌ Error starting voice recording:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        toast.error('Microphone permission denied. Please allow access and try again.');
      } else if (error.name === 'NotFoundError') {
        toast.error('No microphone found. Please connect a microphone.');
      } else {
        toast.error('Failed to access microphone: ' + error.message);
      }
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessingVoice(true);
      console.log('🎤 Voice recording stopped, processing...');
    }
  };

  const sendAudioToSTT = async (audioBlob) => {
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
      const accessToken = Cookies.get('access_token');

      if (!accessToken) {
        toast.error('Please login to use voice search');
        setIsProcessingVoice(false);
        setShowVoiceModal(false);
        return;
      }

      console.log('\n� SENDING VOICE QUERY TO API');
      console.log('='.repeat(50));
      console.log('Endpoint:', `${apiBaseUrl}/elevenlabs/voice_query`);
      console.log('Audio Blob Size:', (audioBlob.size / 1024).toFixed(2), 'KB');
      console.log('Audio Blob Type:', audioBlob.type);
      console.log('Timestamp:', new Date().toISOString());

      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');

      console.log('\n📤 REQUEST DETAILS:');
      console.log('Method: POST');
      console.log('Authorization: Bearer [TOKEN]');
      console.log('Body: FormData with audio file');

      const response = await fetch(`${apiBaseUrl}/elevenlabs/voice_query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      console.log('\n📥 RESPONSE RECEIVED');
      console.log('='.repeat(50));
      console.log('Status Code:', response.status);
      console.log('Status Text:', response.statusText);
      console.log('Response OK:', response.ok);
      
      console.log('\n📋 RESPONSE HEADERS:');
      const headers = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      console.log(JSON.stringify(headers, null, 2));

      const data = await response.json();
      
      console.log('\n📄 FULL RESPONSE DATA:');
      console.log('='.repeat(50));
      console.log(JSON.stringify(data, null, 2));
      console.log('='.repeat(50));

      if (response.ok) {
        console.log('\n✅ VOICE QUERY SUCCESS!');
        console.log('Response Type:', typeof data);
        console.log('Response Keys:', Object.keys(data));
        
        // Check for audio_base64 in response
        if (data.audio_base64) {
          console.log('\n� AUDIO FOUND IN RESPONSE');
          console.log('Audio Base64 Length:', data.audio_base64.length);
          
          try {
            // Convert base64 to audio blob
            const audioData = atob(data.audio_base64);
            const audioArray = new Uint8Array(audioData.length);
            for (let i = 0; i < audioData.length; i++) {
              audioArray[i] = audioData.charCodeAt(i);
            }
            const audioBlob = new Blob([audioArray], { type: 'audio/mpeg' });
            const audioUrl = URL.createObjectURL(audioBlob);
            
            console.log('✅ Audio blob created successfully');
            console.log('Audio URL:', audioUrl);
            
            // Play the audio
            const audio = new Audio(audioUrl);
            audio.play()
              .then(() => {
                console.log('▶️ Audio playback started');
                toast.success('Playing response audio');
              })
              .catch(err => {
                console.error('❌ Audio playback error:', err);
                toast.error('Failed to play audio');
              });
            
            // Clean up URL after audio finishes
            audio.onended = () => {
              console.log('✅ Audio playback finished');
              URL.revokeObjectURL(audioUrl);
            };
            
          } catch (error) {
            console.error('❌ Error processing audio:', error);
            toast.error('Failed to process audio response');
          }
        } else {
          console.warn('\n⚠️ WARNING: No audio_base64 found in response');
          console.warn('Available fields:', Object.keys(data));
          toast.error('No audio in response');
        }
      } else {
        console.error('\n❌ VOICE QUERY FAILED!');
        console.error('Status Code:', response.status);
        console.error('Status Text:', response.statusText);
        console.error('Error Response:', data);
        toast.error(data.message || data.detail || 'Failed to process voice query');
      }
    } catch (error) {
      console.error('\n❌ EXCEPTION IN VOICE QUERY');
      console.error('='.repeat(50));
      console.error('Error Type:', error.constructor.name);
      console.error('Error Message:', error.message);
      console.error('Error Stack:', error.stack);
      toast.error('Error processing voice query');
    } finally {
      console.log('\n🏁 VOICE QUERY COMPLETE');
      console.log('='.repeat(50));
      setIsProcessingVoice(false);
      setShowVoiceModal(false);
      audioChunksRef.current = [];
    }
  };

  const handleMicClick = (e) => {
    console.log('🎤 MIC BUTTON CLICKED!');
    console.log('Event:', e);
    console.log('Current isRecording state:', isRecording);
    
    if (isRecording) {
      console.log('⏹️ Stopping recording...');
      stopVoiceRecording();
    } else {
      console.log('▶️ Starting recording...');
      startVoiceRecording();
    }
  };

  const performGlobalSearch = async (query) => {
    if (!query.trim()) {
      setGlobalSearchResults([]);
      setShowGlobalSearchResults(false);
      return;
    }

    setIsGlobalSearching(true);
    setShowGlobalSearchResults(true);

    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
      const accessToken = Cookies.get('access_token');

      if (!accessToken) {
        toast.error('Please login to search across documents');
        setIsGlobalSearching(false);
        return;
      }

      console.log(`\n🔍 GLOBAL SEARCH INITIATED`);
      console.log(`Query: "${query}"`);
      console.log(`Endpoint: ${apiBaseUrl}/documents/search`);

      const response = await fetch(`${apiBaseUrl}/documents/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: query,
          limit: 20,
          offset: 0,
          book_id: null,
          tags: [],
          tags_mode: "or",
          date_equals: null
        }),
      });

      const responseData = await response.json();

      if (response.ok) {
        console.log('\n✅ SEARCH SUCCESS!');
        console.log('Response Status:', response.status);
        console.log('Search Results:', JSON.stringify(responseData, null, 2));
        
        // Handle hits array from Meilisearch response
        const hits = responseData.hits || [];
        
        // Log individual results
        if (hits && Array.isArray(hits)) {
          console.log(`\n📚 Found ${hits.length} results:`);
          hits.forEach((result, index) => {
            console.log(`${index + 1}. Book ID: ${result.book_id}, Page: ${result.page_number}, Book Name: ${result.book_name}`);
            if (result.content) {
              console.log(`   Content: "${result.content.substring(0, 100)}..."`);
            }
          });
        }

        setGlobalSearchResults(hits);
        
        if (hits && hits.length > 0) {
          toast.success(`Found ${hits.length} result${hits.length !== 1 ? 's' : ''} across documents`);
        } else {
          toast.error('No results found');
        }
      } else {
        console.error('\n❌ SEARCH FAILED!');
        console.error('Response Status:', response.status);
        console.error('Response Data:', JSON.stringify(responseData, null, 2));
        toast.error(responseData.message || 'Search failed');
        setGlobalSearchResults([]);
      }
    } catch (error) {
      console.error('\n❌ SEARCH ERROR:', error);
      console.error('Error details:', error.message);
      toast.error('Network error during search');
      setGlobalSearchResults([]);
    } finally {
      setIsGlobalSearching(false);
    }
  };

  // Helper function to save blob to IndexedDB
  const saveBlobToIndexedDB = async (arrayBuffer, filename, size, type, bookId) => {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const pdfData = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: filename,
      size: size,
      type: type || 'application/pdf',
      dateAdded: new Date().toISOString(),
      data: arrayBuffer,
      book_id: bookId  // Store book_id for search result matching
    };
    
    console.log(`💾 Saving to IndexedDB:`, {
      id: pdfData.id,
      name: pdfData.name,
      book_id: pdfData.book_id,
      size: `${(pdfData.size / (1024 * 1024)).toFixed(2)} MB`
    });
    
    await new Promise((resolve, reject) => {
      const request = store.add(pdfData);
      request.onsuccess = () => {
        console.log(`✅ Successfully saved to IndexedDB with book_id: ${bookId}`);
        resolve();
      };
      request.onerror = () => {
        console.error(`❌ Failed to save to IndexedDB:`, request.error);
        reject(request.error);
      };
    });
  };

  const handleGlobalSearchResultClick = async (result) => {
    console.log('\n📖 OPENING SEARCH RESULT');
    console.log('Book ID:', result.book_id);
    console.log('Page Number:', result.page_number);
    console.log('Book Name:', result.book_name);

    // Check if PDF already exists in local IndexedDB storage by book_id
    let matchingPDF = storedPDFs.find(pdf => pdf.book_id === result.book_id);

    if (matchingPDF) {
      // PDF found locally - no download needed!
      console.log(`✅ PDF FOUND IN LOCAL STORAGE (IndexedDB)`);
      console.log(`Filename: ${matchingPDF.name}`);
      console.log(`Size: ${(matchingPDF.size / (1024 * 1024)).toFixed(2)} MB`);
      console.log(`Saved on: ${new Date(matchingPDF.dateAdded).toLocaleString()}`);
      console.log(`🚀 OPENING FROM LOCAL STORAGE - NO DOWNLOAD NEEDED!`);
      
      toast.success(`Opening from local storage: ${matchingPDF.name}`, {
        icon: '⚡',
        duration: 2000
      });
    } else {
      // PDF not found locally - need to download from server
      console.log(`❌ PDF NOT FOUND IN LOCAL STORAGE`);
      console.log(`📥 Downloading book ${result.book_id} from server...`);
      
      toast(`Downloading book ${result.book_id}...`, {
        icon: '📥',
        duration: 3000
      });
      
      try {
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
        const accessToken = Cookies.get('access_token');
        
        if (!accessToken) {
          toast.error('Please login to download books');
          return;
        }

        console.log(`\n📥 DOWNLOADING FROM SEARCH RESULT`);
        console.log(`Endpoint: ${apiBaseUrl}/documents/download`);
        console.log(`Book ID: ${result.book_id}`);
        
        // Prepare the request payload - target_path: null means return PDF blob for browser
        const requestPayload = {
          book_ids: [result.book_id],
          target_path: null  // null = return PDF blob for browser storage (IndexedDB)
        };
        
        console.log(`\n📤 REQUEST PAYLOAD:`);
        console.log(JSON.stringify(requestPayload, null, 2));
        
        const response = await fetch(`${apiBaseUrl}/documents/download`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestPayload),
        });

        console.log(`Response Status: ${response.status} ${response.statusText}`);
        console.log(`Response Headers:`, {
          'content-type': response.headers.get('content-type'),
          'content-length': response.headers.get('content-length'),
          'content-disposition': response.headers.get('content-disposition')
        });

        if (response.ok) {
          // Check content type first
          const contentType = response.headers.get('content-type');
          console.log(`📄 Content-Type: ${contentType}`);
          
          // If response is PDF blob, save it to IndexedDB (browser storage)
          if (contentType && contentType.includes('application/pdf')) {
            console.log(`✅ Received PDF blob - saving to browser storage (IndexedDB)`);
            const blob = await response.blob();
            console.log(`📦 Blob received: ${blob.size} bytes, type: ${blob.type}`);
            
            let filename = `${result.book_id}.pdf`;
            if (result.book_name) {
              filename = `${result.book_name}.pdf`;
            }
            
            // Get filename from Content-Disposition header if available
            const contentDisposition = response.headers.get('Content-Disposition');
            if (contentDisposition) {
              const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
              if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1].replace(/['"]/g, '');
              }
            }
            console.log(`📄 Filename: ${filename}`);
            
            // Convert blob to ArrayBuffer and save to IndexedDB (browser storage)
            console.log(`💾 Saving to browser's IndexedDB storage...`);
            const arrayBuffer = await blob.arrayBuffer();
            await saveBlobToIndexedDB(arrayBuffer, filename, blob.size, blob.type, result.book_id);
            
            console.log(`✅ Saved to browser storage: ${filename}`);
            toast.success(`Downloaded and saved: ${filename}`);
            
            // Reload stored PDFs
            await loadStoredPDFs();
            
            // Wait a bit for IndexedDB to be fully written
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const updatedPDFs = await getPDFsFromDB();
            console.log(`📚 Total PDFs in DB after save: ${updatedPDFs.length}`);
            
            matchingPDF = updatedPDFs.find(pdf => pdf.book_id === result.book_id);
            
            if (matchingPDF) {
              console.log(`✅ Found PDF in DB: ${matchingPDF.name} (ID: ${matchingPDF.book_id})`);
            } else {
              console.log(`⚠️ PDF not found immediately, retrying...`);
              // Retry once more
              await new Promise(resolve => setTimeout(resolve, 200));
              const retryPDFs = await getPDFsFromDB();
              matchingPDF = retryPDFs.find(pdf => pdf.book_id === result.book_id);
              if (matchingPDF) {
                console.log(`✅ Found PDF on retry: ${matchingPDF.name}`);
              }
            }
          }
          // If response is JSON, log it and handle differently
          else if (contentType && contentType.includes('application/json')) {
            const jsonData = await response.json();
            console.log(`⚠️ Received JSON response:`, jsonData);
            
            // Check if response has base64-encoded files
            if (jsonData.files && Array.isArray(jsonData.files) && jsonData.files.length > 0) {
              console.log(`📦 Found ${jsonData.files.length} files in response`);
              
              // Find the PDF file for this book_id
              const pdfFile = jsonData.files.find(
                file => file.book_id === result.book_id && file.mime === 'application/pdf'
              );
              
              if (pdfFile && pdfFile.b64) {
                console.log(`✅ Found PDF file: ${pdfFile.filename}`);
                console.log(`📄 File size: ${(pdfFile.size_bytes / (1024 * 1024)).toFixed(2)} MB`);
                
                // Decode base64 to binary
                console.log('🔄 Decoding base64 data...');
                const binaryString = atob(pdfFile.b64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                const arrayBuffer = bytes.buffer;
                
                console.log(`✅ Decoded ${(arrayBuffer.byteLength / (1024 * 1024)).toFixed(2)} MB of PDF data`);
                
                // Ensure .pdf extension
                let filename = pdfFile.filename;
                if (!filename.endsWith('.pdf')) {
                  filename += '.pdf';
                }
                
                console.log(`💾 Saving PDF as: ${filename}`);
                
                // Save to IndexedDB with book_id
                await saveBlobToIndexedDB(
                  arrayBuffer,
                  filename,
                  arrayBuffer.byteLength,
                  'application/pdf',
                  result.book_id
                );
                
                console.log(`✅ Saved to browser storage: ${filename}`);
                toast.success(`Downloaded and saved: ${filename}`);
                
                // Reload stored PDFs to get the newly saved one
                await loadStoredPDFs();
                
                // Wait a bit for IndexedDB to be fully written
                await new Promise(resolve => setTimeout(resolve, 100));
                
                const updatedPDFs = await getPDFsFromDB();
                console.log(`📚 Total PDFs in DB after save: ${updatedPDFs.length}`);
                
                matchingPDF = updatedPDFs.find(pdf => pdf.book_id === result.book_id);
                
                if (matchingPDF) {
                  console.log(`✅ Found PDF in DB: ${matchingPDF.name} (ID: ${matchingPDF.book_id})`);
                } else {
                  console.log(`⚠️ PDF not found immediately, retrying...`);
                  // Retry once more
                  await new Promise(resolve => setTimeout(resolve, 200));
                  const retryPDFs = await getPDFsFromDB();
                  matchingPDF = retryPDFs.find(pdf => pdf.book_id === result.book_id);
                  if (matchingPDF) {
                    console.log(`✅ Found PDF on retry: ${matchingPDF.name}`);
                  }
                }
              } else {
                console.log('❌ No PDF file found in response for book_id:', result.book_id);
                toast.error('PDF file not found in server response');
                return;
              }
            }
            // Check if the response has downloaded files (old format)
            else if (jsonData.downloaded && jsonData.downloaded[result.book_id]) {
              const filePaths = jsonData.downloaded[result.book_id];
              console.log(`📄 File downloaded to server: ${filePaths}`);
              
              // The server downloaded the file but we can't access it from browser
              console.log(`❌ Cannot access server's local filesystem from browser`);
              console.log(`� Backend needs to return PDF blob directly, not file paths`);
              
              toast.error('PDF is on server but cannot be accessed. Backend must return PDF blob directly.', {
                duration: 5000
              });
              return;
            }
            
            // Check if there's a direct URL or path we can download from
            if (jsonData.url || jsonData.path || jsonData.file_path) {
              const downloadUrl = jsonData.url || jsonData.path || jsonData.file_path;
              console.log(`📥 Downloading from URL: ${downloadUrl}`);
              
              // Try downloading from the URL
              const pdfResponse = await fetch(downloadUrl, {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                },
              });
              
              if (pdfResponse.ok) {
                const blob = await pdfResponse.blob();
                console.log(`📦 Blob received from URL: ${blob.size} bytes, type: ${blob.type}`);
                
                let filename = `${result.book_id}.pdf`;
                if (result.book_name) {
                  filename = `${result.book_name}.pdf`;
                }
                
                const arrayBuffer = await blob.arrayBuffer();
                await saveBlobToIndexedDB(arrayBuffer, filename, blob.size, blob.type, result.book_id);
                
                console.log(`✅ Downloaded and saved: ${filename}`);
                toast.success(`Downloaded: ${filename}`);
                
                await loadStoredPDFs();
                const updatedPDFs = await getPDFsFromDB();
                matchingPDF = updatedPDFs.find(pdf => pdf.book_id === result.book_id);
              } else {
                toast.error(`Failed to download from URL: ${pdfResponse.status}`);
                return;
              }
            } else {
              toast.error('Backend Error: Server returned JSON instead of PDF file. Please configure /documents/download to return PDF blob.', {
                duration: 5000
              });
              console.error('❌ BACKEND CONFIGURATION ERROR');
              console.error('Unexpected JSON response format:', jsonData);
              console.log('💡 SOLUTION: The /documents/download endpoint should return the PDF file directly as a blob with Content-Type: application/pdf');
              console.log('💡 Current behavior: Server is downloading files to its local filesystem and returning file paths');
              console.log('💡 Expected behavior: Server should stream the PDF bytes directly to the browser');
              return;
            }
          } else {
            // Normal PDF blob response
            const blob = await response.blob();
            console.log(`📦 Blob received: ${blob.size} bytes, type: ${blob.type}`);
            
            // Validate blob size
            if (blob.size === 0) {
              console.error(`❌ Received empty blob!`);
              toast.error('Downloaded file is empty');
              return;
            }
            
            // Get filename from Content-Disposition header or use book_id
            let filename = `${result.book_id}.pdf`;
            const contentDisposition = response.headers.get('Content-Disposition');
            if (contentDisposition) {
              const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
              if (filenameMatch) {
                filename = filenameMatch[1];
              }
            }
            
            // If book_name is available in result, use it
            if (result.book_name) {
              filename = `${result.book_name}.pdf`;
            }

            console.log(`📄 Saving as: ${filename}`);
            
            // Convert blob to ArrayBuffer directly
            const arrayBuffer = await blob.arrayBuffer();
            console.log(`📂 ArrayBuffer size: ${arrayBuffer.byteLength} bytes`);
            
            // Save to IndexedDB
            await saveBlobToIndexedDB(arrayBuffer, filename, blob.size, blob.type, result.book_id);

            console.log(`✅ Downloaded and saved: ${filename} (${result.book_id})`);
            toast.success(`Downloaded: ${filename}`);
            
            // Reload stored PDFs to get the newly downloaded book
            await loadStoredPDFs();
            
            // Wait a bit for IndexedDB to be fully written
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Find the newly downloaded PDF
            const updatedPDFs = await getPDFsFromDB();
            console.log(`📚 Total PDFs in DB after save: ${updatedPDFs.length}`);
            
            matchingPDF = updatedPDFs.find(pdf => pdf.book_id === result.book_id);
            
            if (matchingPDF) {
              console.log(`✅ Found PDF in DB: ${matchingPDF.name} (ID: ${matchingPDF.book_id})`);
            } else {
              console.log(`⚠️ PDF not found immediately, retrying...`);
              // Retry once more
              await new Promise(resolve => setTimeout(resolve, 200));
              const retryPDFs = await getPDFsFromDB();
              matchingPDF = retryPDFs.find(pdf => pdf.book_id === result.book_id);
              if (matchingPDF) {
                console.log(`✅ Found PDF on retry: ${matchingPDF.name}`);
              }
            }
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error(`❌ Failed to download book ${result.book_id}:`, errorData);
          toast.error(`Failed to download book ${result.book_id}`);
          return;
        }
      } catch (error) {
        console.error(`❌ Error downloading book ${result.book_id}:`, error);
        toast.error(`Error downloading book: ${error.message}`);
        return;
      }
    }

    // Final check: ensure matchingPDF is found
    if (!matchingPDF) {
      console.log(`⚠️ matchingPDF not set, doing final DB lookup...`);
      const finalPDFs = await getPDFsFromDB();
      matchingPDF = finalPDFs.find(pdf => pdf.book_id === result.book_id);
      if (matchingPDF) {
        console.log(`✅ Found PDF in final lookup: ${matchingPDF.name}`);
      } else {
        console.error(`❌ PDF with book_id ${result.book_id} not found in IndexedDB after download`);
        toast.error('Failed to open PDF after download. Please try again.');
        return;
      }
    }

    // Now we definitely have matchingPDF
    console.log(`\n📖 OPENING PDF FROM INDEXEDDB`);
    console.log(`Book ID: ${matchingPDF.book_id}`);
    console.log(`Filename: ${matchingPDF.name}`);
    console.log(`Target Page: ${result.page_number}`);
    
    try {
      // Load the PDF from IndexedDB
      await loadStoredPDF(matchingPDF);
      console.log(`✅ PDF loaded into viewer`);
      
      // Keep search results visible (don't close the panel)
      // setShowGlobalSearchResults(false); // Commented out to keep results visible
      
      // Wait for PDF to fully load and render before navigating to page
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Navigate to the specific page
      if (result.page_number) {
        const pageNum = parseInt(result.page_number);
        console.log(`📍 Navigating to page ${pageNum}...`);
        setCurrentPage(pageNum);
        
        // Verify navigation after a short delay
        setTimeout(() => {
          console.log(`✅ Navigation complete - current page should be ${pageNum}`);
          toast.success(`Opened: ${matchingPDF.name} (Page ${pageNum})`, {
            icon: '📖',
            duration: 3000
          });
        }, 300);
      } else {
        toast.success(`Opened: ${matchingPDF.name}`, {
          icon: '📖',
          duration: 2000
        });
      }
    } catch (error) {
      console.error(`❌ Error loading or navigating PDF:`, error);
      toast.error(`Failed to open PDF: ${error.message}`);
    }
  };



  const logStorageInfo = async () => {
    try {
      // Get browser storage estimate
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const usedGB = (estimate.usage / (1024 * 1024 * 1024)).toFixed(2);
        const quotaGB = (estimate.quota / (1024 * 1024 * 1024)).toFixed(2);
        const percentUsed = ((estimate.usage / estimate.quota) * 100).toFixed(1);
        
        console.log('\n📊 BROWSER STORAGE INFO:');
        console.log(`Used: ${usedGB} GB / ${quotaGB} GB (${percentUsed}%)`);
        console.log(`Available: ${((estimate.quota - estimate.usage) / (1024 * 1024 * 1024)).toFixed(2)} GB remaining`);
      }
      
      // Calculate PDF storage usage
      const totalPDFSize = storedPDFs.reduce((total, pdf) => total + (pdf.size || 0), 0);
      const pdfSizeMB = (totalPDFSize / (1024 * 1024)).toFixed(2);
      
      console.log('\n📁 PDF LIBRARY INFO:');
      console.log(`Total PDFs: ${storedPDFs.length}`);
      console.log(`Total PDF Size: ${pdfSizeMB} MB`);
      
      if (storedPDFs.length > 0) {
        const avgSize = (totalPDFSize / storedPDFs.length / (1024 * 1024)).toFixed(2);
        const largestPDF = storedPDFs.reduce((max, pdf) => pdf.size > max.size ? pdf : max);
        const smallestPDF = storedPDFs.reduce((min, pdf) => pdf.size < min.size ? pdf : min);
        
        console.log(`Average PDF Size: ${avgSize} MB`);
        console.log(`Largest PDF: "${largestPDF.name}" (${(largestPDF.size / (1024 * 1024)).toFixed(2)} MB)`);
        console.log(`Smallest PDF: "${smallestPDF.name}" (${(smallestPDF.size / (1024 * 1024)).toFixed(2)} MB)`);
        
        // Storage capacity estimates
        if ('storage' in navigator && 'estimate' in navigator.storage) {
          const estimate = await navigator.storage.estimate();
          const remainingSpace = estimate.quota - estimate.usage;
          const canStorePDFs = Math.floor(remainingSpace / (totalPDFSize / storedPDFs.length));
          
          console.log('\n🚀 CAPACITY ESTIMATES:');
          console.log(`Remaining storage: ${(remainingSpace / (1024 * 1024 * 1024)).toFixed(2)} GB`);
          console.log(`Can store ~${canStorePDFs} more PDFs (based on current average size)`);
        }
      }
      
      console.log('\n📋 PDF LIST:');
      storedPDFs.forEach((pdf, index) => {
        const sizeMB = (pdf.size / (1024 * 1024)).toFixed(2);
        const date = new Date(pdf.dateAdded).toLocaleDateString();
        console.log(`${index + 1}. "${pdf.name}" - ${sizeMB} MB (${date})`);
      });
      
    } catch (error) {
      console.error('Error getting storage info:', error);
    }
  };

  const renderPage = async (pdf, pageNum) => {
    if (!pdf || !canvasRef.current) return;
    
    // Cancel any ongoing render task
    if (renderTaskRef.current && renderTaskRef.current.cancel) {
      try {
        renderTaskRef.current.cancel();
      } catch (err) {
        // Ignore cancellation errors
        if (err && err.name !== 'RenderingCancelledException') {
          console.error('Error cancelling render:', err);
        }
      }
      renderTaskRef.current = null;
    }
    
    try {
      const page = await pdf.getPage(pageNum);
      const canvas = canvasRef.current;
      
      // Double check canvas still exists
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      
      const viewport = page.getViewport({ 
        scale: zoom,
        rotation: rotation 
      });
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };
      
      // Store the render task so we can cancel it if needed
      renderTaskRef.current = page.render(renderContext);
      
      // Render the PDF page
      await renderTaskRef.current.promise;
      
      // Clear the render task reference when done
      renderTaskRef.current = null;
      
      // Add search highlights if there are search results for this page
      if (searchResults.length > 0 && searchTerm && canvasRef.current) {
        await highlightSearchResults(page, ctx, viewport, pageNum);
      }
    } catch (err) {
      // Ignore cancellation errors
      if (err && err.name !== 'RenderingCancelledException') {
        console.error('Error rendering page:', err);
        // Only set error if canvas still exists (component not unmounted)
        if (canvasRef.current) {
          setError('Failed to render PDF page');
        }
      }
    }
  };

  const highlightSearchResults = async (page, ctx, viewport, pageNum) => {
    try {
      const textContent = await page.getTextContent();
      const pageSearchResults = searchResults.filter(result => result.pageNum === pageNum);
      
      if (pageSearchResults.length === 0) return;

      // Create a map of text items with their positions
      const textItems = textContent.items;
      let currentIndex = 0;
      let pageText = '';
      const textPositions = [];

      textItems.forEach((item, itemIndex) => {
        const itemText = item.str;
        textPositions.push({
          startIndex: pageText.length,
          endIndex: pageText.length + itemText.length,
          item: item,
          itemIndex: itemIndex
        });
        pageText += itemText + ' ';
        currentIndex += itemText.length + 1;
      });

      // Highlight each search result
      pageSearchResults.forEach((result, resultIndex) => {
        const isCurrentResult = currentSearchIndex >= 0 && 
          searchResults[currentSearchIndex] === result;
        
        // Find the text item that contains this search result
        const matchStart = result.index;
        const matchEnd = matchStart + result.text.length;
        
        for (let i = 0; i < textPositions.length; i++) {
          const pos = textPositions[i];
          
          // Check if this text item overlaps with our search match
          if (matchStart < pos.endIndex && matchEnd > pos.startIndex) {
            const item = pos.item;
            
            // Transform the text item coordinates to canvas coordinates
            const transform = viewport.transform;
            const x = transform[0] * item.transform[4] + transform[2] * item.transform[5] + transform[4];
            const y = transform[1] * item.transform[4] + transform[3] * item.transform[5] + transform[5];
            const width = item.width * viewport.scale;
            const height = item.height * viewport.scale;
            
            // Create highlight rectangle
            ctx.save();
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = isCurrentResult ? '#3B82F6' : '#FDE047'; // Blue for current, yellow for others
            ctx.fillRect(x, y - height * 0.8, width, height);
            
            // Add border for current result
            if (isCurrentResult) {
              ctx.globalAlpha = 0.8;
              ctx.strokeStyle = '#1D4ED8';
              ctx.lineWidth = 2;
              ctx.strokeRect(x, y - height * 0.8, width, height);
            }
            
            ctx.restore();
            break;
          }
        }
      });
    } catch (err) {
      console.error('Error highlighting search results:', err);
    }
  };

  useEffect(() => {
    if (pdfDoc && currentPage) {
      renderPage(pdfDoc, currentPage);
    }
    
    // Cleanup function to cancel any ongoing render when component unmounts
    return () => {
      if (renderTaskRef.current && renderTaskRef.current.cancel) {
        try {
          renderTaskRef.current.cancel();
        } catch (err) {
          // Ignore cancellation errors during cleanup
        }
      }
    };
  }, [pdfDoc, currentPage, zoom, rotation, searchResults, currentSearchIndex, searchTerm]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.2, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.2, 0.5));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handleDownload = () => {
    if (pdfFile) {
      const url = URL.createObjectURL(pdfFile);
      const link = document.createElement('a');
      link.href = url;
      link.download = pdfFile.name;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Pan functionality for moving around the PDF
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - viewPosition.x, y: e.clientY - viewPosition.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setViewPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetView = () => {
    setViewPosition({ x: 0, y: 0 });
    setZoom(1.2);
    setRotation(0);
  };

  // Search functionality
  const performSearch = async (term) => {
    console.log('Searching for:', term);
    if (!pdfDoc || !term.trim()) {
      console.log('No PDF doc or empty term');
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      return;
    }

    setIsSearching(true);
    const results = [];

    try {
      console.log(`Searching across ${totalPages} pages...`);
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Build full page text with position tracking
        let pageText = '';
        const textItems = textContent.items;
        
        textItems.forEach(item => {
          pageText += item.str + ' ';
        });
        
        console.log(`Page ${pageNum} text length:`, pageText.length);
        
        const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        let match;
        while ((match = regex.exec(pageText)) !== null) {
          results.push({
            pageNum,
            text: match[0],
            index: match.index,
            length: match[0].length,
            context: pageText.substring(Math.max(0, match.index - 50), match.index + match[0].length + 50)
          });
        }
      }
      
      console.log('Search results:', results);
      setSearchResults(results);
      setCurrentSearchIndex(results.length > 0 ? 0 : -1);
      
      if (results.length > 0) {
        setCurrentPage(results[0].pageNum);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      performSearch(searchTerm);
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    setCurrentSearchIndex(-1);
  };

  const navigateSearchResult = (direction) => {
    if (searchResults.length === 0) return;
    
    let newIndex;
    if (direction === 'next') {
      newIndex = (currentSearchIndex + 1) % searchResults.length;
    } else {
      newIndex = currentSearchIndex <= 0 ? searchResults.length - 1 : currentSearchIndex - 1;
    }
    
    setCurrentSearchIndex(newIndex);
    setCurrentPage(searchResults[newIndex].pageNum);
  };

  // Mouse wheel zoom
  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(prev => Math.max(0.5, Math.min(3, prev + delta)));
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, []);

  // Auto-search with debounce
  useEffect(() => {
    if (!pdfDoc) return;
    
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        performSearch(searchTerm);
      } else {
        setSearchResults([]);
        setCurrentSearchIndex(-1);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, pdfDoc]);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Toaster position="top-right" />
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-gray-300 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-black rounded-xl shadow-lg">
              <Feather className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-black">
                Pen and Paper
              </h1>
              <p className="text-sm text-gray-600">Professional Hand written notes searcher</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Voice Search Button */}
            <Button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🔘 BUTTON CLICKED - INLINE HANDLER');
                handleMicClick(e);
              }}
              variant="outline"
              type="button"
              className={`h-12 w-12 p-2 flex items-center justify-center ${
                isRecording 
                  ? 'bg-gray-900 border-2 border-black text-white hover:bg-black shadow-lg' 
                  : 'bg-white border-2 border-gray-400 text-gray-900 hover:bg-gray-100 hover:border-gray-600 shadow-md'
              } transition-all duration-200 cursor-pointer rounded-lg`}
              title="Voice search"
            >
              {isRecording ? (
                <MicOff className="h-6 w-6 animate-pulse" />
              ) : (
                <Mic className="h-6 w-6" />
              )}
            </Button>
            
            {/* Global Search Bar */}
            <div className="relative">
              <Search className="h-5 w-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
              <Input
                placeholder="Search across all documents..."
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    performGlobalSearch(globalSearchQuery);
                  }
                }}
                className="pl-12 pr-10 w-80 h-12 border-2 border-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-300 text-gray-900 placeholder:text-gray-400 rounded-lg shadow-md"
                style={{ color: '#111827' }}
              />
              {globalSearchQuery && (
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => {
                    setGlobalSearchQuery('');
                    setGlobalSearchResults([]);
                    setShowGlobalSearchResults(false);
                  }}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-gray-200 rounded-md"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            <Button
              onClick={() => performGlobalSearch(globalSearchQuery)}
              disabled={isGlobalSearching || !globalSearchQuery.trim()}
              className="h-12 px-6 bg-black hover:bg-gray-900 text-white font-semibold shadow-md border-2 border-black disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
            >
              {isGlobalSearching ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-5 w-5 mr-2" />
                  Search
                </>
              )}
            </Button>
            
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="bg-gray-900 hover:bg-black text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 border border-gray-800"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload PDF
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pdf"
              className="hidden"
            />
            
            <Button
              onClick={handleLogout}
              variant="outline"
              className="border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white hover:border-black font-semibold"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>



      {/* Toolbar */}
      {pdfFile && (
        <div className="bg-white border-b border-gray-300 px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-gray-200 rounded-lg">
                  <BookOpen className="h-4 w-4 text-gray-900" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-800 truncate max-w-64 block">
                    {pdfFile.name}
                  </span>
                  <span className="text-xs text-gray-500">{totalPages} pages</span>
                </div>
              </div>
              
              {/* Page Navigation */}
              <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-4 py-2 border border-gray-300">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0 bg-white hover:bg-gray-200 disabled:opacity-50 border border-gray-300 shadow-sm"
                >
                  <ChevronLeft className="h-4 w-4 text-gray-900" />
                </Button>
                
                <span className="text-sm font-bold text-gray-900 px-3 min-w-[60px] text-center bg-white border border-gray-300 rounded-md py-1 shadow-sm">
                  {currentPage} / {totalPages}
                </span>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0 bg-white hover:bg-gray-200 disabled:opacity-50 border border-gray-300 shadow-sm"
                >
                  <ChevronRight className="h-4 w-4 text-gray-900" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* View Controls */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1.5 border border-gray-300">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleZoomOut} 
                  className="h-8 w-8 p-0 bg-white hover:bg-gray-200 hover:text-gray-900 transition-colors border border-gray-300 text-gray-900 shadow-sm"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                
                <span className="text-sm font-bold text-gray-900 px-3 min-w-[50px] text-center bg-white rounded-lg py-1 border-2 border-gray-300 shadow-sm">
                  {Math.round(zoom * 100)}%
                </span>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleZoomIn} 
                  className="h-8 w-8 p-0 bg-white hover:bg-gray-200 hover:text-gray-900 transition-colors border border-gray-300 text-gray-900 shadow-sm"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                
                <div className="w-px h-5 bg-gray-400 mx-1" />
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleRotate} 
                  className="h-8 w-8 p-0 bg-white hover:bg-gray-200 hover:text-gray-900 transition-colors border border-gray-300 text-gray-900 shadow-sm"
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDownload} 
                  className="h-9 px-3 bg-white border-2 border-gray-400 text-gray-900 font-semibold hover:bg-gray-100 hover:border-gray-600 hover:text-black shadow-md hover:shadow-lg transition-all duration-200"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex relative">
        {/* Global Search Results Panel - Always Visible */}
        {(globalSearchResults.length > 0 || isGlobalSearching) && (
          <div className="w-96 bg-white border-r border-gray-200 shadow-lg overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-300 bg-gray-100 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-gray-900" />
                  <h3 className="font-semibold text-gray-900">
                    Search Results
                  </h3>
                  {globalSearchQuery && (
                    <span className="text-xs text-gray-500">
                      for "{globalSearchQuery}"
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    ({globalSearchResults.length})
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setGlobalSearchResults([]);
                      setShowGlobalSearchResults(false);
                      setGlobalSearchQuery('');
                    }}
                    className="h-8 w-8 p-0"
                    title="Clear results"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto p-4">
              {isGlobalSearching ? (
                <div className="text-center py-12">
                  <Loader2 className="h-12 w-12 text-gray-900 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-600">Searching...</p>
                </div>
              ) : globalSearchResults.length === 0 ? (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No results found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {globalSearchResults.map((result, index) => (
                    <div
                      key={index}
                      onClick={() => handleGlobalSearchResultClick(result)}
                      className="p-3 border border-gray-300 rounded-lg hover:bg-gray-100 hover:border-gray-500 cursor-pointer transition-all duration-200 group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Feather className="h-4 w-4 text-gray-900 flex-shrink-0" />
                          <span className="font-semibold text-sm text-gray-900 group-hover:text-black truncate">
                            {result.book_name || `Book ${result.book_id.substring(0, 8)}`}
                          </span>
                        </div>
                        <span className="text-xs text-gray-900 font-medium flex-shrink-0 ml-2">
                          Page {result.page_number}
                        </span>
                      </div>
                      {result.content && (
                        <p className="text-xs text-gray-600 line-clamp-3">
                          {result.content.substring(0, 150)}...
                        </p>
                      )}
                      {result.tags && result.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {result.tags.slice(0, 2).map((tag, idx) => (
                            <span key={idx} className="text-xs bg-gray-200 text-gray-900 px-2 py-0.5 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PDF Library Sidebar - Always Visible */}
        <div className="w-80 bg-white border-r border-gray-200 shadow-lg overflow-hidden">
            <div className="h-full flex flex-col">
              {/* Sidebar Header */}
              <div className="p-4 border-b border-gray-300 bg-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-gray-200 rounded-lg">
                      <HardDrive className="h-5 w-5 text-gray-900" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">PDF Library</h3>
                      <p className="text-xs text-gray-600">{storedPDFs.length} document{storedPDFs.length !== 1 ? 's' : ''} stored</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* PDF List */}
              <div className="flex-1 overflow-y-auto p-4">
                {storedPDFs.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Feather className="h-8 w-8 text-gray-400" />
                    </div>
                    <h4 className="font-medium text-gray-600 mb-2">No PDFs stored</h4>
                    <p className="text-sm text-gray-500 mb-4">Upload PDFs to access them quickly later</p>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      size="sm"
                      className="bg-gray-900 hover:bg-black text-white"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload First PDF
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {storedPDFs.map((pdf) => {
                      const isExpanded = expandedFolders.has(pdf.id);
                      const baseFileName = getFileNameWithoutExtension(pdf.name);
                      
                      return (
                        <div key={pdf.id} className="border border-gray-300 rounded-lg overflow-hidden">
                          {/* Folder Header */}
                          <div
                            className="group bg-gray-100 hover:bg-gray-200 p-3 cursor-pointer transition-all duration-200 border-b border-gray-300"
                            onClick={() => toggleFolder(pdf.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 hover:bg-gray-300 transition-colors"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-gray-900" />
                                  ) : (
                                    <ChevronRightIcon className="h-4 w-4 text-gray-900" />
                                  )}
                                </Button>
                                <div className="p-1.5 bg-gray-300 rounded-lg group-hover:bg-gray-400 transition-colors">
                                  <Folder className="h-4 w-4 text-gray-900" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-gray-900 truncate text-sm">
                                    {baseFileName}
                                  </h4>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteStoredPDF(pdf.id);
                                }}
                                className="opacity-60 group-hover:opacity-100 h-8 w-8 p-0 hover:bg-gray-900 hover:text-white transition-all bg-gray-200 border border-gray-400"
                              >
                                <Trash2 className="h-4 w-4 text-gray-900" />
                              </Button>
                            </div>
                          </div>

                          {/* Folder Contents */}
                          {isExpanded && (
                            <div className="bg-white">
                              {/* PDF File */}
                              <div
                                className="group flex items-center gap-3 p-3 pl-8 hover:bg-gray-100 cursor-pointer transition-all duration-200 border-b border-gray-200"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  loadStoredPDF(pdf);
                                }}
                              >
                                <div className="p-1.5 bg-gray-200 rounded group-hover:bg-gray-300 transition-colors">
                                  <File className="h-4 w-4 text-gray-900" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h5 className="font-medium text-gray-900 truncate text-sm group-hover:text-black">
                                    {pdf.name}
                                  </h5>
                                  <p className="text-xs text-gray-600 mt-0.5">PDF Document</p>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="p-1 bg-gray-300 rounded">
                                    <Eye className="h-3 w-3 text-gray-900" />
                                  </div>
                                </div>
                              </div>

                              {/* Markdown File */}
                              <div 
                                className="group flex items-center gap-3 p-3 pl-8 hover:bg-gray-100 cursor-pointer transition-all duration-200"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkdownClick(pdf);
                                }}
                              >
                                <div className="p-1.5 bg-gray-200 rounded group-hover:bg-gray-300 transition-colors">
                                  <FileEdit className="h-4 w-4 text-gray-900" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h5 className="font-medium text-gray-900 truncate text-sm group-hover:text-black">
                                    {baseFileName}.md
                                  </h5>
                                  <p className="text-xs text-gray-600 mt-0.5">Markdown Notes</p>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="p-1 bg-gray-300 rounded">
                                    <FileEdit className="h-3 w-3 text-gray-900" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

        {/* Content Viewer */}
        <div className={`flex-1 relative ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
          {viewMode === 'markdown' ? (
            /* Markdown Viewer */
            <div className="h-full bg-gray-50">
              {/* Markdown Header */}
              <div className="bg-white border-b border-gray-300 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={switchToPdfView}
                      variant="outline"
                      size="sm"
                      className="h-9 px-3 bg-white border-2 border-gray-400 text-gray-900 font-semibold hover:bg-gray-100 hover:border-gray-600 hover:text-black shadow-md hover:shadow-lg transition-all duration-200"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Back to PDF
                    </Button>
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-gray-200 rounded-lg">
                        <FileEdit className="h-5 w-5 text-gray-900" />
                      </div>
                      <div>
                        <h2 className="font-semibold text-gray-900">{currentMarkdownFile}</h2>
                        <p className="text-sm text-gray-600">Markdown Notes</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 px-3 bg-white border-2 border-gray-400 text-gray-900 font-semibold hover:bg-gray-100 hover:border-gray-600 hover:text-black shadow-md hover:shadow-lg transition-all duration-200"
                    >
                      <FileEdit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              </div>

              {/* Markdown Content */}
              <div className="h-full overflow-auto p-8">
                <div className="max-w-4xl mx-auto">
                  <div className="bg-white rounded-xl shadow-lg border border-gray-300 p-8">
                    <div className="prose prose-lg max-w-none">
                      <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-6 rounded-lg border border-gray-300 leading-relaxed">
                        {markdownContent}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : pdfFile ? (
            <div className="h-full bg-gradient-to-br from-gray-50 to-gray-100">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-20">
                  <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-gray-900 mx-auto mb-4" />
                    <p className="text-lg font-medium text-gray-900">Loading PDF...</p>
                    <p className="text-sm text-gray-600 mt-1">Please wait while we process your document</p>
                  </div>
                </div>
              )}
              
              {error && (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center bg-white rounded-lg p-8 shadow-lg max-w-md border border-gray-300">
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Feather className="h-8 w-8 text-gray-900" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading PDF</h3>
                    <p className="text-sm text-gray-600 mb-4">{error}</p>
                    <Button 
                      onClick={() => handleFileUpload({ target: { files: [pdfFile] } })} 
                      className="bg-gray-900 hover:bg-black text-white shadow-lg hover:shadow-xl transition-all duration-200"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Try Again
                    </Button>
                  </div>
                </div>
              )}
              
              {!loading && !error && (
                <div 
                  ref={containerRef}
                  className="h-full overflow-auto cursor-move"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <div className="flex items-center justify-center min-h-full p-8">
                    <div 
                      className="relative bg-white rounded-lg shadow-2xl overflow-hidden"
                      style={{
                        transform: `translate(${viewPosition.x}px, ${viewPosition.y}px)`,
                        transition: isDragging ? 'none' : 'transform 0.2s ease-out'
                      }}
                    >
                      {/* Canvas for PDF rendering */}
                      <canvas
                        ref={canvasRef}
                        className="block max-w-none"
                        style={{
                          filter: 'drop-shadow(0 10px 25px rgba(0, 0, 0, 0.1))',
                        }}
                      />
                      
                      {/* Page indicator overlay */}
                      <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
                        Page {currentPage} of {totalPages}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Floating action hints */}
              {!loading && !error && pdfDoc && (
                <div className="absolute bottom-6 left-6 bg-white/95 backdrop-blur-md rounded-xl p-4 shadow-xl border border-gray-300">
                  <div className="flex items-center gap-6 text-sm text-gray-900">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-gray-200 rounded-lg">
                        <Move className="h-3 w-3 text-gray-900" />
                      </div>
                      <span className="font-medium">Drag to pan</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-gray-200 rounded-lg">
                        <ZoomIn className="h-3 w-3 text-gray-900" />
                      </div>
                      <span className="font-medium">Ctrl + Scroll to zoom</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : viewMode === 'pdf' ? (
            // Welcome Screen
            <div className="h-full flex items-center justify-center bg-white">
              <div className="text-center max-w-lg">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-gray-300 rounded-full blur-3xl opacity-20 scale-150"></div>
                  <div className="relative bg-black rounded-3xl p-8 text-white shadow-2xl border border-gray-800">
                    <Feather className="h-16 w-16 mx-auto mb-4" />
                    <h2 className="text-3xl font-bold mb-2">
                      Pen and Paper
                    </h2>
                    <p className="text-gray-300">
                      Experience PDFs like never before
                    </p>
                  </div>
                </div>
                
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Ready to get started?
                </h3>
                
                <p className="text-gray-600 mb-8 leading-relaxed">
                  Upload any PDF document and enjoy our beautiful, responsive viewer with smooth zooming, 
                  rotation, panning, and more professional features.
                </p>
                
                <div className="space-y-4">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    size="lg"
                    className="bg-black hover:bg-gray-900 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 border border-gray-800"
                  >
                    <Upload className="h-5 w-5 mr-2" />
                    Choose PDF File
                  </Button>
                  
                  <p className="text-sm text-gray-600">
                    Drag and drop also supported
                  </p>
                </div>
                
                {/* Feature highlights */}
                <div className="mt-12 grid grid-cols-3 gap-6 text-center">
                  <div className="p-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <ZoomIn className="h-6 w-6 text-gray-900" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">Smart Zoom</h4>
                    <p className="text-sm text-gray-600">Smooth scaling with mouse wheel</p>
                  </div>
                  <div className="p-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <Move className="h-6 w-6 text-gray-900" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">Pan & Navigate</h4>
                    <p className="text-sm text-gray-600">Drag to move around pages</p>
                  </div>
                  <div className="p-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <RotateCw className="h-6 w-6 text-gray-900" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">Rotate & View</h4>
                    <p className="text-sm text-gray-600">Perfect viewing angles</p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Voice Recording Fullscreen Modal */}
      {showVoiceModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="text-center">
            {isProcessingVoice ? (
              // Processing state
              <div className="animate-fade-in">
                <Loader2 className="h-24 w-24 text-white mx-auto mb-6 animate-spin" />
                <h2 className="text-3xl font-bold text-white mb-3">Processing...</h2>
                <p className="text-gray-400 text-lg">Please wait</p>
              </div>
            ) : isRecording ? (
              // Recording state
              <div className="animate-fade-in">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-white rounded-full blur-3xl opacity-30 animate-pulse"></div>
                  <div className="relative bg-white rounded-full p-12 mx-auto w-48 h-48 flex items-center justify-center border-4 border-gray-300">
                    <Mic className="h-24 w-24 text-black animate-pulse" />
                  </div>
                </div>
                <h2 className="text-4xl font-bold text-white mb-4">Listening...</h2>
                <p className="text-gray-400 text-xl mb-8">Speak your search query</p>
                <Button
                  onClick={handleMicClick}
                  size="lg"
                  className="bg-gray-900 hover:bg-black text-white px-8 py-6 text-lg rounded-xl shadow-2xl border border-gray-700"
                >
                  <MicOff className="h-6 w-6 mr-3" />
                  Stop Recording
                </Button>
                <p className="text-gray-500 text-sm mt-6">Click to stop and process</p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;

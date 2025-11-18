import React, { useState } from 'react';
import axios from 'axios';
import { FileText, Upload, Send, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import './App.css';

const API_URL = 'http://localhost:5000';

function App() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [pdfUploaded, setPdfUploaded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadInfo, setUploadInfo] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
    } else {
      alert('Please select a valid PDF file');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      alert('Please select a PDF file first');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);

    try {
      const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setPdfUploaded(true);
      setUploadInfo(response.data);
      setMessages([
        {
          type: 'system',
          content: `✅ PDF processed successfully! ${response.data.pages} pages, ${response.data.chunks} chunks created. You can now ask questions.`,
        },
      ]);
    } catch (error) {
      alert('Error uploading PDF: ' + (error.response?.data?.error || error.message));
    } finally {
      setUploading(false);
    }
  };

  const handleAskQuestion = async (e) => {
    e.preventDefault();

    if (!question.trim()) {
      return;
    }

    if (!pdfUploaded) {
      alert('Please upload a PDF first');
      return;
    }

    // Add user message
    const userMessage = { type: 'user', content: question };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/ask`, {
        question: question,
      });

      const botMessage = {
        type: 'bot',
        content: response.data.answer,
        sources: response.data.sources,
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      const errorMessage = {
        type: 'error',
        content: 'Error: ' + (error.response?.data?.error || error.message),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      await axios.post(`${API_URL}/reset`);
      setFile(null);
      setPdfUploaded(false);
      setMessages([]);
      setUploadInfo(null);
      setQuestion('');
    } catch (error) {
      alert('Error resetting: ' + error.message);
    }
  };

  return (
    <div className="app">
      <div className="container">
        {/* Header */}
        <div className="header">
          <FileText size={48} />
          <h1>PDF Q&A Chatbot</h1>
          <p>RAG + FAISS + LangChain + OpenAI GPT</p>
        </div>

        {/* Upload Section */}
        <div className="upload-section">
          <h3>
            <Upload size={20} /> Upload PDF Document
          </h3>
          <div className="upload-controls">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              disabled={uploading || pdfUploaded}
            />
            {file && <p className="file-name">📄 {file.name}</p>}
            <button
              onClick={handleUpload}
              disabled={!file || uploading || pdfUploaded}
              className="upload-btn"
            >
              {uploading ? 'Processing...' : 'Upload & Process PDF'}
            </button>
          </div>

          {uploadInfo && (
            <div className="upload-info">
              <CheckCircle size={16} />
              <span>
                {uploadInfo.filename} - {uploadInfo.pages} pages, {uploadInfo.chunks} chunks
              </span>
            </div>
          )}

          {pdfUploaded && (
            <button onClick={handleReset} className="reset-btn">
              <Trash2 size={16} /> Reset & Upload New PDF
            </button>
          )}
        </div>

        {/* Chat Section */}
        <div className="chat-section">
          <h3>💬 Ask Questions</h3>
          <div className="chat-box">
            {messages.length === 0 ? (
              <div className="empty-state">
                <AlertCircle size={48} />
                <p>Upload a PDF to start asking questions</p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className={`message ${msg.type}-message`}>
                  <div className="message-content">{msg.content}</div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="sources">
                      <strong>📚 Sources:</strong>
                      {msg.sources.map((source, i) => (
                        <div key={i} className="source-item">
                          <span className="source-page">Page {source.page}</span>
                          <p className="source-text">{source.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
            {loading && (
              <div className="message bot-message loading-message">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleAskQuestion} className="input-form">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question about the PDF..."
              disabled={!pdfUploaded || loading}
            />
            <button type="submit" disabled={!pdfUploaded || loading || !question.trim()}>
              <Send size={20} />
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="footer">
          <p>Built with ❤️ by Uday Kumar | Powered by LangChain, FAISS & OpenAI</p>
        </div>
      </div>
    </div>
  );
}

export default App;

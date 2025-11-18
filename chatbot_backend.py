import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import tempfile
from langchain.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import FAISS
from langchain.chains import RetrievalQA
from langchain.chat_models import ChatOpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'pdf'}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Global variables for vector store
vectorstore = None
qa_chain = None

# Initialize OpenAI
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', 'sk-proj-dummy-key-for-demo')

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'message': 'PDF Q&A Chatbot API is running',
        'vectorstore_loaded': vectorstore is not None
    })

@app.route('/upload', methods=['POST'])
def upload_pdf():
    """
    Upload and process PDF file
    Creates embeddings and stores in FAISS vector database
    """
    global vectorstore, qa_chain
    
    try:
        # Check if file is present
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Only PDF files are allowed'}), 400
        
        # Save file temporarily
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Load PDF
        loader = PyPDFLoader(filepath)
        documents = loader.load()
        
        # Split documents into chunks
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len
        )
        chunks = text_splitter.split_documents(documents)
        
        # Create embeddings
        embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
        
        # Create FAISS vector store
        vectorstore = FAISS.from_documents(chunks, embeddings)
        
        # Initialize QA chain
        llm = ChatOpenAI(
            model_name='gpt-3.5-turbo',
            temperature=0,
            openai_api_key=OPENAI_API_KEY
        )
        
        qa_chain = RetrievalQA.from_chain_type(
            llm=llm,
            chain_type='stuff',
            retriever=vectorstore.as_retriever(search_kwargs={'k': 3}),
            return_source_documents=True
        )
        
        # Clean up uploaded file
        os.remove(filepath)
        
        return jsonify({
            'message': 'PDF processed successfully',
            'filename': filename,
            'chunks': len(chunks),
            'pages': len(documents)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/ask', methods=['POST'])
def ask_question():
    """
    Answer questions about the uploaded PDF
    Uses RAG pipeline with FAISS retrieval
    """
    global qa_chain
    
    try:
        if qa_chain is None:
            return jsonify({'error': 'Please upload a PDF first'}), 400
        
        data = request.get_json()
        
        if not data or 'question' not in data:
            return jsonify({'error': 'No question provided'}), 400
        
        question = data['question']
        
        if not question.strip():
            return jsonify({'error': 'Question cannot be empty'}), 400
        
        # Get answer from QA chain
        result = qa_chain({'query': question})
        
        answer = result['result']
        source_docs = result.get('source_documents', [])
        
        # Format sources
        sources = []
        for i, doc in enumerate(source_docs[:3]):  # Top 3 sources
            sources.append({
                'page': doc.metadata.get('page', 'N/A'),
                'content': doc.page_content[:200] + '...'  # First 200 chars
            })
        
        return jsonify({
            'answer': answer,
            'sources': sources,
            'question': question
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/reset', methods=['POST'])
def reset():
    """Reset the vector store and QA chain"""
    global vectorstore, qa_chain
    
    vectorstore = None
    qa_chain = None
    
    return jsonify({'message': 'System reset successfully'}), 200

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({'error': 'File too large. Maximum size is 16MB'}), 413

@app.errorhandler(500)
def internal_server_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    print("=" * 50)
    print("🚀 PDF Q&A Chatbot Backend Server")
    print("=" * 50)
    print(f"📡 API running on: http://localhost:5000")
    print(f"🔑 OpenAI API Key: {'Configured ✅' if OPENAI_API_KEY else 'Missing ❌'}")
    print(f"📁 Upload folder: {UPLOAD_FOLDER}")
    print("=" * 50)
    
    app.run(debug=True, host='0.0.0.0', port=5000)

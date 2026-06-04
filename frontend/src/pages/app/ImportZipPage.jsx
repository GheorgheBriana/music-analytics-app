import { useEffect, useState } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import { useAuth } from '../../contexts/AuthContext';

export default function ImportZipPage() {
    const { user } = useAuth();
    const userId = user?.id || localStorage.getItem('userId');

    // State-uri pentru importul de istoric ZIP
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadStatus, setUploadStatus] = useState('');
    const [importProgress, setImportProgress] = useState(0);
    const [isImporting, setIsImporting] = useState(false);

    // Conectare WebSocket pentru progresul importului (SockJS + Stomp)
    useEffect(() => {
        if (!userId) return;

        const stompClient = new Client({
            webSocketFactory: () => new SockJS('http://127.0.0.1:8080/ws-import'),
            onConnect: () => {
                console.log('Connected to WebSocket for import tracking');
                stompClient.subscribe(`/topic/import-progress/${userId}`, (message) => {
                    const data = JSON.parse(message.body);
                    setImportProgress(data.progress);
                    
                    if (data.status === 'COMPLETED') {
                        setIsImporting(false);
                        setUploadStatus('Import completed successfully!');
                    } else if (data.message) {
                        setUploadStatus(data.message);
                    }
                });
            },
            onStompError: (frame) => {
                console.error('Broker reported error: ' + frame.headers['message']);
            }
        });

        stompClient.activate();

        return () => {
            if (stompClient) {
                stompClient.deactivate();
            }
        };
    }, [userId]);

    function handleFileChange(event) {
        const file = event.target.files[0];
        setSelectedFile(file);
        setUploadStatus('');
    }

    async function handleUpload() {
        if (!userId) {
            setUploadStatus('No logged-in user was found.');
            return;
        }

        if (!selectedFile) {
            setUploadStatus('Please select a Spotify ZIP file first.');
            return;
        }

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            setUploadStatus('Uploading and queuing your Spotify history...');
            setIsImporting(true);
            setImportProgress(0);

            const response = await fetch(
                `http://127.0.0.1:8080/api/import/spotify-zip?userId=${userId}`,
                {
                    method: 'POST',
                    body: formData
                }
            );

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const result = await response.json();

            if (result && result.importedRecords !== undefined) {
                setImportProgress(100);
                setIsImporting(false);
                setUploadStatus(
                    `Import completed successfully: ${result.importedRecords} imported, ${result.duplicateRecords} duplicates, ${result.skippedRecords} skipped.`
                );
            } else {
                setUploadStatus('Upload successful! Processing records in background...');
            }
        } catch (error) {
            setUploadStatus('Something went wrong while uploading the ZIP file.');
            setIsImporting(false);
        }
    }

    return (
        <div className="profile-page-container">
            {/* ============ SECȚIUNE IMPORT SPOTIFY ZIP ============ */}
            <section className="profile-section upload-section">
                <h2>Upload Spotify History</h2>
                <p style={{ color: '#aeb3c5', fontSize: '13px', margin: '4px 0 20px 0', lineHeight: '1.5' }}>
                    Import your Spotify extended streaming history ZIP archive to unlock all-time personal music insights and analytics.
                </p>
                
                <div className="file-dropzone">
                    <input
                        type="file"
                        accept=".zip"
                        onChange={handleFileChange}
                        disabled={isImporting}
                    />
                </div>
                
                <button 
                    className="upload-btn" 
                    onClick={handleUpload}
                    disabled={isImporting}
                >
                    {isImporting ? 'Importing...' : 'Upload Spotify ZIP'}
                </button>

                {isImporting && (
                    <div className="progress-container">
                        <div 
                            className="progress-bar" 
                            style={{ width: `${importProgress}%` }}
                        ></div>
                    </div>
                )}

                {uploadStatus && (
                    <p className="upload-status">
                        {uploadStatus} {isImporting && `(${importProgress}%)`}
                    </p>
                )}
            </section>
            <StyleBlock />
        </div>
    );
}

function StyleBlock() {
    return (
        <style>{`
            .profile-page-container {
                display: flex;
                flex-direction: column;
                gap: 28px;
                padding: 12px 0 24px 0;
            }

            .profile-section {
                background: rgba(255, 255, 255, 0.02);
                border: 1px solid rgba(255, 255, 255, 0.05);
                border-radius: 20px;
                padding: 24px;
                text-align: left;
            }

            .profile-section h2 {
                font-size: 20px;
                margin: 0 0 8px 0;
                font-family: 'Outfit', sans-serif;
                font-weight: 700;
                color: #fff;
            }

            /* ============ UPLOAD SECTION ============ */
            .upload-section p {
                margin: 0 0 16px 0;
            }

            .file-dropzone {
                width: 100%;
                margin-bottom: 20px;
            }

            .file-dropzone input[type="file"] {
                display: block;
                width: 100%;
                background: rgba(0, 0, 0, 0.2);
                border: 2px dashed rgba(255, 255, 255, 0.1);
                border-radius: 14px;
                padding: 24px;
                color: #aeb3c5;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.25s ease;
                text-align: center;
            }

            .file-dropzone input[type="file"]:hover:not(:disabled) {
                border-color: #1db954;
                background: rgba(29, 185, 84, 0.03);
            }

            .upload-btn {
                background: rgba(255, 255, 255, 0.08);
                color: #fff;
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 30px;
                padding: 12px 28px;
                font-weight: 700;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.25s ease;
            }

            .upload-btn:hover:not(:disabled) {
                background: #1db954;
                color: #000;
                border-color: #1db954;
                transform: scale(1.02);
            }

            .upload-btn:disabled {
                opacity: .5;
                cursor: not-allowed;
            }

            .progress-container {
                margin-top: 20px;
                width: 100%;
                background-color: rgba(255, 255, 255, 0.05);
                border-radius: 10px;
                overflow: hidden;
                height: 12px;
                border: 1px solid rgba(255, 255, 255, 0.08);
            }

            .progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #1db954, #22c55e);
                transition: width 0.3s ease;
            }

            .upload-status {
                margin-top: 14px;
                font-size: 13px;
                color: #1db954;
                font-weight: 600;
            }
        `}</style>
    );
}
